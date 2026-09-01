import { inject, injectable } from "inversify";
import {
  ClientMessageParser,
  type SeatId,
  type ServerMessage,
} from "@tickaboom/protocol";

import { ConnectionMap } from "../connection/index.ts";
import type { Socket } from "../connection/index.ts";
import { GameRegistry } from "../games/index.ts";
import type { RegisteredGame } from "../games/index.ts";
import { EMPTY_ROOM_TTL_SECONDS } from "./EmptyRoomTtl.ts";
import { JoinCode } from "./JoinCode.ts";
import type { RoomDocument, RoomSeat } from "./RoomDocument.ts";
import { RoomMutex } from "./RoomMutex.ts";
import { RoomRepository } from "./RoomRepository.ts";
import { SeatToken } from "./SeatToken.ts";

@injectable()
export class RoomService {
  public constructor(
    @inject(GameRegistry) private readonly games: GameRegistry,
    @inject(RoomRepository) private readonly rooms: RoomRepository,
    @inject(ConnectionMap) private readonly connections: ConnectionMap,
    @inject(JoinCode) private readonly joinCodes: JoinCode,
    @inject(SeatToken) private readonly tokens: SeatToken,
    @inject(RoomMutex) private readonly mutex: RoomMutex,
    @inject(ClientMessageParser) private readonly messages: ClientMessageParser,
  ) {}

  public async createRoom(
    gameId: string,
  ): Promise<{ joinCode: string } | { reason: string }> {
    if (this.games.get(gameId) === undefined) {
      return { reason: "unknown_game" };
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const joinCode = this.joinCodes.generate();
      if (await this.rooms.exists(joinCode)) {
        continue;
      }
      await this.rooms.save({
        joinCode,
        gameId,
        hostSeat: "" as SeatId,
        phase: "lobby",
        seats: [],
        gameState: null,
      });
      await this.rooms.expire(joinCode, EMPTY_ROOM_TTL_SECONDS);
      return { joinCode };
    }
    return { reason: "join_code_exhausted" };
  }

  public async join(
    joinCode: string,
    token: string | undefined,
    socket: Socket,
  ): Promise<void> {
    await this.mutex.run(joinCode, async () => {
      const room = await this.rooms.get(joinCode);
      if (room === null) {
        this.error(socket, "room_not_found");
        socket.close();
        return;
      }
      const game = this.games.get(room.gameId);
      if (game === undefined) {
        this.error(socket, "unknown_game");
        socket.close();
        return;
      }
      if (token !== undefined && token !== "") {
        await this.reclaim(room, game, token, socket);
        return;
      }
      await this.takeSeat(room, game, socket);
    });
  }

  public async handleMessage(socket: Socket, raw: string): Promise<void> {
    const location = this.connections.lookup(socket);
    if (location === undefined) {
      this.error(socket, "not_joined");
      return;
    }
    const message = this.messages.parse(raw);
    if (message === null) {
      this.error(socket, "bad_message");
      return;
    }
    await this.mutex.run(location.joinCode, async () => {
      const room = await this.rooms.get(location.joinCode);
      if (room === null) {
        this.error(socket, "room_not_found");
        return;
      }
      if (message.type === "room.start") {
        await this.start(room, location.seat, socket);
        return;
      }
      await this.input(room, location.seat, socket, message.payload);
    });
  }

  public async leave(socket: Socket): Promise<void> {
    const location = this.connections.lookup(socket);
    if (location === undefined) {
      return;
    }
    await this.mutex.run(location.joinCode, async () => {
      this.connections.detach(location.joinCode, location.seat);
      const room = await this.rooms.get(location.joinCode);
      if (room === null) {
        return;
      }
      if (room.phase === "lobby") {
        room.seats = room.seats.filter((seat) => seat.seat !== location.seat);
        if (room.hostSeat === location.seat) {
          room.hostSeat = room.seats[0]?.seat ?? ("" as SeatId);
        }
      } else {
        const seat = room.seats.find((entry) => entry.seat === location.seat);
        if (seat !== undefined) {
          seat.connected = false;
        }
      }
      await this.rooms.save(room);
      if (this.connections.connectedCount(location.joinCode) === 0) {
        await this.rooms.expire(location.joinCode, EMPTY_ROOM_TTL_SECONDS);
      }
      this.broadcastRoster(room);
    });
  }

  public async onBoot(): Promise<void> {
    for (const joinCode of await this.rooms.listJoinCodes()) {
      const room = await this.rooms.get(joinCode);
      if (room === null) {
        continue;
      }
      for (const seat of room.seats) {
        seat.connected = false;
      }
      await this.rooms.save(room);
      await this.rooms.expire(joinCode, EMPTY_ROOM_TTL_SECONDS);
    }
  }

  private async reclaim(
    room: RoomDocument,
    game: RegisteredGame,
    token: string,
    socket: Socket,
  ): Promise<void> {
    const seat = room.seats.find((entry) => entry.token === token);
    if (seat === undefined) {
      this.error(socket, "invalid_token");
      socket.close();
      return;
    }
    const previous = this.connections.detach(room.joinCode, seat.seat);
    previous?.close();
    seat.connected = true;
    this.connections.attach(room.joinCode, seat.seat, socket);
    await this.rooms.save(room);
    this.sendJoined(socket, room, seat, game);
    this.broadcastRoster(room);
    if (room.phase === "playing" && room.gameState !== null) {
      this.send(socket, { type: "room.started" });
      this.sendView(room, game, seat.seat, []);
    }
  }

  private async takeSeat(
    room: RoomDocument,
    game: RegisteredGame,
    socket: Socket,
  ): Promise<void> {
    if (room.phase !== "lobby") {
      this.error(socket, "game_already_started");
      socket.close();
      return;
    }
    if (room.seats.length >= game.runtime.meta.maxPlayers) {
      this.error(socket, "room_full");
      socket.close();
      return;
    }
    const seatId = this.nextSeat(room);
    const seat: RoomSeat = {
      seat: seatId,
      token: this.tokens.generate(),
      connected: true,
    };
    room.seats.push(seat);
    if (room.seats.length === 1) {
      room.hostSeat = seatId;
    }
    this.connections.attach(room.joinCode, seatId, socket);
    await this.rooms.save(room);
    this.sendJoined(socket, room, seat, game);
    this.broadcastRoster(room);
  }

  private async start(
    room: RoomDocument,
    seat: SeatId,
    socket: Socket,
  ): Promise<void> {
    const game = this.games.get(room.gameId);
    if (game === undefined) {
      this.error(socket, "unknown_game");
      return;
    }
    if (room.phase !== "lobby") {
      this.error(socket, "already_started");
      return;
    }
    if (seat !== room.hostSeat) {
      this.error(socket, "not_host");
      return;
    }
    const count = room.seats.length;
    if (count < game.runtime.meta.minPlayers) {
      this.error(socket, "not_enough_players");
      return;
    }
    if (count > game.runtime.meta.maxPlayers) {
      this.error(socket, "too_many_players");
      return;
    }
    room.gameState = game.runtime.create(room.seats.map((entry) => entry.seat));
    room.phase = "playing";
    await this.rooms.save(room);
    for (const entry of room.seats) {
      if (!entry.connected) {
        continue;
      }
      this.connections.send(room.joinCode, entry.seat, { type: "room.started" });
      this.sendView(room, game, entry.seat, []);
    }
  }

  private async input(
    room: RoomDocument,
    seat: SeatId,
    socket: Socket,
    payload: unknown,
  ): Promise<void> {
    const game = this.games.get(room.gameId);
    if (game === undefined) {
      this.error(socket, "unknown_game");
      return;
    }
    if (room.phase !== "playing" || room.gameState === null) {
      this.error(socket, "not_playing");
      return;
    }
    let result: ReturnType<typeof game.runtime.applyInput>;
    try {
      result = game.runtime.applyInput(room.gameState, seat, payload);
    } catch {
      this.error(socket, "illegal_move");
      return;
    }
    if (!result.ok) {
      this.error(socket, result.reason);
      return;
    }
    room.gameState = result.state;
    await this.rooms.save(room);
    for (const entry of room.seats) {
      if (entry.connected) {
        this.sendView(room, game, entry.seat, result.events);
      }
    }
    if (game.runtime.ended(result.state)) {
      this.connections.sendAll(room.joinCode, {
        type: "room.ended",
        reason: "game_over",
      });
      await this.rooms.delete(room.joinCode);
    }
  }

  private sendView(
    room: RoomDocument,
    game: RegisteredGame,
    seat: SeatId,
    events: unknown[],
  ): void {
    const view = game.runtime.viewFor(room.gameState, seat);
    this.connections.send(room.joinCode, seat, {
      type: "game.view",
      view,
      events: game.runtime.eventsFor(events, seat),
    });
  }

  private sendJoined(
    socket: Socket,
    room: RoomDocument,
    seat: RoomSeat,
    game: RegisteredGame,
  ): void {
    this.send(socket, {
      type: "room.joined",
      seat: seat.seat,
      seatToken: seat.token,
      host: seat.seat === room.hostSeat,
      joinCode: room.joinCode,
      gameId: game.id,
    });
  }

  private broadcastRoster(room: RoomDocument): void {
    if (room.hostSeat === ("" as SeatId)) {
      return;
    }
    const message: ServerMessage = {
      type: "room.roster",
      hostSeat: room.hostSeat,
      seats: room.seats.map((seat) => ({
        seat: seat.seat,
        connected: seat.connected,
      })),
    };
    this.connections.sendAll(room.joinCode, message);
  }

  private nextSeat(room: RoomDocument): SeatId {
    const used = new Set(room.seats.map((seat) => seat.seat));
    let index = 0;
    while (used.has(String(index) as SeatId)) {
      index += 1;
    }
    return String(index) as SeatId;
  }

  private send(socket: Socket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  private error(socket: Socket, reason: string): void {
    this.send(socket, { type: "room.error", reason });
  }
}
