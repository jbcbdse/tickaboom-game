import { inject, injectable } from "inversify";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerType } from "@hono/node-server";
import { WebSocket, WebSocketServer } from "ws";

import type { Socket } from "../connection/index.ts";
import { RoomService } from "../room/index.ts";

@injectable()
export class RoomSocketHandler {
  public constructor(
    @inject(RoomService) private readonly rooms: RoomService,
  ) {}

  public attach(server: ServerType): void {
    const wss = new WebSocketServer({ noServer: true });
    const http = server as HttpServer;
    http.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      this.upgrade(wss, request, socket, head);
    });
  }

  private upgrade(
    wss: WebSocketServer,
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    const host = request.headers.host ?? "127.0.0.1";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const match = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    if (match === null) {
      socket.destroy();
      return;
    }
    const rawCode = match[1];
    if (rawCode === undefined) {
      socket.destroy();
      return;
    }
    const joinCode = decodeURIComponent(rawCode);
    const token = url.searchParams.get("token") ?? undefined;
    wss.handleUpgrade(request, socket, head, (ws) => {
      const wrapped = this.wrap(ws);
      void this.rooms.join(joinCode, token, wrapped);
      ws.on("message", (data) => {
        void this.rooms.handleMessage(wrapped, this.raw(data));
      });
      ws.on("close", () => {
        void this.rooms.leave(wrapped);
      });
    });
  }

  private wrap(ws: WebSocket): Socket {
    return {
      send: (data: string) => {
        ws.send(data);
      },
      close: () => {
        ws.close();
      },
    };
  }

  private raw(data: WebSocket.RawData): string {
    if (typeof data === "string") {
      return data;
    }
    if (Array.isArray(data)) {
      return Buffer.concat(data).toString();
    }
    if (Buffer.isBuffer(data)) {
      return data.toString();
    }
    return Buffer.from(data).toString();
  }
}
