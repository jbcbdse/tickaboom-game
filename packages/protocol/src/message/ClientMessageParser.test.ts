import { ClientMessageParser } from "./ClientMessageParser.ts";

describe("ClientMessageParser", () => {
  const parser = new ClientMessageParser();

  it("parses room.start", () => {
    expect(parser.parse('{"type":"room.start"}')).toEqual({
      type: "room.start",
    });
  });

  it("parses game.input with an opaque payload", () => {
    expect(parser.parse('{"type":"game.input","payload":{"x":1}}')).toEqual({
      type: "game.input",
      payload: { x: 1 },
    });
  });

  it("rejects junk", () => {
    expect(parser.parse("not json")).toBeNull();
    expect(parser.parse('{"type":"game.input"}')).toBeNull();
    expect(parser.parse('{"type":"nope"}')).toBeNull();
  });
});
