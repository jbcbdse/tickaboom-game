import "reflect-metadata";

import { Container } from "inversify";

import type { Move } from "./move/index.ts";
import type { PlayerId } from "./player/index.ts";
import type { GameState } from "./state/index.ts";
import { TickaboomBindings } from "./TickaboomBindings.ts";
import { TickaboomEngine } from "./TickaboomEngine.ts";

function engine(): TickaboomEngine {
  const container = new Container();
  new TickaboomBindings().apply(container);
  return container.get(TickaboomEngine);
}

describe("TickaboomEngine", () => {
  it("places homes for 2, 3, and 4 players", () => {
    const e = engine();
    const two = e.create(["0", "1"]);
    expect(two.board[0]?.[0]).toEqual({ owner: 0, pips: 1 });
    expect(two.board[0]?.[10]).toEqual({ owner: 1, pips: 1 });
    expect(two.board[10]?.[0]?.owner).toBeNull();

    const three = e.create(["0", "1", "2"]);
    expect(three.board[10]?.[0]).toEqual({ owner: 2, pips: 1 });
    expect(three.board[10]?.[10]?.owner).toBeNull();

    const four = e.create(["0", "1", "2", "3"]);
    expect(four.board[10]?.[10]).toEqual({ owner: 3, pips: 1 });
  });

  it("allows placing on owned cells and orthogonal empty neighbors", () => {
    const e = engine();
    const state = e.create(["0", "1"]);
    expect(e.legalMoves(state, 0)).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    );
    expect(e.legalMoves(state, 0)).not.toEqual(
      expect.arrayContaining([{ x: 1, y: 1 }]),
    );
  });

  it("rejects the other player's turn", () => {
    const e = engine();
    const state = e.create(["0", "1"]);
    expect(e.applyInput(state, "1", { x: 10, y: 0 })).toEqual({
      ok: false,
      reason: "not_your_turn",
    });
  });

  it("explodes an overfilled home corner and captures neighbors", () => {
    const e = engine();
    const start = e.create(["0", "1"]);
    const result = e.applyInput(start, "0", { x: 0, y: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.board[0]?.[0]).toEqual({ owner: null, pips: 0 });
    expect(result.state.board[1]?.[0]).toEqual({ owner: 0, pips: 1 });
    expect(result.state.board[0]?.[1]).toEqual({ owner: 0, pips: 1 });
    const exploded = result.events.filter((event) => event.type === "exploded");
    expect(exploded).toHaveLength(1);
    expect(exploded[0]).toMatchObject({ cascadeIndex: 0 });
    expect(result.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["pip_added", "exploded", "captured"]),
    );
    expect(result.state.current).toBe(1);
  });

  it("chains explosions and can capture an opponent cell", () => {
    const e = engine();
    let state = e.create(["0", "1"]);
    const first = e.applyInput(state, "0", { x: 0, y: 0 });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    state = first.state;
    const second = e.applyInput(state, "1", { x: 10, y: 0 });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    state = second.state;
    expect(state.current).toBe(0);
  });

  it("plays a 2-player opening through boom, capture, elimination, and win", () => {
    const e = engine();
    let state = e.create(["0", "1"]);
    let guard = 0;
    const transcript: Move[] = [];
    const seen = { exploded: false, captured: false, eliminated: false };
    while (state.status === "playing" && guard < 400) {
      const player = state.current;
      const seat = state.seats[player];
      if (seat === undefined) {
        throw new Error("missing seat");
      }
      const move = greedyMove(e, state, player);
      transcript.push(move);
      const result = e.applyInput(state, seat, move);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      for (const event of result.events) {
        if (event.type === "exploded") {
          seen.exploded = true;
        }
        if (event.type === "captured" && event.previousOwner !== null) {
          seen.captured = true;
        }
        if (event.type === "player_eliminated") {
          seen.eliminated = true;
        }
      }
      state = result.state;
      guard += 1;
    }
    expect(guard).toBeLessThan(400);
    expect(seen).toEqual({ exploded: true, captured: true, eliminated: true });
    expect(state.status).toBe("won");
    expect(state.winner).not.toBeNull();
    expect(transcript.length).toBe(guard);
  });

  it("eliminates a player with no cells and awards the win", () => {
    const e = engine();
    const start = e.create(["0", "1"]);
    const board = start.board.map((row) =>
      row.map((cell) => ({ ...cell })),
    );
    const origin = board[0]?.[0];
    const east = board[0]?.[10];
    if (!origin || !east) {
      throw new Error("missing cells");
    }
    origin.owner = 0;
    origin.pips = 1;
    east.owner = 1;
    east.pips = 1;
    const neighbor = board[0]?.[9];
    if (!neighbor) {
      throw new Error("missing neighbor");
    }
    neighbor.owner = 0;
    neighbor.pips = 2;

    const rigged = { ...start, board, current: 0 as const };
    const result = e.applyInput(rigged, "0", { x: 9, y: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.status).toBe("won");
    expect(result.state.winner).toBe(0);
    expect(result.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["player_eliminated", "ended"]),
    );
  });
});

function capacity(x: number, y: number): number {
  let neighbors = 0;
  if (y > 0) {
    neighbors += 1;
  }
  if (y < 10) {
    neighbors += 1;
  }
  if (x > 0) {
    neighbors += 1;
  }
  if (x < 10) {
    neighbors += 1;
  }
  return neighbors - 1;
}

function greedyMove(
  e: TickaboomEngine,
  state: GameState,
  player: PlayerId,
): Move {
  const legal = e.legalMoves(state, player);
  const target = player === 0 ? { x: 10, y: 0 } : { x: 0, y: 0 };
  const ranked = legal.map((move) => {
    const cell = state.board[move.y]?.[move.x];
    const pips = cell?.pips ?? 0;
    const explodes = pips + 1 > capacity(move.x, move.y) ? 1 : 0;
    const dist = Math.abs(move.x - target.x) + Math.abs(move.y - target.y);
    return { move, explodes, dist, pips };
  });
  ranked.sort((a, b) => {
    if (a.explodes !== b.explodes) {
      return b.explodes - a.explodes;
    }
    if (a.dist !== b.dist) {
      return a.dist - b.dist;
    }
    return b.pips - a.pips;
  });
  const pick = ranked[0]?.move;
  if (!pick) {
    throw new Error("no legal moves");
  }
  return pick;
}
