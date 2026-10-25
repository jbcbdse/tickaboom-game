import { ServerMessageParser } from "./ServerMessageParser.ts";

describe("ServerMessageParser", () => {
  const parser = new ServerMessageParser();

  it("parses joined, roster, view, and ended", () => {
    expect(
      parser.parse(
        JSON.stringify({
          type: "room.joined",
          seat: "0",
          seatToken: "t",
          host: true,
          joinCode: "ABCDEF",
          gameId: "tickaboom",
        }),
      ),
    ).toMatchObject({ type: "room.joined", seat: "0" });
    expect(
      parser.parse(
        JSON.stringify({
          type: "room.roster",
          hostSeat: "0",
          seats: [{ seat: "0", connected: true }],
        }),
      ),
    ).toMatchObject({ type: "room.roster" });
    expect(
      parser.parse(JSON.stringify({ type: "game.view", view: { a: 1 }, events: [] })),
    ).toEqual({ type: "game.view", view: { a: 1 }, events: [] });
    expect(
      parser.parse(JSON.stringify({ type: "room.ended", reason: "game_over" })),
    ).toEqual({ type: "room.ended", reason: "game_over" });
  });

  it("rejects junk", () => {
    expect(parser.parse("{}")).toBeNull();
    expect(parser.parse('{"type":"room.ended","reason":"nope"}')).toBeNull();
  });
});
