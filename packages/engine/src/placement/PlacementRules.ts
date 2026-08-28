import { inject, injectable } from "inversify";

import { Board, BoardGeometry } from "../board/index.ts";
import type { Move } from "../move/index.ts";
import type { PlayerId } from "../player/index.ts";
import type { GameState } from "../state/index.ts";

@injectable()
export class PlacementRules {
  public constructor(
    @inject(BoardGeometry) private readonly geometry: BoardGeometry,
  ) {}

  public isLegal(state: GameState, player: PlayerId, move: Move): boolean {
    if (!this.geometry.inBounds(move.x, move.y)) {
      return false;
    }
    const board = Board.fromCells(this.geometry, state.board);
    const cell = board.get(move.x, move.y);
    if (cell.owner === player) {
      return true;
    }
    if (cell.owner !== null || cell.pips !== 0) {
      return false;
    }
    return this.hasOwnedOrthogonalNeighbor(board, move.x, move.y, player);
  }

  public legalMoves(state: GameState, player: PlayerId): Move[] {
    const moves: Move[] = [];
    for (let y = 0; y < this.geometry.size; y += 1) {
      for (let x = 0; x < this.geometry.size; x += 1) {
        const move = { x, y };
        if (this.isLegal(state, player, move)) {
          moves.push(move);
        }
      }
    }
    return moves;
  }

  private hasOwnedOrthogonalNeighbor(
    board: Board,
    x: number,
    y: number,
    player: PlayerId,
  ): boolean {
    for (const neighbor of this.geometry.neighbors(x, y)) {
      const cell = board.get(neighbor.x, neighbor.y);
      if (cell.owner === player) {
        return true;
      }
    }
    return false;
  }
}
