import type { PlayerId } from "../player/index.ts";
import type { Coordinate } from "../board/index.ts";

export type GameEvent =
  | {
      type: "pip_added";
      x: number;
      y: number;
      owner: PlayerId;
    }
  | {
      type: "exploded";
      x: number;
      y: number;
      cascadeIndex: number;
      pipsAfter: number;
      ownerAfter: PlayerId | null;
      neighbors: Coordinate[];
    }
  | {
      type: "captured";
      x: number;
      y: number;
      owner: PlayerId;
      previousOwner: PlayerId | null;
    }
  | {
      type: "player_eliminated";
      player: PlayerId;
    }
  | {
      type: "ended";
      winner: PlayerId;
    };
