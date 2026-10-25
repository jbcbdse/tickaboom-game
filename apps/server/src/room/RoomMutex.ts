import { injectable } from "inversify";

@injectable()
export class RoomMutex {
  private readonly tails = new Map<string, Promise<void>>();

  public async run<T>(joinCode: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(joinCode) ?? Promise.resolve();
    let release: () => void = () => {
      /* set below */
    };
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(
      joinCode,
      previous.then(() => current),
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
