import { injectable } from "inversify";

@injectable()
export class Clock {
  public now(): number {
    return Date.now();
  }
}
