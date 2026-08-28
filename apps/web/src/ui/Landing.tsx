import type { PlayerColors } from "../view";

interface LandingProps {
  colors: PlayerColors;
  onStart: (playerCount: 2 | 3 | 4) => void;
}

export function Landing({ colors, onStart }: LandingProps) {
  return (
    <div className="panel">
      <h1>Tickaboom</h1>
      <p>Hot-seat. Pass the machine after each turn.</p>
      <div className="row">
        {([2, 3, 4] as const).map((count) => (
          <button key={count} type="button" onClick={() => { onStart(count); }}>
            {count} players
          </button>
        ))}
      </div>
      <div className="legend">
        {([0, 1, 2, 3] as const).map((player) => (
          <span key={player} className="swatch">
            <i style={{ background: colors.css(player) }} />P{player + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
