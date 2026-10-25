# Web

React shell + Tickaboom Three.js view. Platform: [../../DESIGN.md](../../DESIGN.md). Game view: [../../tickaboom/DESIGN.md](../../tickaboom/DESIGN.md).

## Shell

Landing: game list (`GET /games`, local fallback), hot-seat, create room, join by code.

Waiting room: join code, roster, host **Start**.

Play: game view only. Connection status and disconnected seats are shell chrome on the HUD.

Result: existing overlay; **Play again** returns to landing.

## Sessions

**Hot-seat:** client holds `TState` and calls `applyInput` locally.

**Online:** `OnlineSession` sends `game.input` and renders `game.view`. It does not call `applyInput`. Seat token in `sessionStorage` keyed by join code.

Tickaboom legal highlights are a pure function of the received view (`legalMoves` on that board) and only for this seat’s turn.

## Dev

Vite proxies `/games` and `/rooms` (including WebSocket) to the server on port 8787. `pnpm dev` runs web + server.
