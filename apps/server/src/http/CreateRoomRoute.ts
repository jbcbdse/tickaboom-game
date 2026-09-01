import { inject, injectable } from "inversify";
import type { Context, Hono } from "hono";
import { JsonRecord } from "@tickaboom/protocol";

import { RoomService } from "../room/index.ts";

@injectable()
export class CreateRoomRoute {
  private readonly json = new JsonRecord();

  public constructor(@inject(RoomService) private readonly rooms: RoomService) {}

  public register(app: Hono): void {
    app.post("/rooms", (c: Context) => this.handle(c));
  }

  private async handle(c: Context): Promise<Response> {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ reason: "bad_request" }, 400);
    }
    if (!this.json.is(body) || typeof body.gameId !== "string") {
      return c.json({ reason: "bad_request" }, 400);
    }
    const result = await this.rooms.createRoom(body.gameId);
    if ("reason" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
  }
}
