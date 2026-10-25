import type { GameRuntime } from "@tickaboom/protocol";

export interface RegisteredGame {
  id: string;
  name: string;
  runtime: GameRuntime<unknown, unknown, unknown, unknown>;
}
