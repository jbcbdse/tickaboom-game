import type { RosterSeat, SeatId } from "@tickaboom/protocol";

interface WaitingRoomProps {
  joinCode: string;
  host: boolean;
  hostSeat: SeatId | null;
  seats: RosterSeat[];
  minPlayers: number;
  error: string | null;
  onStart: () => void;
  onLeave: () => void;
}

export function WaitingRoom({
  joinCode,
  host,
  hostSeat,
  seats,
  minPlayers,
  error,
  onStart,
  onLeave,
}: WaitingRoomProps) {
  const canStart = host && seats.length >= minPlayers;
  return (
    <div className="panel">
      <h1>Waiting room</h1>
      <p className="code">{joinCode}</p>
      <p>Share that code. {host ? "You are the host." : "Waiting for the host to start."}</p>
      {error !== null && <p className="error">{error}</p>}
      <ul className="roster">
        {seats.map((seat) => (
          <li key={seat.seat}>
            Seat {seat.seat}
            {seat.seat === hostSeat ? " · host" : ""}
            {seat.connected ? "" : " · disconnected"}
          </li>
        ))}
      </ul>
      <div className="row">
        {host && (
          <button type="button" disabled={!canStart} onClick={onStart}>
            Start
          </button>
        )}
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}
