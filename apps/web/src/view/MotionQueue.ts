export class MotionQueue {
  private readonly items: {
    key?: object;
    start: number;
    duration: number;
    apply: (t: number) => void;
    resolve: () => void;
  }[] = [];

  public play(
    durationMs: number,
    apply: (t: number) => void,
    key?: object,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (key) {
        this.finish(key);
      }
      if (durationMs <= 0) {
        apply(1);
        resolve();
        return;
      }
      const item: (typeof this.items)[number] = {
        start: performance.now(),
        duration: durationMs,
        apply,
        resolve,
      };
      if (key) {
        item.key = key;
      }
      this.items.push(item);
    });
  }

  public finish(key: object): void {
    const remaining: typeof this.items = [];
    for (const item of this.items) {
      if (item.key === key) {
        item.apply(1);
        item.resolve();
      } else {
        remaining.push(item);
      }
    }
    this.items.length = 0;
    this.items.push(...remaining);
  }

  public tick(now: number): void {
    const remaining: typeof this.items = [];
    for (const item of this.items) {
      const u = Math.min(1, (now - item.start) / item.duration);
      item.apply(u);
      if (u >= 1) {
        item.resolve();
      } else {
        remaining.push(item);
      }
    }
    this.items.length = 0;
    this.items.push(...remaining);
  }

  public cancel(): void {
    for (const item of this.items) {
      item.apply(1);
      item.resolve();
    }
    this.items.length = 0;
  }

  public static easeOutBack(t: number): number {
    const overshoot = 1.70158;
    const inner = t - 1;
    return 1 + (overshoot + 1) * inner * inner * inner + overshoot * inner * inner;
  }

  public static easeInOutCubic(t: number): number {
    if (t < 0.5) {
      return 4 * t * t * t;
    }
    const inverted = -2 * t + 2;
    return 1 - (inverted * inverted * inverted) / 2;
  }
}
