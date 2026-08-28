import type { GameState, PlayerId } from "@tickaboom/engine";

import type { PlayerColors } from "../view";

interface PlayHudProps {
  state: GameState;
  colors: PlayerColors;
}

export function PlayHud({ state, colors }: PlayHudProps) {
  const total = state.players.reduce<number>(
    (sum, player) => sum + pipCount(state, player),
    0,
  );
  const headline =
    state.status === "won" && state.winner !== null
      ? `Player ${String(state.winner + 1)} wins`
      : state.status === "drawn"
        ? "Draw"
        : `Player ${String(state.current + 1)}'s turn`;
  return (
    <div className="hud">
      <div
        className="turn"
        style={
          state.winner !== null
            ? { color: colors.css(state.winner) }
            : undefined
        }
      >
        {headline}
      </div>
      <div className="meter">
        {state.players.map((player) => {
          const pips = pipCount(state, player);
          const width = total === 0 ? 0 : (pips / total) * 100;
          return (
            <div
              key={player}
              className="meter-seg"
              style={{ width: `${String(width)}%`, background: colors.css(player) }}
              title={`P${String(player + 1)}: ${String(pips)}`}
            />
          );
        })}
      </div>
      <div className="scores">
        {state.players.map((player) => (
          <span
            key={player}
            className={player === state.current && !ended(state) ? "score current" : "score"}
            style={{ color: colors.css(player) }}
          >
            P{player + 1} · {pipCount(state, player)}
          </span>
        ))}
      </div>
    </div>
  );
}

function pipCount(state: GameState, player: PlayerId): number {
  let total = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.owner === player) {
        total += cell.pips;
      }
    }
  }
  return total;
}

function ended(state: GameState): boolean {
  return state.status !== "playing";
}
