import type { SeatId } from "../runtime/index.ts";

export interface RosterSeat {
  seat: SeatId;
  connected: boolean;
}

export interface RoomJoinedMessage {
  type: "room.joined";
  seat: SeatId;
  seatToken: string;
  host: boolean;
  joinCode: string;
  gameId: string;
}

export interface RoomRosterMessage {
  type: "room.roster";
  hostSeat: SeatId;
  seats: RosterSeat[];
}

export interface RoomStartedMessage {
  type: "room.started";
}

export type RoomEndedReason = "game_over" | "empty_timeout";

export interface RoomEndedMessage {
  type: "room.ended";
  reason: RoomEndedReason;
}

export interface RoomErrorMessage {
  type: "room.error";
  reason: string;
}

export interface GameViewMessage {
  type: "game.view";
  view: unknown;
  events: unknown[];
}

export type ServerMessage =
  | RoomJoinedMessage
  | RoomRosterMessage
  | RoomStartedMessage
  | RoomEndedMessage
  | RoomErrorMessage
  | GameViewMessage;
