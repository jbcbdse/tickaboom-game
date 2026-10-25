import type { ClientMessage } from "./ClientMessage.ts";
import { JsonRecord } from "./JsonRecord.ts";

export class ClientMessageParser {
  private readonly json = new JsonRecord();

  public parse(raw: string): ClientMessage | null {
    const data = this.json.parse(raw);
    if (data === null) {
      return null;
    }
    const type = data.type;
    if (type === "room.start") {
      return { type: "room.start" };
    }
    if (type === "game.input" && "payload" in data) {
      return { type: "game.input", payload: data.payload };
    }
    return null;
  }
}
