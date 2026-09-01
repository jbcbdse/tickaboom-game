# Tickaboom

Game rules and view. Platform, rooms, and transport live in [../DESIGN.md](../DESIGN.md).

Milestone 1 (hot-seat) is done. Online uses the same engine on the server; `viewFor` stays identity. A disconnected seat waits — the game does not skip their turn. Legal highlights on an online client are computed from the received view, not from `applyInput`.

## Shape (locked)

- Turn-based board game with animations. Not realtime: no `tick`.
- Perfect information: `viewFor` is the full board; `eventsFor` is identity.
- Symmetric goals. 2–4 players.
- Input is a cell: `{ x, y }`.
- `meta`: `{ minPlayers: 2, maxPlayers: 4 }`.

## Rules

### Board

- 11×11 grid.

### Setup

- Each player starts with 1 pip in their home corner.
- Map 2 / 3 / 4 players onto corners:

  | Players | Homes |
  | 1 | NW |
  | 2 | NE | 
  | 3 | SW | 
  | 4 | SE |


### Placement

- A player places a pip on a square they already own, or on an unoccupied square adjacent to one they already own.
- Adjacency orthogonal, not diagonal.

### Boom / overflow

- What happens when a cell fills: _TBD_.
- Max pips per cell: corner = 1, side = 2, center/all else = 3
- Chain reactions: When a player over-fills a square, it explodes into the adjacent squares, capturing that square for the current player

### Capture / conversion

- When exploding into an occupied square the current player will captue it

### Winning / losing / draw

Players are eliminated when the player has no more pips / occupied squares. A player wins when all others are eliminated

### Other

Players must always take a turn.

## Engine contract

Class in `packages/engine` implements `GameRuntime` from `@tickaboom/protocol`. No sockets, no Three.js.

```ts
type PlayerId = 0 | 1 | 2 | 3
type Cell = { owner: PlayerId | null; pips: number }
type Board = Cell[][] // 11 x 11

type GameState = {
  board: Board
  players: PlayerId[]
  current: PlayerId
  status: "playing" | "won" | "drawn"
  winner: PlayerId | null
}

type Move = { x: number; y: number }
type Event = { type: string; /* fill from rules: pip_added, exploded, … */ }

create(seats: SeatId[]): GameState
applyInput(state: GameState, seat: SeatId, input: Move):
  { ok: true; state: GameState; events: Event[] } | { ok: false; reason: string }
viewFor(state: GameState, seat: SeatId | "spectator"): GameState // identity
eventsFor(events: Event[], seat: SeatId | "spectator"): Event[] // identity
ended(state: GameState): boolean
```

Extend `GameState` / `Event` when the rules need it. Do not put Tickaboom fields in `packages/protocol`.

## View

Three.js, orthographic grid, pip meshes. No ECS.

When playing a pip, play 'tick' sound effect.

When a square explodes, play a boom sound. There will be a cascade of boom sounds, so we need an array of boom sounds that sound chaotic but harmonic together.

Score is the number of pips. Score can be displayed either as a number or as a shared battle meter.

Events from the engine drive FX (do not infer animations from a board diff). List event types here once rules exist:

- _TBD_ (`pip_added`, …)

Illegal click (ignore / shake / explain): Simply don't indicate that the square is touchable.

Player colors: _TBD._

