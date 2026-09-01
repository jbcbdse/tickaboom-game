import { injectable } from "inversify";

import type { RoomDocument } from "./RoomDocument.ts";

@injectable()
export abstract class RoomRepository {
  public abstract get(joinCode: string): Promise<RoomDocument | null>;
  public abstract save(room: RoomDocument): Promise<void>;
  public abstract delete(joinCode: string): Promise<void>;
  public abstract expire(joinCode: string, seconds: number): Promise<void>;
  public abstract exists(joinCode: string): Promise<boolean>;
  public abstract listJoinCodes(): Promise<string[]>;
}
