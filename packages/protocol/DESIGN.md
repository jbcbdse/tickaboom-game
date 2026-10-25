# Protocol

Shared types for the harness. No Tickaboom cells, moves, or events.

Package: `@tickaboom/protocol`.

## GameRuntime

Lives here, not in the engine. Plugins implement it. Optional `tick` is for later realtime games; Tickaboom omits it.

`SeatId` is an opaque branded string assigned by the room layer. `"spectator"` is a viewer, not a seat.

The framework never interprets `TState`, `TInput`, or `TView`. After `applyInput` / `tick` it fans out `viewFor` / `eventsFor` per connected seat.

## Envelope

Stable across games. Payloads are opaque JSON.

Client → server: `room.start`, `game.input { payload }`.

Server → client: `room.joined`, `room.roster`, `room.started`, `room.ended`, `room.error`, `game.view { view, events }`.

`game.view` is sent to **that seat only**. Never send `TState`.

## Catalog

`GameInfo`: `{ id, name, minPlayers, maxPlayers }` for `GET /games`. Player counts come from plugin `meta`.
