import { useEffect, useRef, useState } from "react";
import type { GameState, Move, PlayerId } from "@tickaboom/engine";
import type { GameInfo, RosterSeat, SeatId } from "@tickaboom/protocol";

import { RoomApi } from "./api";
import { GameCatalog } from "./catalog";
import { AppContainer } from "./composition";
import {
  HotSeatSession,
  OnlineSession,
  SeatTokenStore,
  TickaboomView,
} from "./session";
import { Landing, PlayHud, ResultScreen, WaitingRoom } from "./ui";
import { BoardView } from "./view";

const app = new AppContainer();
const api = new RoomApi();
const catalog = new GameCatalog();
const tokens = new SeatTokenStore();
const views = new TickaboomView();

type Phase = "landing" | "lobby" | "hotseat" | "online";

export function App() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [games, setGames] = useState<GameInfo[]>(catalog.fallback);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<GameState | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [host, setHost] = useState(false);
  const [hostSeat, setHostSeat] = useState<SeatId | null>(null);
  const [roster, setRoster] = useState<RosterSeat[]>([]);
  const [minPlayers, setMinPlayers] = useState(2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<BoardView | null>(null);
  const hotSeatRef = useRef<HotSeatSession | null>(null);
  const onlineRef = useRef<OnlineSession | null>(null);
  const mySeatRef = useRef<SeatId | null>(null);
  const shownRef = useRef<GameState | null>(null);
  shownRef.current = shown;
  const onlineReady = phase === "online" && shown !== null;

  useEffect(() => {
    void api.listGames().then((listed) => {
      if (listed !== null && listed.length > 0) {
        setGames(listed);
      }
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const session = hotSeatRef.current;
    if (!canvas || phase !== "hotseat" || session === null) {
      return;
    }
    const view = new BoardView(
      canvas,
      (x, y) => {
        if (view.isBusy() || session.getState().status !== "playing") {
          return;
        }
        const events = session.place(x, y);
        if (!events) {
          return;
        }
        app.audio.play(events);
        const next = session.getState();
        const legal = next.status === "playing" ? session.legalMoves() : [];
        view.playEvents(events, next, legal, () => {
          setShown(next);
        });
      },
      app.colors,
    );
    viewRef.current = view;
    view.setState(session.getState(), session.legalMoves());
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const state = shownRef.current;
    if (!canvas || !onlineReady || state === null) {
      return;
    }
    const view = new BoardView(
      canvas,
      (x, y) => {
        if (view.isBusy()) {
          return;
        }
        onlineRef.current?.sendInput({ x, y });
      },
      app.colors,
    );
    viewRef.current = view;
    view.setState(state, legalFor(state, mySeatRef.current));
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, [onlineReady]);

  function resetToLanding(): void {
    onlineRef.current?.close();
    onlineRef.current = null;
    hotSeatRef.current = null;
    mySeatRef.current = null;
    setPhase("landing");
    setShown(null);
    setError(null);
    setJoinCode("");
    setHost(false);
    setHostSeat(null);
    setRoster([]);
  }

  function connectOnline(code: string, token?: string): void {
    onlineRef.current?.close();
    const session = new OnlineSession({
      onJoined: (message) => {
        tokens.set(message.joinCode, message.seatToken);
        mySeatRef.current = message.seat;
        setJoinCode(message.joinCode);
        setHost(message.host);
        setError(null);
      },
      onRoster: (message) => {
        setHostSeat(message.hostSeat);
        setRoster(message.seats);
        setHost(mySeatRef.current === message.hostSeat);
      },
      onStarted: () => {
        setPhase("online");
      },
      onView: (rawView, rawEvents) => {
        const next = views.parseState(rawView);
        const events = views.parseEvents(rawEvents);
        if (next === null || events === null) {
          return;
        }
        const board = viewRef.current;
        if (board !== null && events.length > 0 && !board.isBusy()) {
          app.audio.play(events);
          board.playEvents(events, next, legalFor(next, mySeatRef.current), () => {
            setShown(next);
          });
          return;
        }
        board?.setState(next, legalFor(next, mySeatRef.current));
        setShown(next);
      },
      onEnded: (reason) => {
        if (reason === "empty_timeout") {
          setError("Room expired");
          resetToLanding();
        }
      },
      onError: (reason) => {
        setError(reason);
        if (reason === "room_not_found" || reason === "invalid_token") {
          onlineRef.current?.close();
          setPhase("landing");
        }
      },
    });
    onlineRef.current = session;
    session.connect(code, token);
    setPhase((current) => (current === "online" ? "online" : "lobby"));
    setJoinCode(code);
    setError(null);
  }

  async function createRoom(gameId: string): Promise<void> {
    const result = await api.createRoom(gameId);
    if ("reason" in result) {
      setError(result.reason);
      return;
    }
    const info = games.find((game) => game.id === gameId);
    setMinPlayers(info?.minPlayers ?? 2);
    connectOnline(result.joinCode);
  }

  if (phase === "landing") {
    return (
      <Landing
        colors={app.colors}
        games={games}
        error={error}
        onHotSeat={(_gameId, count) => {
          const next = HotSeatSession.start(app.engine, count);
          hotSeatRef.current = next;
          setShown(next.getState());
          setPhase("hotseat");
          setError(null);
        }}
        onCreate={(gameId) => {
          void createRoom(gameId);
        }}
        onJoin={(code) => {
          const info = games[0];
          setMinPlayers(info?.minPlayers ?? 2);
          connectOnline(code, tokens.get(code));
        }}
      />
    );
  }

  if (phase === "lobby") {
    return (
      <WaitingRoom
        joinCode={joinCode}
        host={host}
        hostSeat={hostSeat}
        seats={roster}
        minPlayers={minPlayers}
        error={error}
        onStart={() => {
          onlineRef.current?.start();
        }}
        onLeave={() => {
          if (joinCode !== "") {
            tokens.clear(joinCode);
          }
          resetToLanding();
        }}
      />
    );
  }

  if (!shown) {
    return null;
  }

  const ended = shown.status !== "playing";
  const disconnected = disconnectedPlayers(shown, roster);

  return (
    <div className="play">
      <PlayHud state={shown} colors={app.colors} disconnected={disconnected} />
      <div className="board-wrap">
        <canvas ref={canvasRef} />
        {ended && (
          <ResultScreen
            winner={shown.winner}
            colors={app.colors}
            onAgain={() => {
              if (joinCode !== "") {
                tokens.clear(joinCode);
              }
              resetToLanding();
            }}
          />
        )}
      </div>
    </div>
  );
}

function legalFor(state: GameState, seat: SeatId | null): Move[] {
  if (state.status !== "playing" || seat === null) {
    return [];
  }
  const index = state.seats.indexOf(seat);
  const player = state.players[index];
  if (player === undefined || player !== state.current) {
    return [];
  }
  return app.engine.legalMoves(state, player);
}

function disconnectedPlayers(
  state: GameState,
  seats: RosterSeat[],
): PlayerId[] {
  const down = new Set(
    seats.filter((seat) => !seat.connected).map((seat) => seat.seat),
  );
  const players: PlayerId[] = [];
  for (const [index, seat] of state.seats.entries()) {
    if (!down.has(seat)) {
      continue;
    }
    const player = state.players[index];
    if (player !== undefined) {
      players.push(player);
    }
  }
  return players;
}
