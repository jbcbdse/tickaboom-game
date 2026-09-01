import type { GameInfo } from "@tickaboom/protocol";

export class GameCatalog {
  public readonly fallback: GameInfo[] = [
    { id: "tickaboom", name: "Tickaboom", minPlayers: 2, maxPlayers: 4 },
  ];
}
