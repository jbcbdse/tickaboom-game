import type { GameEvent, GameState, Move, SeatId } from "@tickaboom/engine";
import { TickaboomEngine } from "@tickaboom/engine";

export class HotSeatSession {
  public constructor(
    private readonly engine: TickaboomEngine,
    private state: GameState,
  ) {}

  public static start(
    engine: TickaboomEngine,
    playerCount: 2 | 3 | 4,
  ): HotSeatSession {
    const seats: SeatId[] = [];
    for (let i = 0; i < playerCount; i += 1) {
      seats.push(String(i) as SeatId);
    }
    return new HotSeatSession(engine, engine.create(seats));
  }

  public getState(): GameState {
    return this.state;
  }

  public currentSeat(): SeatId {
    const seat = this.state.seats[this.state.current];
    if (seat === undefined) {
      throw new Error("Missing current seat");
    }
    return seat;
  }

  public legalMoves(): Move[] {
    return this.engine.legalMoves(this.state, this.state.current);
  }

  public pipCount(player: 0 | 1 | 2 | 3): number {
    return this.engine.pipCount(this.state, player);
  }

  public place(x: number, y: number): GameEvent[] | null {
    const result = this.engine.applyInput(this.state, this.currentSeat(), {
      x,
      y,
    });
    if (!result.ok) {
      return null;
    }
    this.state = result.state;
    return result.events;
  }
}
