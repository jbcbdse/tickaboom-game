export interface RoomStartMessage {
  type: "room.start";
}

export interface GameInputMessage {
  type: "game.input";
  payload: unknown;
}

export type ClientMessage = RoomStartMessage | GameInputMessage;
