import type { GameEvent, GameState } from "@tickaboom/engine";
import { JsonRecord } from "@tickaboom/protocol";

export class TickaboomView {
  private readonly json = new JsonRecord();

  public parseState(value: unknown): GameState | null {
    if (!this.json.is(value)) {
      return null;
    }
    if (
      !Array.isArray(value.board) ||
      value.board.some((row) => !Array.isArray(row)) ||
      !Array.isArray(value.players) ||
      !Array.isArray(value.seats) ||
      typeof value.current !== "number" ||
      (value.status !== "playing" &&
        value.status !== "won" &&
        value.status !== "drawn")
    ) {
      return null;
    }
    return value as unknown as GameState;
  }

  public parseEvents(value: unknown[]): GameEvent[] | null {
    const events: GameEvent[] = [];
    for (const item of value) {
      if (!this.json.is(item) || typeof item.type !== "string") {
        return null;
      }
      events.push(item as unknown as GameEvent);
    }
    return events;
  }
}
