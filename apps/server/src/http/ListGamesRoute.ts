import { inject, injectable } from "inversify";
import type { Context, Hono } from "hono";

import { GameRegistry } from "../games/index.ts";

@injectable()
export class ListGamesRoute {
  public constructor(@inject(GameRegistry) private readonly games: GameRegistry) {}

  public register(app: Hono): void {
    app.get("/games", (c: Context) => c.json(this.games.list()));
  }
}
