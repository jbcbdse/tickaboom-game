import type { SeatId } from "@tickaboom/protocol";
import { JsonRecord } from "@tickaboom/protocol";

import type { RoomDocument, RoomSeat } from "./RoomDocument.ts";

export class RoomDocumentCodec {
  private readonly json = new JsonRecord();

  public encode(room: RoomDocument): string {
    return JSON.stringify(room);
  }

  public decode(raw: string): RoomDocument | null {
    const data = this.json.parse(raw);
    if (data === null) {
      return null;
    }
    if (
      typeof data.joinCode !== "string" ||
      typeof data.gameId !== "string" ||
      typeof data.hostSeat !== "string" ||
      (data.phase !== "lobby" && data.phase !== "playing") ||
      !Array.isArray(data.seats)
    ) {
      return null;
    }
    const seats: RoomSeat[] = [];
    for (const item of data.seats) {
      const seat = this.seat(item);
      if (seat === null) {
        return null;
      }
      seats.push(seat);
    }
    return {
      joinCode: data.joinCode,
      gameId: data.gameId,
      hostSeat: data.hostSeat as SeatId,
      phase: data.phase,
      seats,
      gameState: data.gameState,
    };
  }

  private seat(item: unknown): RoomSeat | null {
    if (!this.json.is(item)) {
      return null;
    }
    if (
      typeof item.seat !== "string" ||
      typeof item.token !== "string" ||
      typeof item.connected !== "boolean"
    ) {
      return null;
    }
    return {
      seat: item.seat as SeatId,
      token: item.token,
      connected: item.connected,
    };
  }
}
