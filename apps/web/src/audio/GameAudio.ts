import { injectable } from "inversify";
import type { GameEvent } from "@tickaboom/engine";

import { PLACE_MS, ROUND_MS, roundDelayMs } from "../view/FxTiming.ts";

@injectable()
export class GameAudio {
  private context: AudioContext | null = null;
  private readonly harmonics = [110, 138, 165, 196, 220, 247];

  public play(events: GameEvent[]): void {
    const ctx = this.ensureContext();
    void ctx.resume();
    const now = ctx.currentTime;
    const roundCounts = new Map<number, number>();
    for (const event of events) {
      if (event.type === "exploded") {
        roundCounts.set(
          event.cascadeIndex,
          (roundCounts.get(event.cascadeIndex) ?? 0) + 1,
        );
      }
    }
    const roundIndex = new Map<number, number>();
    for (const event of events) {
      if (event.type === "pip_added") {
        this.tick(ctx, now);
      }
      if (event.type === "exploded") {
        const count = roundCounts.get(event.cascadeIndex) ?? 1;
        const index = roundIndex.get(event.cascadeIndex) ?? 0;
        roundIndex.set(event.cascadeIndex, index + 1);
        const when =
          now +
          PLACE_MS / 1000 +
          event.cascadeIndex * (ROUND_MS / 1000) +
          roundDelayMs(index, count) / 1000;
        this.boom(ctx, when);
      }
    }
  }

  private ensureContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  private tick(ctx: AudioContext, when: number): void {
    this.tone(ctx, when, 1480, 0.04, 0.08, "square");
  }

  private boom(ctx: AudioContext, when: number): void {
    const freq = this.harmonics[Math.floor(Math.random() * this.harmonics.length)] ?? 110;
    this.tone(ctx, when, freq, 0.18, 0.22, "sawtooth");
    this.tone(ctx, when, freq * 2, 0.1, 0.12, "triangle");
  }

  private tone(
    ctx: AudioContext,
    when: number,
    frequency: number,
    duration: number,
    gain: number,
    type: OscillatorType,
  ): void {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    amp.gain.setValueAtTime(gain, when);
    amp.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }
}
