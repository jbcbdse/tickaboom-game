import { injectable } from "inversify";

@injectable()
export class PlayerColors {
  private readonly colors: Record<0 | 1 | 2 | 3, number> = {
    0: 0xe85d4c,
    1: 0x4aa3ff,
    2: 0x3dcc7a,
    3: 0xf0c14b,
  };

  public hex(player: 0 | 1 | 2 | 3): number {
    return this.colors[player];
  }

  public css(player: 0 | 1 | 2 | 3): string {
    return `#${this.hex(player).toString(16).padStart(6, "0")}`;
  }
}
