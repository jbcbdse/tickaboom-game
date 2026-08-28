import { inject, injectable } from "inversify";

import { Board, BoardGeometry } from "../board/index.ts";
import type { GameEvent } from "../event/index.ts";
import type { PlayerId } from "../player/index.ts";

@injectable()
export class ExplosionResolver {
  public constructor(
    @inject(BoardGeometry) private readonly geometry: BoardGeometry,
  ) {}

  public resolve(board: Board, player: PlayerId): GameEvent[] {
    const events: GameEvent[] = [];
    const queue: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    this.enqueueOverfull(board, queue, seen);
    let cascadeIndex = 0;
    while (queue.length > 0) {
      const waveSize = queue.length;
      for (let i = 0; i < waveSize; i += 1) {
        const next = queue.shift();
        if (!next) {
          break;
        }
        const key = `${String(next.x)},${String(next.y)}`;
        seen.delete(key);
        const cell = board.get(next.x, next.y);
        const neighbors = this.geometry.neighbors(next.x, next.y);
        const capacity = this.geometry.capacity(next.x, next.y);
        if (cell.pips <= capacity) {
          continue;
        }

        const remaining = cell.pips - neighbors.length;
        const ownerAfter = remaining > 0 ? player : null;
        board.set(next.x, next.y, { owner: ownerAfter, pips: remaining });

        events.push({
          type: "exploded",
          x: next.x,
          y: next.y,
          cascadeIndex,
          pipsAfter: remaining,
          ownerAfter,
          neighbors,
        });

        for (const neighbor of neighbors) {
          const target = board.get(neighbor.x, neighbor.y);
          const previousOwner = target.owner;
          const nextPips = target.pips + 1;
          board.set(neighbor.x, neighbor.y, { owner: player, pips: nextPips });
          if (previousOwner !== player) {
            events.push({
              type: "captured",
              x: neighbor.x,
              y: neighbor.y,
              owner: player,
              previousOwner,
            });
          }
          if (nextPips > this.geometry.capacity(neighbor.x, neighbor.y)) {
            this.enqueue(queue, seen, neighbor.x, neighbor.y);
          }
        }

        if (remaining > capacity) {
          this.enqueue(queue, seen, next.x, next.y);
        }
      }
      cascadeIndex += 1;
    }

    return events;
  }

  private enqueueOverfull(
    board: Board,
    queue: { x: number; y: number }[],
    seen: Set<string>,
  ): void {
    for (let y = 0; y < this.geometry.size; y += 1) {
      for (let x = 0; x < this.geometry.size; x += 1) {
        const cell = board.get(x, y);
        if (cell.pips > this.geometry.capacity(x, y)) {
          this.enqueue(queue, seen, x, y);
        }
      }
    }
  }

  private enqueue(
    queue: { x: number; y: number }[],
    seen: Set<string>,
    x: number,
    y: number,
  ): void {
    const key = `${String(x)},${String(y)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    queue.push({ x, y });
  }
}
