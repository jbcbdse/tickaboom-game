import type { SeatId } from "@tickaboom/protocol";

export type RoomPhase = "lobby" | "playing";

export interface RoomSeat {
  seat: SeatId;
  token: string;
  connected: boolean;
}

export interface RoomDocument {
  joinCode: string;
  gameId: string;
  hostSeat: SeatId;
  phase: RoomPhase;
  seats: RoomSeat[];
  gameState: unknown;
}
