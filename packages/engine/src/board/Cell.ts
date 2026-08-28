import type { PlayerId } from "../player/index.ts";

export interface Cell {
  owner: PlayerId | null;
  pips: number;
}
