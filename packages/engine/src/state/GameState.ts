import type { Cell } from "../board/index.ts";
import type { PlayerId } from "../player/index.ts";
import type { SeatId } from "../runtime/index.ts";

export type GameStatus = "playing" | "won" | "drawn";

export interface GameState {
  board: Cell[][];
  players: PlayerId[];
  seats: SeatId[];
  current: PlayerId;
  status: GameStatus;
  winner: PlayerId | null;
}
