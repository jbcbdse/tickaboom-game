import { inject, injectable } from "inversify";

import { RedisConnection } from "./RedisConnection.ts";
import type { RoomDocument } from "./RoomDocument.ts";
import { RoomDocumentCodec } from "./RoomDocumentCodec.ts";
import { RoomRepository } from "./RoomRepository.ts";

@injectable()
export class RedisRoomRepository extends RoomRepository {
  private readonly codec = new RoomDocumentCodec();

  public constructor(
    @inject(RedisConnection) private readonly redis: RedisConnection,
  ) {
    super();
  }

  public override async get(joinCode: string): Promise<RoomDocument | null> {
    const raw = await this.redis.client.get(this.key(joinCode));
    if (raw === null) {
      return null;
    }
    return this.codec.decode(raw);
  }

  public override async save(room: RoomDocument): Promise<void> {
    await this.redis.client.set(this.key(room.joinCode), this.codec.encode(room));
  }

  public override async delete(joinCode: string): Promise<void> {
    await this.redis.client.del(this.key(joinCode));
  }

  public override async expire(joinCode: string, seconds: number): Promise<void> {
    await this.redis.client.expire(this.key(joinCode), seconds);
  }

  public override async exists(joinCode: string): Promise<boolean> {
    return (await this.redis.client.exists(this.key(joinCode))) === 1;
  }

  public override async listJoinCodes(): Promise<string[]> {
    const keys = await this.redis.client.keys("room:*");
    return keys.map((key) => key.slice("room:".length));
  }

  private key(joinCode: string): string {
    return `room:${joinCode}`;
  }
}
