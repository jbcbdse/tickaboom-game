import type { SeatId } from "../runtime/index.ts";
import { JsonRecord } from "./JsonRecord.ts";
import type { RosterSeat, ServerMessage } from "./ServerMessage.ts";

export class ServerMessageParser {
  private readonly json = new JsonRecord();

  public parse(raw: string): ServerMessage | null {
    const data = this.json.parse(raw);
    if (data === null || typeof data.type !== "string") {
      return null;
    }
    switch (data.type) {
      case "room.joined":
        return this.joined(data);
      case "room.roster":
        return this.roster(data);
      case "room.started":
        return { type: "room.started" };
      case "room.ended":
        return this.ended(data);
      case "room.error":
        return this.error(data);
      case "game.view":
        return this.view(data);
      default:
        return null;
    }
  }

  private joined(data: Record<string, unknown>): ServerMessage | null {
    if (
      typeof data.seat !== "string" ||
      typeof data.seatToken !== "string" ||
      typeof data.host !== "boolean" ||
      typeof data.joinCode !== "string" ||
      typeof data.gameId !== "string"
    ) {
      return null;
    }
    return {
      type: "room.joined",
      seat: data.seat as SeatId,
      seatToken: data.seatToken,
      host: data.host,
      joinCode: data.joinCode,
      gameId: data.gameId,
    };
  }

  private roster(data: Record<string, unknown>): ServerMessage | null {
    if (typeof data.hostSeat !== "string" || !Array.isArray(data.seats)) {
      return null;
    }
    const seats: RosterSeat[] = [];
    for (const item of data.seats) {
      const seat = this.rosterSeat(item);
      if (seat === null) {
        return null;
      }
      seats.push(seat);
    }
    return {
      type: "room.roster",
      hostSeat: data.hostSeat as SeatId,
      seats,
    };
  }

  private rosterSeat(item: unknown): RosterSeat | null {
    if (!this.json.is(item)) {
      return null;
    }
    if (typeof item.seat !== "string" || typeof item.connected !== "boolean") {
      return null;
    }
    return { seat: item.seat as SeatId, connected: item.connected };
  }

  private ended(data: Record<string, unknown>): ServerMessage | null {
    if (data.reason !== "game_over" && data.reason !== "empty_timeout") {
      return null;
    }
    return { type: "room.ended", reason: data.reason };
  }

  private error(data: Record<string, unknown>): ServerMessage | null {
    if (typeof data.reason !== "string") {
      return null;
    }
    return { type: "room.error", reason: data.reason };
  }

  private view(data: Record<string, unknown>): ServerMessage | null {
    if (!("view" in data) || !Array.isArray(data.events)) {
      return null;
    }
    return { type: "game.view", view: data.view, events: data.events };
  }
}
