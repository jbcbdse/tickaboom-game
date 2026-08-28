import { injectable } from "inversify";

import { Coordinate } from "./Coordinate.ts";

@injectable()
export class BoardGeometry {
  public readonly size = 11;
  public readonly maxIndex = 10;

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x <= this.maxIndex && y <= this.maxIndex;
  }

  public neighbors(x: number, y: number): Coordinate[] {
    const deltas: [number, number][] = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    const result: Coordinate[] = [];
    for (const [dx, dy] of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.inBounds(nx, ny)) {
        result.push(new Coordinate(nx, ny));
      }
    }
    return result;
  }

  public capacity(x: number, y: number): number {
    return this.neighbors(x, y).length - 1;
  }

  public home(seatIndex: number): Coordinate {
    const homes: Coordinate[] = [
      new Coordinate(0, 0),
      new Coordinate(this.maxIndex, 0),
      new Coordinate(0, this.maxIndex),
      new Coordinate(this.maxIndex, this.maxIndex),
    ];
    const home = homes[seatIndex];
    if (!home) {
      throw new Error(`No home corner for seat ${String(seatIndex)}`);
    }
    return home;
  }
}
