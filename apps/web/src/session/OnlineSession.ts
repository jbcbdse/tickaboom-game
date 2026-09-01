import {
  ServerMessageParser,
  type RoomEndedReason,
  type RoomJoinedMessage,
  type RoomRosterMessage,
} from "@tickaboom/protocol";

export interface OnlineHandlers {
  onJoined: (message: RoomJoinedMessage) => void;
  onRoster: (message: RoomRosterMessage) => void;
  onStarted: () => void;
  onView: (view: unknown, events: unknown[]) => void;
  onEnded: (reason: RoomEndedReason) => void;
  onError: (reason: string) => void;
}

export class OnlineSession {
  private ws: WebSocket | null = null;
  private readonly parser = new ServerMessageParser();

  public constructor(private readonly handlers: OnlineHandlers) {}

  public connect(joinCode: string, token?: string): void {
    this.close();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const query =
      token !== undefined && token !== ""
        ? `?token=${encodeURIComponent(token)}`
        : "";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/rooms/${encodeURIComponent(joinCode)}${query}`,
    );
    this.ws = ws;
    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const message = this.parser.parse(event.data);
      if (message === null) {
        return;
      }
      switch (message.type) {
        case "room.joined":
          this.handlers.onJoined(message);
          break;
        case "room.roster":
          this.handlers.onRoster(message);
          break;
        case "room.started":
          this.handlers.onStarted();
          break;
        case "game.view":
          this.handlers.onView(message.view, message.events);
          break;
        case "room.ended":
          this.handlers.onEnded(message.reason);
          break;
        case "room.error":
          this.handlers.onError(message.reason);
          break;
      }
    });
  }

  public start(): void {
    this.send({ type: "room.start" });
  }

  public sendInput(payload: unknown): void {
    this.send({ type: "game.input", payload });
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
