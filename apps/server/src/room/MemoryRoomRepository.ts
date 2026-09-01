import { inject, injectable } from "inversify";

import { Clock } from "./Clock.ts";
import type { RoomDocument } from "./RoomDocument.ts";
import { RoomRepository } from "./RoomRepository.ts";

@injectable()
export class MemoryRoomRepository extends RoomRepository {
  private readonly rooms = new Map<string, RoomDocument>();
  private readonly expiresAt = new Map<string, number>();

  public constructor(@inject(Clock) private readonly clock: Clock) {
    super();
  }

  public override get(joinCode: string): Promise<RoomDocument | null> {
    this.purge(joinCode);
    const room = this.rooms.get(joinCode);
    return Promise.resolve(room === undefined ? null : structuredClone(room));
  }

  public override save(room: RoomDocument): Promise<void> {
    this.rooms.set(room.joinCode, structuredClone(room));
    this.expiresAt.delete(room.joinCode);
    return Promise.resolve();
  }

  public override delete(joinCode: string): Promise<void> {
    this.rooms.delete(joinCode);
    this.expiresAt.delete(joinCode);
    return Promise.resolve();
  }

  public override expire(joinCode: string, seconds: number): Promise<void> {
    if (!this.rooms.has(joinCode)) {
      return Promise.resolve();
    }
    this.expiresAt.set(joinCode, this.clock.now() + seconds * 1000);
    return Promise.resolve();
  }

  public override exists(joinCode: string): Promise<boolean> {
    this.purge(joinCode);
    return Promise.resolve(this.rooms.has(joinCode));
  }

  public override listJoinCodes(): Promise<string[]> {
    for (const joinCode of [...this.rooms.keys()]) {
      this.purge(joinCode);
    }
    return Promise.resolve([...this.rooms.keys()]);
  }

  private purge(joinCode: string): void {
    const expires = this.expiresAt.get(joinCode);
    if (expires !== undefined && this.clock.now() >= expires) {
      this.rooms.delete(joinCode);
      this.expiresAt.delete(joinCode);
    }
  }
}
