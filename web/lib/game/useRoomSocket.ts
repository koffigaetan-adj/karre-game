"use client";

import { useEffect, useRef, useState } from "react";
import type { EdgeType, GameState } from "../types/game";
import { applyMove } from "./engine";

interface UseRoomSocketParams {
  roomId: string;
  playerId: string;
  displayName: string;
  initials: string;
  size: "small" | "medium" | "large";
  players?: number;
  /** Ne connecte que lorsque true (ex: attend la session Google). */
  enabled: boolean;
}

export interface RemoteHover {
  playerId: string;
  type: EdgeType;
  row: number;
  col: number;
}

interface UseRoomSocketResult {
  state: GameState | null;
  connected: boolean;
  error: string | null;
  remoteHover: RemoteHover | null;
  playEdge: (type: EdgeType, row: number, col: number) => void;
  selectColor: (color: string) => void;
  updateInitials: (initials: string) => void;
  startGame: () => void;
  sendForfeit: () => void;
  sendRematch: () => void;
  sendChat: (text: string) => void;
  sendHover: (type: EdgeType, row: number, col: number) => void;
  clearHover: () => void;
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
  players = 2,
  enabled,
}: UseRoomSocketParams): UseRoomSocketResult {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteHover, setRemoteHover] = useState<RemoteHover | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    if (base.startsWith("http://")) base = base.replace("http://", "ws://");
    if (base.startsWith("https://")) base = base.replace("https://", "wss://");
    if (base.endsWith("/")) base = base.slice(0, -1);
    const params = new URLSearchParams({ player_id: playerId, display_name: displayName, initials, size, players: players.toString() });
    const wsUrl = `${base}/ws/rooms/${roomId}?${params.toString()}`;

    // Une coupure réseau (WiFi qui saute pendant la partie) ne doit pas
    // laisser le joueur planté devant un plateau figé sans explication —
    // on retente une reconnexion automatique tant que le composant reste
    // monté, plutôt que d'abandonner après le premier onclose.
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;

      // `new WebSocket()` lève une exception SYNCHRONE (pas un event onerror)
      // si le schéma de l'URL est invalide (ex: une faute de frappe "wws://"
      // au lieu de "wss://" dans NEXT_PUBLIC_WS_URL) — sans ce try/catch, une
      // seule variable d'environnement mal configurée plante toute
      // l'application au lieu d'afficher un message d'erreur normal.
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setError("URL du serveur de partie invalide (NEXT_PUBLIC_WS_URL mal configurée).");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setError(null);
      };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        if (!cancelled) setError("Connexion perdue avec le serveur de partie.");
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as
          | { type: "state"; state: GameState }
          | { type: "error"; message: string }
          | { type: "opponent_hover"; playerId: string; edgeType: EdgeType | null; row: number | null; col: number | null };
        if (data.type === "state") {
          setState(data.state);
          // Un nouvel état signifie qu'un coup vient d'être joué (ou le tour a
          // changé) : l'aperçu de survol précédent n'a plus de sens.
          setRemoteHover(null);
        } else if (data.type === "opponent_hover") {
          if (data.edgeType === null || data.row === null || data.col === null) {
            setRemoteHover(null);
          } else {
            setRemoteHover({ playerId: data.playerId, type: data.edgeType, row: data.row, col: data.col });
          }
        } else {
          setError(data.message);
        }
      };
    }

    connect();

    // Un téléphone verrouillé ou un onglet mis en arrière-plan gèle souvent
    // les setTimeout du navigateur — le setTimeout(connect, 2000) programmé
    // dans onclose peut donc ne jamais se déclencher tant que l'écran reste
    // éteint, laissant le client "déconnecté" indéfiniment même après le
    // retour de l'utilisateur. On force donc une tentative de reconnexion
    // immédiate dès que l'onglet redevient visible/actif, sans attendre le
    // minuteur (qui, lui, reste utile pour les vraies coupures réseau).
    function reconnectIfNeeded() {
      if (cancelled || document.visibilityState !== "visible") return;
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connect();
    }
    document.addEventListener("visibilitychange", reconnectIfNeeded);
    window.addEventListener("focus", reconnectIfNeeded);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", reconnectIfNeeded);
      window.removeEventListener("focus", reconnectIfNeeded);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [roomId, playerId, displayName, initials, enabled]);

  const playEdge = (type: EdgeType, row: number, col: number) => {
    wsRef.current?.send(JSON.stringify({ type, row, col }));
    // Retour instantané en attendant la confirmation du serveur : sans ça,
    // même l'auteur du coup devait attendre l'aller-retour réseau avant de
    // voir son propre trait apparaître, ce qui donnait une sensation de jeu
    // en retard. Le serveur reste la seule source de vérité — son état
    // écrase toujours celui-ci dès qu'il arrive (y compris si le coup est
    // finalement rejeté, ex: capture concurrente de l'adversaire).
    setState((prev) => {
      if (!prev) return prev;
      try {
        return applyMove(prev, type, row, col, playerId).state;
      } catch {
        return prev;
      }
    });
  };
  
  const selectColor = (color: string) => {
    wsRef.current?.send(JSON.stringify({ type: "select_color", color }));
  };

  const updateInitials = (newInitials: string) => {
    wsRef.current?.send(JSON.stringify({ type: "update_initials", initials: newInitials }));
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

  const sendHover = (type: EdgeType, row: number, col: number) => {
    wsRef.current?.send(JSON.stringify({ type: "hover", edgeType: type, row, col }));
  };

  const clearHover = () => {
    wsRef.current?.send(JSON.stringify({ type: "hover", edgeType: null, row: null, col: null }));
  };

  return {
    state,
    connected,
    error,
    remoteHover,
    playEdge,
    selectColor,
    updateInitials,
    startGame,
    sendForfeit,
    sendRematch,
    sendChat,
    sendHover,
    clearHover,
  };
}
