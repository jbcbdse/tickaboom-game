import type { GameInfo } from "@tickaboom/protocol";
import { JsonRecord } from "@tickaboom/protocol";

export class RoomApi {
  private readonly json = new JsonRecord();

  public async listGames(): Promise<GameInfo[] | null> {
    try {
      const response = await fetch("/games");
      if (!response.ok) {
        return null;
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        return null;
      }
      const games: GameInfo[] = [];
      for (const item of data) {
        if (
          !this.json.is(item) ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.minPlayers !== "number" ||
          typeof item.maxPlayers !== "number"
        ) {
          return null;
        }
        games.push({
          id: item.id,
          name: item.name,
          minPlayers: item.minPlayers,
          maxPlayers: item.maxPlayers,
        });
      }
      return games;
    } catch {
      return null;
    }
  }

  public async createRoom(
    gameId: string,
  ): Promise<{ joinCode: string } | { reason: string }> {
    try {
      const response = await fetch("/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      const data: unknown = await response.json();
      if (
        this.json.is(data) &&
        typeof data.joinCode === "string" &&
        response.ok
      ) {
        return { joinCode: data.joinCode };
      }
      if (this.json.is(data) && typeof data.reason === "string") {
        return { reason: data.reason };
      }
      return { reason: "bad_response" };
    } catch {
      return { reason: "network_error" };
    }
  }
}
