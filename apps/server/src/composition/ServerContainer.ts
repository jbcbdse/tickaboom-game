import { serve } from "@hono/node-server";
import { TickaboomBindings, TickaboomEngine } from "@tickaboom/engine";
import { ClientMessageParser } from "@tickaboom/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Container } from "inversify";

import { ConnectionMap } from "../connection/index.ts";
import { GameRegistry } from "../games/index.ts";
import { CreateRoomRoute, ListGamesRoute } from "../http/index.ts";
import {
  Clock,
  JoinCode,
  RedisConnection,
  RedisRoomRepository,
  RoomMutex,
  RoomRepository,
  RoomService,
  SeatToken,
} from "../room/index.ts";
import { RoomSocketHandler } from "../ws/index.ts";

export class ServerContainer {
  public readonly container: Container;

  public constructor() {
    this.container = new Container();
    new TickaboomBindings().apply(this.container);
    this.container.bind(Clock).toSelf().inSingletonScope();
    this.container.bind(JoinCode).toSelf().inSingletonScope();
    this.container.bind(SeatToken).toSelf().inSingletonScope();
    this.container.bind(RoomMutex).toSelf().inSingletonScope();
    this.container.bind(ConnectionMap).toSelf().inSingletonScope();
    this.container.bind(GameRegistry).toSelf().inSingletonScope();
    this.container.bind(RedisConnection).toSelf().inSingletonScope();
    this.container.bind(RoomRepository).to(RedisRoomRepository).inSingletonScope();
    this.container
      .bind(ClientMessageParser)
      .toDynamicValue(() => new ClientMessageParser())
      .inSingletonScope();
    this.container.bind(RoomService).toSelf().inSingletonScope();
    this.container.bind(ListGamesRoute).toSelf().inSingletonScope();
    this.container.bind(CreateRoomRoute).toSelf().inSingletonScope();
    this.container.bind(RoomSocketHandler).toSelf().inSingletonScope();
    const registry = this.container.get(GameRegistry);
    const engine = this.container.get(TickaboomEngine);
    registry.register({
      id: "tickaboom",
      name: "Tickaboom",
      runtime: engine,
    });
  }

  public async listen(port: number): Promise<void> {
    await this.container.get(RedisConnection).connect();
    await this.container.get(RoomService).onBoot();
    const app = new Hono();
    app.use("*", cors());
    this.container.get(ListGamesRoute).register(app);
    this.container.get(CreateRoomRoute).register(app);
    const server = serve({ fetch: app.fetch, port }, (info) => {
      console.log(`Listening on http://127.0.0.1:${String(info.port)}`);
    });
    this.container.get(RoomSocketHandler).attach(server);
  }
}
