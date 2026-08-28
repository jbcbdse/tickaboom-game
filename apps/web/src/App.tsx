import { useEffect, useRef, useState } from "react";
import type { GameState } from "@tickaboom/engine";

import { AppContainer } from "./composition";
import { HotSeatSession } from "./session";
import { Landing, PlayHud, ResultScreen } from "./ui";
import { BoardView } from "./view";

const app = new AppContainer();

export function App() {
  const [session, setSession] = useState<HotSeatSession | null>(null);
  const [shown, setShown] = useState<GameState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<BoardView | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !session) {
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
  }, [session]);

  if (!session) {
    return (
      <Landing
        colors={app.colors}
        onStart={(count) => {
          const next = HotSeatSession.start(app.engine, count);
          setSession(next);
          setShown(next.getState());
        }}
      />
    );
  }

  if (!shown) {
    return null;
  }

  const ended = shown.status !== "playing";

  return (
    <div className="play">
      <PlayHud state={shown} colors={app.colors} />
      <div className="board-wrap">
        <canvas ref={canvasRef} />
        {ended && (
          <ResultScreen
            winner={shown.winner}
            colors={app.colors}
            onAgain={() => {
              setSession(null);
              setShown(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
