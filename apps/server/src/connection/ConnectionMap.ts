import { injectable } from "inversify";
import type { SeatId, ServerMessage } from "@tickaboom/protocol";

import type { Socket } from "./Socket.ts";

export interface SocketLocation {
  joinCode: string;
  seat: SeatId;
}

@injectable()
export class ConnectionMap {
  private readonly rooms = new Map<string, Map<SeatId, Socket>>();
  private readonly locations = new Map<Socket, SocketLocation>();

  public attach(joinCode: string, seat: SeatId, socket: Socket): void {
    let seats = this.rooms.get(joinCode);
    if (seats === undefined) {
      seats = new Map();
      this.rooms.set(joinCode, seats);
    }
    seats.set(seat, socket);
    this.locations.set(socket, { joinCode, seat });
  }

  public detach(joinCode: string, seat: SeatId): Socket | undefined {
    const seats = this.rooms.get(joinCode);
    const socket = seats?.get(seat);
    seats?.delete(seat);
    if (seats?.size === 0) {
      this.rooms.delete(joinCode);
    }
    if (socket !== undefined) {
      this.locations.delete(socket);
    }
    return socket;
  }

  public lookup(socket: Socket): SocketLocation | undefined {
    return this.locations.get(socket);
  }

  public get(joinCode: string, seat: SeatId): Socket | undefined {
    return this.rooms.get(joinCode)?.get(seat);
  }

  public connectedCount(joinCode: string): number {
    return this.rooms.get(joinCode)?.size ?? 0;
  }

  public send(joinCode: string, seat: SeatId, message: ServerMessage): void {
    this.get(joinCode, seat)?.send(JSON.stringify(message));
  }

  public sendAll(joinCode: string, message: ServerMessage): void {
    const seats = this.rooms.get(joinCode);
    if (seats === undefined) {
      return;
    }
    const raw = JSON.stringify(message);
    for (const socket of seats.values()) {
      socket.send(raw);
    }
  }
}
