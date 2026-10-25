import { inject, injectable } from "inversify";

import { Board, BoardGeometry } from "./board/index.ts";
import type { GameEvent } from "./event/index.ts";
import { ExplosionResolver } from "./explosion/index.ts";
import type { Move } from "./move/index.ts";
import { PlacementRules } from "./placement/index.ts";
import type { PlayerId } from "./player/index.ts";
import { PlayerIdFactory } from "./player/index.ts";
import type { GameRuntime, SeatId, Spectator } from "./runtime/index.ts";
import type { GameState } from "./state/index.ts";

@injectable()
export class TickaboomEngine
  implements GameRuntime<GameState, Move, GameEvent, GameState>
{
  public readonly meta = { minPlayers: 2, maxPlayers: 4 };

  public constructor(
    @inject(BoardGeometry) private readonly geometry: BoardGeometry,
    @inject(PlacementRules) private readonly placement: PlacementRules,
    @inject(ExplosionResolver)
    private readonly explosions: ExplosionResolver,
    @inject(PlayerIdFactory) private readonly playerIds: PlayerIdFactory,
  ) {}

  public create(seats: SeatId[]): GameState {
    if (
      seats.length < this.meta.minPlayers ||
      seats.length > this.meta.maxPlayers
    ) {
      throw new Error(`Tickaboom needs 2-4 players, got ${String(seats.length)}`);
    }
    const players = seats.map((_, index) => this.playerIds.fromSeatIndex(index));
    const board = Board.empty(this.geometry);
    for (const [index, player] of players.entries()) {
      const home = this.geometry.home(index);
      board.set(home.x, home.y, { owner: player, pips: 1 });
    }
    const first = players[0];
    if (first === undefined) {
      throw new Error("No players");
    }
    return {
      board: board.toCells(),
      players,
      seats: [...seats],
      current: first,
      status: "playing",
      winner: null,
    };
  }

  public applyInput(
    state: GameState,
    seat: SeatId,
    input: Move,
  ):
    | { ok: true; state: GameState; events: GameEvent[] }
    | { ok: false; reason: string } {
    if (state.status !== "playing") {
      return { ok: false, reason: "game_over" };
    }
    const player = this.playerForSeat(state, seat);
    if (player === null) {
      return { ok: false, reason: "unknown_seat" };
    }
    if (player !== state.current) {
      return { ok: false, reason: "not_your_turn" };
    }
    if (!TickaboomEngine.isMove(input) || !this.placement.isLegal(state, player, input)) {
      return { ok: false, reason: "illegal_move" };
    }

    const board = Board.fromCells(this.geometry, state.board);
    const cell = board.get(input.x, input.y);
    board.set(input.x, input.y, { owner: player, pips: cell.pips + 1 });

    const events: GameEvent[] = [
      { type: "pip_added", x: input.x, y: input.y, owner: player },
    ];
    events.push(...this.explosions.resolve(board, player));

    const next: GameState = {
      board: board.toCells(),
      players: state.players,
      seats: state.seats,
      current: state.current,
      status: "playing",
      winner: null,
    };

    const previouslyLiving = this.livingPlayers(state);
    const nowLiving = this.livingPlayers(next);
    for (const lost of previouslyLiving) {
      if (!nowLiving.includes(lost)) {
        events.push({ type: "player_eliminated", player: lost });
      }
    }

    if (nowLiving.length === 1) {
      const winner = nowLiving[0];
      if (winner !== undefined) {
        next.status = "won";
        next.winner = winner;
        events.push({ type: "ended", winner });
      }
    } else if (nowLiving.length === 0) {
      next.status = "drawn";
      next.winner = null;
    } else {
      next.current = this.nextLiving(nowLiving, player);
    }

    return { ok: true, state: next, events };
  }

  public viewFor(state: GameState, _seat: SeatId | Spectator): GameState {
    return state;
  }

  public eventsFor(
    events: GameEvent[],
    _seat: SeatId | Spectator,
  ): GameEvent[] {
    return events;
  }

  public ended(state: GameState): boolean {
    return state.status !== "playing";
  }

  public legalMoves(state: GameState, player: PlayerId): Move[] {
    return this.placement.legalMoves(state, player);
  }

  public pipCount(state: GameState, player: PlayerId): number {
    return Board.fromCells(this.geometry, state.board).pipCount(player);
  }

  private static isMove(input: unknown): input is Move {
    return (
      typeof input === "object" &&
      input !== null &&
      "x" in input &&
      "y" in input &&
      typeof input.x === "number" &&
      typeof input.y === "number"
    );
  }

  private playerForSeat(state: GameState, seat: SeatId): PlayerId | null {
    const index = state.seats.indexOf(seat);
    if (index < 0) {
      return null;
    }
    return state.players[index] ?? null;
  }

  private livingPlayers(state: GameState): PlayerId[] {
    const board = Board.fromCells(this.geometry, state.board);
    return state.players.filter((player) => board.occupiedCount(player) > 0);
  }

  private nextLiving(living: PlayerId[], current: PlayerId): PlayerId {
    const index = living.indexOf(current);
    const next = living[(index + 1) % living.length];
    if (next === undefined) {
      const fallback = living[0];
      if (fallback === undefined) {
        throw new Error("No living players");
      }
      return fallback;
    }
    return next;
  }
}
