import { injectable } from "inversify";

export type PlayerId = 0 | 1 | 2 | 3;

@injectable()
export class PlayerIdFactory {
  fromSeatIndex(index: number): PlayerId {
    if (index < 0 || index > 3) {
      throw new Error(`Seat index ${String(index)} is not a PlayerId`);
    }
    return index as PlayerId;
  }
}
