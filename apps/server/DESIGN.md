# Server

Room harness. HTTP + WebSocket on one Node listener. Plugins register by `gameId`. Detail: [../../DESIGN.md](../../DESIGN.md).

## Routes

- `GET /games` — registered plugins
- `POST /rooms` `{ gameId }` → `{ joinCode }` (6 chars, unambiguous alphabet)
- Upgrade `WS /rooms/:joinCode` (`?token=` to reclaim)

## Store

Redis is the source of truth for the room document and the opaque `gameState` blob. Key `room:{joinCode}`.

Live sockets stay in this process. A socket cannot live in Redis. Per-room mutex serializes `applyInput`.

Empty rooms: `EXPIRE` 60s after the last connection drops; any connect persists the key. Process restart marks every seat disconnected and expires all keys at 60s so players can reclaim.

## Disconnect

- **Lobby:** drop the seat; promote the oldest remaining seat as host.
- **Playing:** keep the seat, `connected: false`, broadcast roster. Do not skip turns. Tickaboom waits.
- **Reconnect:** matching `seatToken` reclaims; a live duplicate takes over (old socket closed).

## Non-goals (this package)

Auth, chat, matchmaking, tick loop until a plugin implements `tick`, Redis pub/sub for multiple Node processes.
