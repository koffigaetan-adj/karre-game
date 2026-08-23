"use client";

import { useEffect, useRef, useState } from "react";
import type { EdgeType, GameState } from "../types/game";

interface UseRoomSocketParams {
  roomId: string;
  playerId: string;
  displayName: string;
  initials: string;
  size: "small" | "medium" | "large";
  /** Ne connecte que lorsque true (ex: attend la session Google). */
  enabled: boolean;
}

interface UseRoomSocketResult {
  state: GameState | null;
  connected: boolean;
  error: string | null;
  playEdge: (type: EdgeType, row: number, col: number) => void;
  selectColor: (color: string) => void;
  startGame: () => void;
  sendForfeit: () => void;
  sendRematch: () => void;
  sendChat: (text: string) => void;
}

/**
 * Connexion au backend temps réel FastAPI (server/app/main.py).
 * Le serveur est la source de vérité : chaque coup envoyé est validé
 * côté Python (game_engine.py) puis renvoyé à tous les joueurs du salon
 * sous forme de GameState complet — pas de logique de capture côté client.
 */
export function useRoomSocket({
  roomId,
  playerId,
  displayName,
  initials,
  size,
  enabled,
}: UseRoomSocketParams): UseRoomSocketResult {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const base = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
    const params = new URLSearchParams({ player_id: playerId, display_name: displayName, initials, size });
    const ws = new WebSocket(`${base}/ws/rooms/${roomId}?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("Connexion perdue avec le serveur de partie.");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as
        | { type: "state"; state: GameState }
        | { type: "error"; message: string };
      if (data.type === "state") setState(data.state);
      else setError(data.message);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, playerId, displayName, initials, enabled]);

  const playEdge = (type: EdgeType, row: number, col: number) => {
    wsRef.current?.send(JSON.stringify({ type, row, col }));
  };
  
  const selectColor = (color: string) => {
    wsRef.current?.send(JSON.stringify({ type: "select_color", color }));
  };
  
  const startGame = () => {
    wsRef.current?.send(JSON.stringify({ type: "start_game" }));
  };

  const sendForfeit = () => {
    wsRef.current?.send(JSON.stringify({ type: "forfeit" }));
  };

  const sendRematch = () => {
    wsRef.current?.send(JSON.stringify({ type: "rematch" }));
  };

  const sendChat = (text: string) => {
    wsRef.current?.send(JSON.stringify({ type: "chat", text }));
  };

  return { state, connected, error, playEdge, selectColor, startGame, sendForfeit, sendRematch, sendChat };
}
