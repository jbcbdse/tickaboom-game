import { ClientMessageParser } from "@tickaboom/protocol";
import type { GameRuntime, SeatId, Spectator } from "@tickaboom/protocol";

import { ConnectionMap } from "../connection/index.ts";
import { GameRegistry } from "../games/index.ts";
import { Clock } from "./Clock.ts";
import { EMPTY_ROOM_TTL_SECONDS } from "./EmptyRoomTtl.ts";
import { JoinCode } from "./JoinCode.ts";
import { MemoryRoomRepository } from "./MemoryRoomRepository.ts";
import { RoomMutex } from "./RoomMutex.ts";
import { RoomService } from "./RoomService.ts";
import { SeatToken } from "./SeatToken.ts";
import type { Socket } from "../connection/index.ts";
import type { ServerMessage } from "@tickaboom/protocol";

interface FakeState {
  seats: SeatId[];
  sum: number;
  status: "playing" | "won";
}

interface FakeInput {
  n: number;
}

class FakeEngine implements GameRuntime<
  FakeState,
  FakeInput,
  { type: string },
  { sum: number; seat: string }
> {
  public readonly meta = { minPlayers: 2, maxPlayers: 3 };

  public create(seats: SeatId[]): FakeState {
    return { seats, sum: 0, status: "playing" };
  }

  public applyInput(
    state: FakeState,
    _seat: SeatId,
    input: FakeInput,
  ):
    | { ok: true; state: FakeState; events: { type: string }[] }
    | { ok: false; reason: string } {
    if (input.n < 0) {
      return { ok: false, reason: "illegal_move" };
    }
    const next: FakeState = {
      seats: state.seats,
      sum: state.sum + input.n,
      status: state.sum + input.n >= 10 ? "won" : "playing",
    };
    return { ok: true, state: next, events: [{ type: "add" }] };
  }

  public viewFor(
    state: FakeState,
    seat: SeatId | Spectator,
  ): { sum: number; seat: string } {
    return { sum: state.sum, seat };
  }

  public eventsFor(
    events: { type: string }[],
    _seat: SeatId | Spectator,
  ): { type: string }[] {
    return events;
  }

  public ended(state: FakeState): boolean {
    return state.status !== "playing";
  }
}

class FakeClock extends Clock {
  public millis = 0;

  public override now(): number {
    return this.millis;
  }
}

class StubJoinCode extends JoinCode {
  public codes = ["AAAAAA", "BBBBBB"];
  private index = 0;

  public override generate(): string {
    const code = this.codes[this.index] ?? `ZZZZZ${String(this.index)}`;
    this.index += 1;
    return code;
  }
}

class StubSeatToken extends SeatToken {
  public tokens = ["tok-a", "tok-b", "tok-c", "tok-d"];
  private index = 0;

  public override generate(): string {
    const token = this.tokens[this.index] ?? `tok-${String(this.index)}`;
    this.index += 1;
    return token;
  }
}

class FakeSocket implements Socket {
  public readonly sent: ServerMessage[] = [];
  public closed = false;

  public send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerMessage);
  }

  public close(): void {
    this.closed = true;
  }

  public isClosed(): boolean {
    return this.closed;
  }
}

function harness() {
  const clock = new FakeClock();
  const rooms = new MemoryRoomRepository(clock);
  const connections = new ConnectionMap();
  const games = new GameRegistry();
  games.register({
    id: "fake",
    name: "Fake",
    runtime: new FakeEngine(),
  });
  const joinCodes = new StubJoinCode();
  const tokens = new StubSeatToken();
  const service = new RoomService(
    games,
    rooms,
    connections,
    joinCodes,
    tokens,
    new RoomMutex(),
    new ClientMessageParser(),
  );
  return { service, rooms, clock, connections };
}

async function twoSeats() {
  const h = harness();
  const created = await h.service.createRoom("fake");
  if ("reason" in created) {
    throw new Error(created.reason);
  }
  const host = new FakeSocket();
  const guest = new FakeSocket();
  await h.service.join(created.joinCode, undefined, host);
  await h.service.join(created.joinCode, undefined, guest);
  return { ...h, joinCode: created.joinCode, host, guest };
}

describe("RoomService", () => {
  it("rejects an unknown game", async () => {
    const { service } = harness();
    await expect(service.createRoom("nope")).resolves.toEqual({
      reason: "unknown_game",
    });
  });

  it("creates a join code", async () => {
    const { service } = harness();
    await expect(service.createRoom("fake")).resolves.toEqual({
      joinCode: "AAAAAA",
    });
  });

  it("assigns seats, host, and roster", async () => {
    const { host, guest } = await twoSeats();
    expect(host.sent[0]).toMatchObject({
      type: "room.joined",
      seat: "0",
      host: true,
      seatToken: "tok-a",
    });
    expect(guest.sent[0]).toMatchObject({
      type: "room.joined",
      seat: "1",
      host: false,
      seatToken: "tok-b",
    });
    const roster = guest.sent.find((message) => message.type === "room.roster");
    expect(roster).toEqual({
      type: "room.roster",
      hostSeat: "0",
      seats: [
        { seat: "0", connected: true },
        { seat: "1", connected: true },
      ],
    });
  });

  it("rejects start from a non-host and from too few players", async () => {
    const { service, host, guest } = await twoSeats();
    await service.leave(guest);
    await service.handleMessage(host, '{"type":"room.start"}');
    expect(host.sent.at(-1)).toEqual({
      type: "room.error",
      reason: "not_enough_players",
    });
    const again = await twoSeats();
    await again.service.handleMessage(again.guest, '{"type":"room.start"}');
    expect(again.guest.sent.at(-1)).toEqual({
      type: "room.error",
      reason: "not_host",
    });
  });

  it("starts and fans out per-seat views without the full document", async () => {
    const { service, host, guest } = await twoSeats();
    await service.handleMessage(host, '{"type":"room.start"}');
    expect(host.sent.some((message) => message.type === "room.started")).toBe(
      true,
    );
    const hostView = host.sent.find((message) => message.type === "game.view");
    const guestView = guest.sent.find((message) => message.type === "game.view");
    expect(hostView).toEqual({
      type: "game.view",
      view: { sum: 0, seat: "0" },
      events: [],
    });
    expect(guestView).toEqual({
      type: "game.view",
      view: { sum: 0, seat: "1" },
      events: [],
    });
  });

  it("applies input, fans out views, and rejects illegal input to the sender", async () => {
    const { service, host, guest } = await twoSeats();
    await service.handleMessage(host, '{"type":"room.start"}');
    host.sent.length = 0;
    guest.sent.length = 0;
    await service.handleMessage(
      guest,
      '{"type":"game.input","payload":{"n":3}}',
    );
    expect(host.sent).toEqual([
      { type: "game.view", view: { sum: 3, seat: "0" }, events: [{ type: "add" }] },
    ]);
    expect(guest.sent).toEqual([
      { type: "game.view", view: { sum: 3, seat: "1" }, events: [{ type: "add" }] },
    ]);
    await service.handleMessage(
      host,
      '{"type":"game.input","payload":{"n":-1}}',
    );
    expect(host.sent.at(-1)).toEqual({
      type: "room.error",
      reason: "illegal_move",
    });
    expect(guest.sent).toHaveLength(1);
  });

  it("rejects extra players past max", async () => {
    const { service, joinCode } = await twoSeats();
    const third = new FakeSocket();
    const fourth = new FakeSocket();
    await service.join(joinCode, undefined, third);
    await service.join(joinCode, undefined, fourth);
    expect(fourth.sent.at(-1)).toEqual({
      type: "room.error",
      reason: "room_full",
    });
    expect(fourth.closed).toBe(true);
  });

  it("drops a lobby seat and promotes host", async () => {
    const { service, host, guest } = await twoSeats();
    await service.leave(host);
    const roster = guest.sent.findLast(
      (message) => message.type === "room.roster",
    );
    expect(roster).toEqual({
      type: "room.roster",
      hostSeat: "1",
      seats: [{ seat: "1", connected: true }],
    });
  });

  it("keeps a disconnected seat while playing", async () => {
    const { service, host, guest } = await twoSeats();
    await service.handleMessage(host, '{"type":"room.start"}');
    await service.leave(guest);
    const roster = host.sent.findLast(
      (message) => message.type === "room.roster",
    );
    expect(roster).toMatchObject({
      type: "room.roster",
      seats: [
        { seat: "0", connected: true },
        { seat: "1", connected: false },
      ],
    });
  });

  it("reclaims a seat with a token and takes over a live socket", async () => {
    const { service, joinCode, host, guest } = await twoSeats();
    await service.handleMessage(host, '{"type":"room.start"}');
    await service.leave(guest);
    const rejoin = new FakeSocket();
    await service.join(joinCode, "tok-b", rejoin);
    expect(rejoin.sent[0]).toMatchObject({
      type: "room.joined",
      seat: "1",
      seatToken: "tok-b",
      host: false,
    });
    expect(
      rejoin.sent.some((message) => message.type === "room.started"),
    ).toBe(true);
    expect(rejoin.sent.some((message) => message.type === "game.view")).toBe(
      true,
    );

    const original = new FakeSocket();
    const takeover = new FakeSocket();
    await service.join(joinCode, "tok-a", original);
    await service.join(joinCode, "tok-a", takeover);
    expect(original.closed).toBe(true);
    expect(takeover.sent[0]).toMatchObject({ type: "room.joined", seat: "0" });
  });

  it("expires an empty room after 60 seconds", async () => {
    const { service, rooms, clock, joinCode, host, guest } = await twoSeats();
    await service.leave(host);
    await service.leave(guest);
    expect(await rooms.get(joinCode)).not.toBeNull();
    clock.millis += EMPTY_ROOM_TTL_SECONDS * 1000;
    expect(await rooms.get(joinCode)).toBeNull();
  });

  it("ends the room when the plugin reports ended", async () => {
    const { service, rooms, joinCode, host, guest } = await twoSeats();
    await service.handleMessage(host, '{"type":"room.start"}');
    await service.handleMessage(
      host,
      '{"type":"game.input","payload":{"n":10}}',
    );
    expect(host.sent.at(-1)).toEqual({
      type: "room.ended",
      reason: "game_over",
    });
    expect(guest.sent.at(-1)).toEqual({
      type: "room.ended",
      reason: "game_over",
    });
    expect(await rooms.get(joinCode)).toBeNull();
  });

  it("does not keep a lobby seat when the socket is already closed", async () => {
    const { service, rooms } = harness();
    const created = await service.createRoom("fake");
    if ("reason" in created) {
      throw new Error(created.reason);
    }
    const dead = new FakeSocket();
    dead.closed = true;
    await service.join(created.joinCode, undefined, dead);
    const room = await rooms.get(created.joinCode);
    expect(room?.seats).toEqual([]);
  });

  it("rejects a new seat after start", async () => {
    const { service, joinCode, host } = await twoSeats();
    await service.handleMessage(host, '{"type":"room.start"}');
    const late = new FakeSocket();
    await service.join(joinCode, undefined, late);
    expect(late.sent.at(-1)).toEqual({
      type: "room.error",
      reason: "game_already_started",
    });
  });
});
