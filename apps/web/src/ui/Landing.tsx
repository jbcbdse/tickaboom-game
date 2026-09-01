import type { GameInfo } from "@tickaboom/protocol";

import type { PlayerColors } from "../view";

interface LandingProps {
  colors: PlayerColors;
  games: GameInfo[];
  error: string | null;
  onHotSeat: (gameId: string, playerCount: 2 | 3 | 4) => void;
  onCreate: (gameId: string) => void;
  onJoin: (joinCode: string) => void;
}

export function Landing({
  colors,
  games,
  error,
  onHotSeat,
  onCreate,
  onJoin,
}: LandingProps) {
  return (
    <div className="panel">
      <h1>Games</h1>
      {error !== null && <p className="error">{error}</p>}
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          colors={colors}
          onHotSeat={onHotSeat}
          onCreate={onCreate}
          onJoin={onJoin}
        />
      ))}
    </div>
  );
}

function GameCard({
  game,
  colors,
  onHotSeat,
  onCreate,
  onJoin,
}: {
  game: GameInfo;
  colors: PlayerColors;
  onHotSeat: (gameId: string, playerCount: 2 | 3 | 4) => void;
  onCreate: (gameId: string) => void;
  onJoin: (joinCode: string) => void;
}) {
  const counts = ([2, 3, 4] as const).filter(
    (count) => count >= game.minPlayers && count <= game.maxPlayers,
  );
  return (
    <section className="game-card">
      <h2>{game.name}</h2>
      <p>Hot-seat. Pass the machine after each turn.</p>
      <div className="row">
        {counts.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => {
              onHotSeat(game.id, count);
            }}
          >
            {count} players
          </button>
        ))}
      </div>
      <p>Online. Create a room or join with a code.</p>
      <div className="row">
        <button
          type="button"
          onClick={() => {
            onCreate(game.id);
          }}
        >
          Create room
        </button>
        <JoinField onJoin={onJoin} />
      </div>
      <div className="legend">
        {([0, 1, 2, 3] as const).map((player) => (
          <span key={player} className="swatch">
            <i style={{ background: colors.css(player) }} />P{player + 1}
          </span>
        ))}
      </div>
    </section>
  );
}

function JoinField({ onJoin }: { onJoin: (joinCode: string) => void }) {
  return (
    <form
      className="join"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const field = form.elements.namedItem("code");
        if (!(field instanceof HTMLInputElement)) {
          return;
        }
        const code = field.value.trim().toUpperCase();
        if (code !== "") {
          onJoin(code);
        }
      }}
    >
      <input name="code" placeholder="Room code" maxLength={8} autoCapitalize="characters" />
      <button type="submit">Join</button>
    </form>
  );
}
