# tickaboom-game

A platform for web multiplayer games, with Tickaboom as the first game.

## What it is

Tickaboom is a turn-based board game for 2 to 4 players on an 11x11 grid. Players place pips, and full cells explode into neighbors and capture them. A player wins when all other players have no pips left.

You can play in two modes:

- **Hot-seat.** Players share one browser. The engine runs in the client. No server is needed.
- **Online.** One player creates a room and gets a 6-character join code. Friends join with the code. The server runs the rules.

## Architecture

The repo is a pnpm and Turborepo monorepo.

```
apps/
  web/        React shell and Three.js board (Vite)
  server/     Hono HTTP and ws WebSocket rooms, Redis storage
packages/
  protocol/   Room messages and the GameRuntime interface
  engine/     Tickaboom rules, as a GameRuntime plugin
tickaboom/    Game rules and view design
```

- **Framework and game are separate.** The server knows rooms, seats, and join codes. It does not know Tickaboom cells. A game is a plugin that implements `GameRuntime`: `create`, `applyInput`, `viewFor`, `eventsFor`, `ended`.
- **One engine, two places.** The same `engine` package runs in the browser (hot-seat) and on the server (online). The rules cannot drift.
- **Server is authoritative.** Clients send inputs, never a board. The server sends each seat only its own view. It never sends the full game state.
- **Web client.** React draws the lobby and room screens. Three.js draws the board. The engine has no Three.js or socket code.
- **Redis.** Redis holds the room record and the opaque game state under `room:{joinCode}`. An empty room expires after 60 seconds. A seat token in `sessionStorage` lets a player reclaim a seat after a disconnect.
- **Dependency injection.** Inversify wires the web and server composition roots.

## Tech stack

- TypeScript, Node.js 26
- pnpm workspaces, Turborepo
- React 19, Three.js, Vite
- Hono, `ws`, Redis 7
- Jest (with SWC), ESLint with `typescript-eslint`
- Inversify

## Run it locally

You need Node 26, pnpm 10, and Docker (for Redis).

```
pnpm install
docker compose up -d     # Redis on 127.0.0.1:6379
pnpm dev                 # web on :5173, server on :8787
```

Open http://localhost:5173. The Vite dev server proxies `/games` and `/rooms` to the server.

For hot-seat only, you do not need Redis or the server:

```
pnpm --filter web dev
```

Other commands:

```
pnpm test     # Jest, all packages
pnpm lint     # ESLint
pnpm build    # Turborepo build
```

The server reads `PORT` (default `8787`) and `REDIS_URL` (default `redis://127.0.0.1:6379`).

## Status

- **Milestone 1: hot-seat.** Done. Engine and web client with a Three.js board.
- **Milestone 2: harness.** Done on the `milestone-2-harness` branch. This adds the protocol package, the server, join-code rooms, seat tokens, and per-seat views.
- **Next.** Run the server, web, and Redis in a local Kubernetes cluster. A later step is a low-cost AWS deploy. There are no manifests yet.

## Design decisions and non-goals

- **No accounts, matchmaking, chat, analytics, or abuse prevention in v1.** Joining needs only a code.
- **No relay.** A host client that holds full state would leak secrets in hidden-information games. The server keeps the state.
- **Hot-seat cannot hide secrets.** Hidden-information games would be online-only.
- **No tick loop yet.** Tickaboom is turn-based. The interface allows an optional `tick` for realtime games.
- **A disconnected player waits.** The game does not skip their turn.
- **Three.js, not Phaser.** Phaser 4 dropped its 3D support. Three.js keeps the door open for 3D games.
- **No boardgame.io or Colyseus.** The project owns the move loop on purpose.
- **No ECS.** The board is a plain array and turns are discrete.
- **Strict code style.** Strict TypeScript, type-aware ESLint, one class per file, and `index.ts` as the only import surface for each folder.

See [DESIGN.md](DESIGN.md) and [tickaboom/DESIGN.md](tickaboom/DESIGN.md) for the full design.
