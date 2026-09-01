import { createClient, type RedisClientType } from "redis";
import { injectable } from "inversify";

@injectable()
export class RedisConnection {
  public readonly client: RedisClientType;

  public constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    });
  }

  public async connect(): Promise<void> {
    await this.client.connect();
  }
}
