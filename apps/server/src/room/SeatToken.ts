import { randomBytes } from "node:crypto";

import { injectable } from "inversify";

@injectable()
export class SeatToken {
  public generate(): string {
    return randomBytes(18).toString("base64url");
  }
}
