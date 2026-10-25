import { injectable } from "inversify";
import type { GameInfo } from "@tickaboom/protocol";

import type { RegisteredGame } from "./RegisteredGame.ts";

@injectable()
export class GameRegistry {
  private readonly games = new Map<string, RegisteredGame>();

  public register(game: RegisteredGame): void {
    this.games.set(game.id, game);
  }

  public get(gameId: string): RegisteredGame | undefined {
    return this.games.get(gameId);
  }

  public list(): GameInfo[] {
    return [...this.games.values()].map((game) => ({
      id: game.id,
      name: game.name,
      minPlayers: game.runtime.meta.minPlayers,
      maxPlayers: game.runtime.meta.maxPlayers,
    }));
  }
}
