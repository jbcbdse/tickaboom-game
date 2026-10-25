import { randomInt } from "node:crypto";

import { injectable } from "inversify";

@injectable()
export class JoinCode {
  private static readonly alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static readonly size = 6;

  public generate(): string {
    const chars: string[] = [];
    while (chars.length < JoinCode.size) {
      const index = randomInt(JoinCode.alphabet.length);
      const char = JoinCode.alphabet[index];
      if (char === undefined) {
        throw new Error("Join code alphabet miss");
      }
      chars.push(char);
    }
    return chars.join("");
  }
}
