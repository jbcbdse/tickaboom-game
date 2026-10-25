# Platform

Outer harness for web multiplayer games. Tickaboom (the first game) is specified in [tickaboom/DESIGN.md](tickaboom/DESIGN.md).

A plugin on this platform: join-code rooms, hot-seat or online, animated clients. Tickaboom is turn-based; later plugins may be realtime, hidden-info, or asymmetric.

## Non-goals (v1)

- Accounts, identity, or persistent users
- Matchmaking, chat, or lobbies beyond a join code
- User tracking / analytics
- Spam / abuse prevention (revisit after local + LAN play works)
- Native mobile apps (mobile web is in scope if it falls out of the web client)

## Modes

**Hot-seat.** One browser, one engine instance, no server. The client holds full plugin state and shows `viewFor` for the active seat. Fine for Tickaboom (perfect information). Hidden-info games cannot be honest hot-seat: the device has every secret. Those games are online-only, or honor-system with a pass-and-cover screen.

**Online.** One player creates a room and gets a short join code. Others join anonymously. Clients send *inputs*, never a new document, and receive only *their* view, never the authoritative blob. Redis stores the opaque game document. The room process asks the plugin to apply input, tick, and project a per-seat view. Live WebSockets stay in that process.

Same game plugin runs in hot-seat (in the browser) and online (on the server) so the rules cannot drift.

## Framework vs game

Two layers. The outer layer is a small multiplayer shell. Tickaboom is a plugin. A later game is another plugin, not a fork of the server.

```
┌──────────────────────────────────────────────┐
│  FRAMEWORK                                   │
│  rooms · join codes · seats · host · start   │
│  WebSocket transport · message envelope      │
│  React shell (landing, join, roster, start)  │
└──────────────┬───────────────────────────────┘
               │  GameRuntime (create / applyInput / tick / viewFor)
               ▼
┌──────────────────────────────────────────────┐
│  GAME (Tickaboom plugin)                     │
│  engine: board, pips, legal moves, winner    │
│  view: Three.js board + FX                   │
└──────────────────────────────────────────────┘
```

### What lives where

| | Framework (outer) | Game (plugin) |
| --- | --- | --- |
| Identity of a session | Join code, seats, host, roster, `gameId` | — |
| Phase | `lobby` / `playing` / `ended` | `playing` / `won` / `drawn` inside game state |
| Transport | WebSocket, HTTP `POST /rooms`, seat token | — |
| Who may act | Seat is connected; host may start | Whether that seat’s input is legal (turn, realtime, or role-specific) |
| State it owns | Room record + opaque `gameState` blob | Full rules state, including secrets the framework must never send |
| UI | Landing, create/join, waiting room, connection/errors | Per-seat view: board, HUD, objectives, FX |
| Messages | `room.*` (joined, roster, start, ended, error) | `game.input` in; `game.view` + events **to that seat** out |

Four kinds of state, never mixed:

- **Room state** (framework, server-owned): `{ joinCode, gameId, seats, host, phase }`.
- **Game state** (plugin, server-owned while online): full document, including hidden hands, fog, roles. The framework type is `unknown`. Only the plugin reads it. **Never broadcast this blob.**
- **Seat view** (plugin projection, sent on the wire): `viewFor(state, seat)`. What that player may know. Tickaboom’s projection is the whole board (perfect information).
- **View state** (client only): camera, animation queue, hovered cell. Never sent to the server.

### Trust model

The backend does **not** trust a client board. It also does **not** hardcode Tickaboom cells.

It understands a `GameRuntime` interface (in `@tickaboom/protocol`) and which seat sent the message:

```ts
type SeatId = string
type Spectator = "spectator"

type GameRuntime<TState, TInput, TEvent, TView> = {
  meta: { minPlayers: number; maxPlayers: number }
  create(seats: SeatId[]): TState
  applyInput(state: TState, seat: SeatId, input: TInput):
    { ok: true; state: TState; events: TEvent[] } | { ok: false; reason: string }
  /** Realtime plugins only. Tickaboom omits this. */
  tick?(state: TState, dtMs: number): { state: TState; events: TEvent[] }
  /** What this seat (or a spectator) is allowed to know. */
  viewFor(state: TState, seat: SeatId | Spectator): TView
  /** Filter FX / log lines so a draw-card event does not leak the card. */
  eventsFor(events: TEvent[], seat: SeatId | Spectator): TEvent[]
  ended(state: TState): boolean
}
```

Tickaboom: `TInput` is a cell, no `tick`, `viewFor` / `eventsFor` are identity. Rules: [tickaboom/DESIGN.md](tickaboom/DESIGN.md).

The framework never interprets `TState`, `TInput`, or `TView`. After every successful `applyInput` / `tick`, it loops connected seats and sends each `{ type: "game.view", view, events: eventsFor(...) }`. Clients render `TView` only. They do not receive `TState` and must not run `applyInput` on a guess of the full document.

That is the boardgame.io / Colyseus pattern plus **per-seat projection**, which those frameworks also use for cards and fog.

### Game kinds the platform must allow

Tickaboom is only the first plugin: turn-based, perfect information, symmetric goals. The room layer must not assume that. Three other shapes have to fit without a transport rewrite.

**Realtime action.** Same `game.input` channel; plugin implements `tick`. Inputs are frequent intents, not turns. The framework still does not simulate physics. It does not assume “one input → one shared snapshot”; it fans out `viewFor` per seat (later: deltas / interest management, still a plugin concern). Interpolation and prediction live in that game’s client view.

**Secret information.** Full state stays on the server. Hands, decks, unexplored tiles, hidden roles never go to the wire except as `viewFor` allows. Public events are stripped in `eventsFor` (“you drew the ace” vs “opponent drew a card”). Online clients highlight legal actions from **their view** (include `legalInputs` on `TView` if the UI needs them), not by rerunning the engine on a leaked blob. Spectators get `viewFor(state, "spectator")` if we add that later.

Hot-seat cannot enforce secrets. Do not pretend otherwise.

**Asymmetry.** Different goals, action sets, and HUDs are plugin data, not room types. `applyInput` already rejects “this seat cannot do that.” `viewFor` already returns a different `TView` per seat (hunter map vs quarry objectives). The shell does not assume a shared board or a shared “you won” string; the game view reads `view.role` / `view.objective` / `view.ended`. Seats are identifiers; the plugin may assign roles inside `create(seats)` (or from an opaque host `setup` blob later). Player count comes from `meta.minPlayers` / `maxPlayers`, not a hardcoded 2–4.

What the server may assume without knowing the game: the sender’s seat, that the room is `playing`, that `payload` is JSON. Turn order, fog, roles, win conditions, and whether time exists are the plugin’s problem.

How similar web games usually work:

- **Action .io** (agar, slither): server tick + input only; each client is already a partial view of a huge world. Same trust model; add `tick` + per-seat `viewFor`.
- **Hidden info** (card games, battleship, Codenames): server-authoritative state; clients get a hand or a board mask, never the deck. Same as `viewFor`.
- **Asymmetrical** (Hunt, many social-deduction games): one room, different UIs per role, still one rules plugin.
- **Host-authoritative relay:** still rejected. A host client holding `TState` *is* a leak of every secret.

We are not building a relay. v1 is friends-with-a-code and Tickaboom needs none of the extra shapes, but the contract above is what keeps the door open.

### Online flow

1. Host `POST /rooms` `{ gameId: "tickaboom" }` → `{ joinCode }`.
2. Players connect `WS /rooms/:joinCode`. Framework assigns seats and broadcasts `room.roster`.
3. Host sends `room.start` when seated count is within the plugin’s `meta` range. Framework calls `runtime.create(seats)` and stores the blob; sends each connection `room.started` + `game.view` for that seat.
4. A client sends `game.input`. Framework does not interpret the payload. Plugin accepts or rejects. Realtime plugins also get `tick` from the room loop. After a state change, fan out `viewFor` / `eventsFor` per seat — do not broadcast `TState`.
5. Room Redis key dies when the game ends, or 60s after every socket is gone. Seat token in `sessionStorage` reclaims a disconnected seat.

### Protocol envelope

Framework messages are stable across games. Game payloads are opaque to the transport.

```
room.joined / room.roster / room.start / room.ended / room.error
game.input    { payload }                         // client → server
game.view     { view, events }                    // server → that seat only
```

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript everywhere | Shared types between engine, client, and server |
| Runtime | Node.js 26 (Current) | Latest Node at spec time (26.8.x, Aug 2026). Not 24 LTS. Ride Current; pin major in `engines` / `.nvmrc`. |
| Monorepo | pnpm workspaces + Turborepo | Fast filtered builds, one lockfile |
| Bundler / web | Vite | Fast local loop for the client |
| Board / animation | Three.js | Same view stack for a flat board, 3D flair, and later 3D games |
| Shell UI | React | Cheap forms and room UI; not used to draw the board |
| Rooms (v1) | Redis `room:{joinCode}` JSON + in-process sockets | Survives process restart for 60s empty TTL; sockets do not |
| HTTP + sockets | Hono + `ws` on one Node listener | Same port. `@hono/node-server` `serve` + `ws` upgrade |
| Tests | Jest | Style default; engine and protocol are Node tests, no Vite-specific runner needed |

Deliberately not using boardgame.io or Colyseus in v1. They solve lobby/sync well but hide the move loop we want to own. Revisit only if room sync becomes the hard part.

Mobile web: Three.js + a simple responsive shell. Touch targets on the 11×11 grid need to stay large; no separate mobile app.

## View stack

Three.js is the board renderer. v1 is a flat orthographic grid with mesh pips. Perspective, 3D pieces, and FX can land later without swapping the engine or server.

The renderer is a client concern. A later multi-game backend should speak only rooms and inputs; each game can ship its own view.

Three.js is a renderer, not a full engine. Add complexity only when a game needs it:

- **Official addons** (`three/addons`) — controls, GLTF loaders, CSS labels. Enough for Tickaboom v1.
- **React Three Fiber + Drei** — optional if we want the scene in React. Not required to bootstrap.
- **GLTF/GLB** — standard art path when we want modeled pieces.
- **Postprocessing / GSAP / Theatre.js** — bloom, authored beats, explosion FX.
- **Physics (Rapier, cannon-es)** — only if booms should simulate debris instead of tweening.

**ECS** (entity-component-system: ids + data components + per-frame systems) exists next to Three.js — Miniplex in the R3F crowd, bitECS if entity counts get huge. Tickaboom does not use one. The board is an 11×11 array and turns are discrete; `engine` stays a state machine. Revisit ECS only for a later simulation-heavy game.

**Why not Phaser (reconfirmed, 2026-08).** Latest open-source Phaser is **4.2.1** (April 2026 major, 4.2.1 on npm). It is a better 2D engine than v3 (new WebGL renderer, filters, GPU sprite/tile layers) and a worse 3D story than v3: Mesh, Plane, Camera3D, and Layer3D were removed. Phaser Studio’s July 2026 line is explicit: Phaser 4 stays 2D; the 3D in their demos is **Phaser AE**, a closed-source agentic engine for the Game Agent, not a library we import, and those 3D features are “almost certainly not” coming to Phaser 4. `phas3d` is an experimental fork marked not for production. Keep Three.js for Tickaboom and later 3D titles. A later *2D* game may still use Phaser 4 as *its* view; that is a per-game client choice, not a platform swap.

## Monorepo layout

```
tickaboom/
  DESIGN.md            Tickaboom rules and view
apps/
  web/                 Framework shell (React) + Tickaboom Three.js view
  server/              Framework rooms + WS; loads game plugins
packages/
  protocol/            Room envelope + GameRuntime interface
  engine/              Tickaboom plugin (create / applyInput / viewFor)
docker-compose.yml     Redis 7 for local rooms
```

`web` depends on `protocol` + `engine` (hot-seat; Tickaboom `viewFor` is the full board).
`server` depends on `protocol` + `engine` (registers `tickaboom`).
`engine` depends on `protocol`. It does not import sockets or Three.js.

Later games add another engine package and a view; they register on the same server. Do not put Tickaboom cell types in `protocol`.

Package manager scripts: `pnpm --filter web dev` for hot-seat; `pnpm dev` runs web + server; `docker compose up -d` for Redis; `pnpm test` runs Jest.

## Build order

Start with the game. The harness waits.

**Milestone 1 — fun (hot-seat).** `packages/engine` (Tickaboom rules as a class that already looks like `GameRuntime`) + `apps/web` (React chrome + Three.js board). Two to four players on one machine. No join codes, no Hono, no sockets. Inversify composition root lives in the web app only.

**Milestone 2 — harness (this).** `packages/protocol` + `apps/server` + web shell. Same engine in rooms, Redis blob, `viewFor` fan-out, `game.input`. Tickaboom’s projection stays identity. Seat tokens and 60s empty TTL are in.

Do not put rules in the Three.js scene, and do not have the client send a board document.

## Code style

Applies to every package. Tickaboom engine sketch lives in [tickaboom/DESIGN.md](tickaboom/DESIGN.md); those shapes become classes when we bootstrap.

**Lint.** ESLint 9 flat config + `typescript-eslint`. Enable `strictTypeChecked` and `stylisticTypeChecked` (and keep them on). Type-aware linting is required, not optional. Add `eslint-plugin-jest` for tests. Use `no-restricted-imports` (or equivalent) so consumers cannot import past a folder’s `index.ts`.

**tsconfig.** Latest stable TypeScript. We are not publishing a library for old runtimes. Shared strict baseline, then per-app module settings (`bundler` for Vite, `NodeNext` for the server).

- Runtime: **Node 26**. `package.json` `"engines": { "node": ">=26 <27" }`, `.nvmrc` / `.node-version` = `26`. Types from `@types/node` matching 26 (or Node’s own types if that’s current).
- `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- `target` / `lib`: what Node 26 runs natively (ES2024 / ES2025 at bootstrap), not a downlevel
- `isolatedModules`, `verbatimModuleSyntax`, `skipLibCheck`
- No `downlevelIteration`, no `esModuleInterop` unless a dep forces it

The only concession: Inversify needs `experimentalDecorators` and `emitDecoratorMetadata`, plus a `reflect-metadata` import at each process entry. Native TC39 decorators do not have parameter decorators, so we stay on the legacy decorator emit for DI. Do not weaken anything else to make that work.

**Tests.** Jest (`ts-jest` or SWC). One Jest project per package. Engine tests are the ones that must not drift; protocol and server get tests as they grow. No Vitest unless Jest cannot run a specific browser runner we actually need.

**Dependency injection.** Constructor injection everywhere it is reasonable. **Inversify** is the container. Bind interfaces to classes in composition roots (`apps/web`, `apps/server`); packages export classes and tokens, not a secretly-built container. Tests bind fakes the same way. Do not `new` a collaborator inside a class when it can be injected.

**Classes and files.**

- Prefer classes, including for logic that could be a pure function. Easier to inject and mock.
- One class per file. File name matches the class.
- Prefer a private method on the owning class over a single-use helper in `utils.ts`.
- No grab-bag `utils/` for game rules.

**Modules.** Group by entity, not by layer dump (`Player/`, not `all-the-services/`). A folder may hold several classes that together are “Player”. Each subdirectory has an `index.ts` that re-exports only the public surface. Outside that folder, import the index — never a nested file.

```
player/
  index.ts              // export { Player, PlayerId } only
  Player.ts
  PlayerSeat.ts
  PlayerView.ts         // not imported from outside player/
```

`from "@tickaboom/engine"` or `from "../player"` is good. `from "../player/PlayerSeat"` is not.

## Server sketch (framework, v1)

- One listener. Local: `http` + `ws` on one port. Production: one TLS listener, `https` and `wss`. No second socket server.
- `GET /games`, `POST /rooms` `{ gameId }` → `{ joinCode }` (6 chars, unambiguous alphabet).
- `WS /rooms/:joinCode` → next seat, or `?token=` to reclaim.
- Redis owns the room document and `gameState` blob. Never applies a client-supplied document. Never sends that blob to clients.
- On `game.input`, calls the registered plugin; does not parse game fields. Fans out `viewFor` per connected seat. No tick loop until a plugin registers one.
- Seat count from plugin `meta`. `room.start` only from the host, only when seated count is in range.
- No auth. Seat token in `sessionStorage`. Lobby disconnect drops the seat and promotes host. Play disconnect waits (Tickaboom). Empty room `EXPIRE` 60s.
- Per-package notes: [packages/protocol/DESIGN.md](packages/protocol/DESIGN.md), [apps/server/DESIGN.md](apps/server/DESIGN.md), [apps/web/DESIGN.md](apps/web/DESIGN.md).

## Client sketch

**Shell (framework):** landing (hot-seat vs create vs join), waiting room (roster + start), connection status, result chrome.

**View (game):** Tickaboom’s Three.js board — see [tickaboom/DESIGN.md](tickaboom/DESIGN.md). Shell stays generic.

Online clients send `game.input` and render `game.view`. They never hold `TState`. Legal-cell highlights come from the view (or a pure function of the view), not from applying the engine to a leaked full board. View state (camera, tweens) stays local. A later game’s view may be a different HUD per `view.role`; the shell stays generic.

## Deploy

**This milestone:** `docker compose up -d` Redis + `pnpm dev` on the machine.

**Next ops look:** deploy **locally to k8s** (kind/k3d or similar) so the server, web, and Redis are real cluster services. Manifests are not in this milestone.

**Later milestone:** a **cheap AWS** shape with **API Gateway** (HTTP + WebSocket APIs) in front of the room server. Today’s server is a **long-lived Node process holding sockets**. APIGW WebSocket connection IDs would replace the in-process map; that is a contract change, not a lift-and-shift. Do not pick Lambda vs ECS vs a single box yet.

TLS still terminates on the one listener (or a proxy in front of it); `https` + `wss` as one origin.

## What we are not deciding yet

Tickaboom rules: [tickaboom/DESIGN.md](tickaboom/DESIGN.md).

Rate limits. Redis pub/sub for multiple Node processes. Spectators, names, extra a11y.

Polish: platform-level sound, colors beyond Tickaboom.

## Open questions

Resolved for v1:

1. **Host disconnect (lobby)** — drop the seat; promote the oldest remaining player.
2. **Play disconnect** — framework only tracks presence. Tickaboom waits. Empty room (all sockets gone) expires in 60s.
3. **Hot-seat + online in one room** — out of scope for v1.
