import type { SeatId } from "@tickaboom/protocol";
import { RoomDocumentCodec } from "./RoomDocumentCodec.ts";
import type { RoomDocument } from "./RoomDocument.ts";

describe("RoomDocumentCodec", () => {
  const codec = new RoomDocumentCodec();

  it("round-trips a room and leaves gameState opaque", () => {
    const room: RoomDocument = {
      joinCode: "ABCDEF",
      gameId: "fake",
      hostSeat: "0" as SeatId,
      phase: "playing",
      seats: [{ seat: "0" as SeatId, token: "t", connected: true }],
      gameState: { secret: true },
    };
    const decoded = codec.decode(codec.encode(room));
    expect(decoded).toEqual(room);
  });

  it("rejects junk", () => {
    expect(codec.decode("nope")).toBeNull();
    expect(codec.decode("{}")).toBeNull();
  });
});
