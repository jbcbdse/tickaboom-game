declare const seatIdBrand: unique symbol;
export type SeatId = string & { readonly [seatIdBrand]: true };
export type Spectator = "spectator";

export interface GameRuntime<TState, TInput, TEvent, TView> {
  readonly meta: { minPlayers: number; maxPlayers: number };
  create(seats: SeatId[]): TState;
  applyInput(
    state: TState,
    seat: SeatId,
    input: TInput,
  ):
    | { ok: true; state: TState; events: TEvent[] }
    | { ok: false; reason: string };
  /** Realtime plugins only. Tickaboom omits this. */
  tick?(state: TState, dtMs: number): { state: TState; events: TEvent[] };
  viewFor(state: TState, seat: SeatId | Spectator): TView;
  eventsFor(events: TEvent[], seat: SeatId | Spectator): TEvent[];
  ended(state: TState): boolean;
}
