import type { PlayerId } from "@tickaboom/engine";

import type { PlayerColors } from "../view";

interface ResultScreenProps {
  winner: PlayerId | null;
  colors: PlayerColors;
  onAgain: () => void;
}

export function ResultScreen({ winner, colors, onAgain }: ResultScreenProps) {
  const title =
    winner === null ? "Draw" : `Player ${String(winner + 1)} wins`;
  return (
    <div className="result-overlay">
      <div className="result-banner">
        <h1 style={winner !== null ? { color: colors.css(winner) } : undefined}>
          {title}
        </h1>
        <button type="button" onClick={onAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
