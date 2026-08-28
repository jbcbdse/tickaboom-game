export type SeatId = `${number}`;
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
  viewFor(state: TState, seat: SeatId | Spectator): TView;
  eventsFor(events: TEvent[], seat: SeatId | Spectator): TEvent[];
  ended(state: TState): boolean;
}
