"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

import { KarreBoard } from "@/components/board/KarreBoard";
import { MiniMap } from "@/components/board/MiniMap";
import { PlayerSidebar } from "@/components/layout/PlayerSidebar";
import { applyMove, createEmptyGameState } from "@/lib/game/engine";
import { pickBotMove } from "@/lib/game/ai";
import { useRoomSocket } from "@/lib/game/useRoomSocket";
import type { RemoteHover } from "@/lib/game/useRoomSocket";
import { initialsFromName, PLAYER_COLOR_ORDER, PLAYER_COLORS } from "@/lib/types/game";
import type { EdgeType, GameState, PlayerColor } from "@/lib/types/game";
import { ProfileMenu } from "@/components/ProfileMenu";
import { playMusic, stopMusic, setMusicSpeed, primeAudio, playCountdownTick, playCountdownGo, playGameOver } from "@/lib/audio";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useHistoryStore } from "@/lib/store/useHistoryStore";
import { Pencil, ArrowLeft, Share2, Copy, Link2, MessageCircle, Mail } from "lucide-react";

const BOT_ID = "bot";
const BOT_MOVE_DELAY_MS = 600;


export default function GamePage({ params }: { params: { roomId: string } }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-display text-2xl text-ink">Chargement...</div>}>
      <GamePageContent params={params} />
    </Suspense>
  );
}

function GamePageContent({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const isSolo = searchParams.get("mode") === "solo";

  return isSolo ? <SoloGame roomId={params.roomId} /> : <MultiplayerGame roomId={params.roomId} />;
}

/** Solo : état local + bot (lib/game/ai.ts), aucun réseau. */
function SoloGame({ roomId }: { roomId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { customInitials, setCustomInitials } = useSettingsStore();

  const humanId = session?.user?.email ?? "you";
  const humanName = session?.user?.name ?? "Joueur";
  const humanInitials = customInitials || session?.user?.initials || initialsFromName(humanName);

  const [state, setState] = useState<GameState>(() => ({
    ...createEmptyGameState({
      roomId,
      size: (searchParams.get("size") as any) || "large",
      mode: "solo",
      players: [
        { id: humanId, displayName: humanName, initials: humanInitials, color: null, score: 0, connected: true },
        {
          id: BOT_ID,
          displayName: "Robot",
          initials: "BOT",
          color: "red",
          score: 0,
          connected: true,
          isAI: true,
          aiDifficulty: "medium",
        },
      ],
    }),
    // Le solo passe toujours par la salle d'attente (choix de couleur), même si
    // les 2 "joueurs" (humain + bot) sont déjà là dès la création de la partie.
    status: "waiting",
  }));

  const selectColor = (color: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === humanId ? { ...p, color: color as PlayerColor } : p)),
    }));
  };

  const updateInitials = (newInitials: string) => {
    const cleaned = newInitials.trim().toUpperCase().slice(0, 3);
    if (!cleaned) return;
    setCustomInitials(cleaned);
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === humanId ? { ...p, initials: cleaned } : p)),
    }));
  };

  const startGame = () => {
    setState((prev) => ({ ...prev, status: "playing", startedAt: new Date().toISOString() }));
  };

  const handlePlayEdge = (type: EdgeType, row: number, col: number) => {
    setState((prev) => {
      try {
        return applyMove(prev, type, row, col, prev.players[prev.currentPlayerIndex].id).state;
      } catch {
        return prev; // coup invalide (déjà joué, pas le tour, etc.)
      }
    });
  };

  // Coup du bot : se redéclenche à chaque changement d'état, donc rejoue
  // automatiquement en cascade tant que c'est encore son tour (capture -> rejoue).
  useEffect(() => {
    const current = state.players[state.currentPlayerIndex];
    if (state.status !== "playing" || !current?.isAI) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        const player = prev.players[prev.currentPlayerIndex];
        if (!player?.isAI) return prev;
        try {
          const move = pickBotMove(prev, player.aiDifficulty ?? "easy");
          return applyMove(prev, move.type, move.row, move.col, player.id).state;
        } catch {
          return prev;
        }
      });
    }, BOT_MOVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const [leavingAfterForfeit, setLeavingAfterForfeit] = useState(false);

  // On attend que le state reflète bien "finished" (et donc que l'effet qui
  // enregistre l'historique se soit exécuté) avant de quitter la page — un
  // setTimeout arbitraire risquait de naviguer avant que React n'ait eu le
  // temps de re-render avec le nouveau statut.
  const handleForfeit = () => {
    if (state.status !== "playing") {
      router.push("/");
      return;
    }
    setState((prev) => {
      if (prev.status !== "playing") return prev;
      return {
        ...prev,
        status: "finished",
        winnerId: BOT_ID, // the bot wins if human forfeits
      };
    });
    setLeavingAfterForfeit(true);
  };

  useEffect(() => {
    if (leavingAfterForfeit && state.status === "finished") {
      router.push("/");
    }
  }, [leavingAfterForfeit, state.status, router]);

  const handleRematch = () => {
    setState((prev) => {
      const newPlayers = prev.players.map(p => ({ ...p, score: 0 }));
      const newState = createEmptyGameState({
        roomId: prev.roomId,
        size: prev.size,
        mode: prev.mode,
        players: newPlayers
      });
      return {
        ...newState,
        status: "playing",
        startedAt: new Date().toISOString(),
      };
    });
  };

  if (state.status === "waiting") {
    return (
      <WaitingRoom
        state={state}
        currentUserId={humanId}
        selectColor={selectColor}
        updateInitials={updateInitials}
        startGame={startGame}
      />
    );
  }

  return (
    <GameView
      roomId={roomId}
      state={state}
      currentUserId={humanId}
      onPlayEdge={handlePlayEdge}
      isSolo={true}
      onQuit={handleForfeit}
      onRematch={handleRematch}
    />
  );
}

/** Multijoueur : le serveur FastAPI (server/) est la source de vérité, voir useRoomSocket. */
function MultiplayerGame({ roomId }: { roomId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { customInitials } = useSettingsStore();

  const humanId = session?.user?.email ?? "";
  const humanName = session?.user?.name ?? "";
  const humanInitials = customInitials || session?.user?.initials || (humanName ? initialsFromName(humanName) : "");

  const size = (searchParams.get("size") as "small" | "medium" | "large") || "large";

  const [wantsToStart, setWantsToStart] = useState(false);
  const isInitialLoad = useRef(true);
  const [isExpiredLink, setIsExpiredLink] = useState(false);
  const [leavingAfterForfeit, setLeavingAfterForfeit] = useState(false);

  const {
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
  } = useRoomSocket({
    roomId,
    playerId: humanId,
    displayName: humanName,
    initials: humanInitials,
    size,
    enabled: status === "authenticated" && !!humanId,
  });

  // Si on est en attente du plateau et que la condition de lancement est remplie,
  // on envoie automatiquement le signal de démarrage au serveur.
  useEffect(() => {
    if (wantsToStart && state?.status === "waiting") {
      const allPicked = state.players.every(p => p.color);
      const isFullEnough = state.players.length >= 2;
      if (allPicked && isFullEnough) {
        startGame();
      }
    }
  }, [wantsToStart, state, startGame]);

  // Vérifie si le lien a expiré (si la partie est DÉJÀ terminée au moment où on la charge)
  useEffect(() => {
    if (state && isInitialLoad.current) {
      isInitialLoad.current = false;
      if (state.status === "finished") {
        setIsExpiredLink(true);
      }
    }
  }, [state]);

  // Doit rester AVANT les `return` anticipés ci-dessous : un Hook appelé
  // après un retour conditionnel casse les règles de React (ordre des Hooks
  // non constant d'un rendu à l'autre) — plantage en production confirmé sur
  // un lien de partie déjà terminée.
  useEffect(() => {
    if (leavingAfterForfeit && state?.status === "finished") {
      router.push("/");
    }
  }, [leavingAfterForfeit, state?.status, router]);

  if (isExpiredLink) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-transparent px-6 text-center text-ink transition-colors">
        <h2 className="mb-4 font-display text-4xl uppercase text-[var(--player-red-fill)]">Lien expiré</h2>
        <p className="mb-8 font-bold text-ink/70">Cette partie est déjà terminée ou a été abandonnée.</p>
        <button onClick={() => router.push("/")} className="rounded-full border-[1.5px] border-ink-border bg-surface px-6 py-3 font-bold text-ink shadow-stack transition-all hover:-translate-y-1 active:translate-x-px active:translate-y-px">
          Retour à l'accueil
        </button>
      </main>
    );
  }

  if (!humanId) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center bg-transparent px-6 text-center text-ink transition-colors">
        <div className="absolute left-6 top-6">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-ink-border bg-surface text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
            title="Retour à l'accueil"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-ink-border bg-surface p-8 shadow-stack max-w-sm w-full">
          <h2 className="font-display text-2xl uppercase tracking-wide text-ink">Invitation</h2>
          <p className="font-bold opacity-80">Connecte-toi pour rejoindre le salon {roomId}</p>
          <button
            onClick={() => signIn("google", { callbackUrl: window.location.href })}
            className="flex w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-ink-border bg-white px-6 py-3 font-bold text-ink shadow-stack transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed hover:bg-gray-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continuer avec Google
          </button>
        </div>
      </main>
    );
  }
  // Abandonner envoie le forfait au serveur puis attend la confirmation (state
  // "finished" reçue en retour) avant de quitter — naviguer tout de suite
  // coupait le WebSocket avant que le serveur ait répondu, donc la partie
  // n'était jamais enregistrée dans l'historique.
  const handleForfeit = () => {
    if (state?.status === "playing") {
      sendForfeit();
      setLeavingAfterForfeit(true);
    } else {
      router.push("/");
    }
  };

  if (!state) {
    return (
      <CenteredMessage
        text={error ?? (connected ? "En attente d'un adversaire…" : "Connexion au serveur de partie…")}
      />
    );
  }

  if (state.status === "waiting" && !wantsToStart) {
    return (
      <WaitingRoom
        state={state}
        currentUserId={humanId}
        selectColor={selectColor}
        updateInitials={updateInitials}
        startGame={() => setWantsToStart(true)}
      />
    );
  }

  return (
    <GameView
      roomId={roomId}
      state={state}
      currentUserId={humanId}
      onPlayEdge={playEdge}
      error={error}
      isSolo={false}
      onQuit={handleForfeit}
      onRematch={sendRematch}
      onChat={sendChat}
      connected={connected}
      isWaitingForOthers={state.status === "waiting"}
      onCancelWait={() => setWantsToStart(false)}
      remoteHover={remoteHover}
      onHoverEdge={(edge) => (edge ? sendHover(edge.type, edge.row, edge.col) : clearHover())}
    />
  );
}

function GameView({
  roomId,
  state,
  currentUserId,
  onPlayEdge,
  error,
  isSolo,
  onQuit,
  onRematch,
  onChat,
  connected = true,
  isWaitingForOthers = false,
  onCancelWait,
  remoteHover = null,
  onHoverEdge,
}: {
  roomId: string;
  state: GameState;
  currentUserId?: string;
  onPlayEdge: (type: EdgeType, row: number, col: number) => void;
  error?: string | null;
  isSolo?: boolean;
  onQuit?: () => void;
  onRematch?: () => void;
  onChat?: (text: string) => void;
  connected?: boolean;
  isWaitingForOthers?: boolean;
  onCancelWait?: () => void;
  remoteHover?: RemoteHover | null;
  onHoverEdge?: (edge: { type: EdgeType; row: number; col: number } | null) => void;
}) {
  const router = useRouter();
  const statusLabel = useMemo(() => {
    if (state.status === "finished") return "Partie terminée";
    return `Tour de ${state.players[state.currentPlayerIndex].displayName}`;
  }, [state]);

  const { musicEnabled, sfxEnabled } = useSettingsStore();
  const { addMatch } = useHistoryStore();

  // Enregistrement de l'historique + son quand la partie se termine
  useEffect(() => {
    if (state.status === "finished") {
      addMatch({
        id: roomId,
        date: new Date().toISOString(),
        mode: state.players.some((p) => p.isAI) ? "solo" : "multiplayer",
        isDraw: !state.winnerId,
        players: state.players.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          score: p.score,
          initials: p.initials,
          isWinner: p.id === state.winnerId,
        })),
      });
      playGameOver(sfxEnabled);
    }
  }, [state.status, state.winnerId, state.players, roomId, addMatch, sfxEnabled]);

  // Décompte "3, 2, 1, GO !" à chaque (re)démarrage de partie (début ou revanche).
  const [countdown, setCountdown] = useState<number | "GO" | null>(() => {
    // Si la partie est déjà lancée mais qu'aucun coup n'a été joué, on déclenche le décompte pour le 2ème joueur.
    return (state.status === "playing" && state.lastMove === null) ? 3 : null;
  });
  const prevStatusRef = useRef(state.status);
  useEffect(() => {
    if (prevStatusRef.current !== "playing" && state.status === "playing") {
      setCountdown(3);
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === "GO") {
      playCountdownGo(sfxEnabled);
      const t = setTimeout(() => setCountdown(null), 650);
      return () => clearTimeout(t);
    }
    playCountdownTick(sfxEnabled);
    const t = setTimeout(() => setCountdown(countdown > 1 ? countdown - 1 : "GO"), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // La musique de fond a été retirée à la demande de l'utilisateur pour éviter les bugs sonores/vibrations sur mobile.

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-transparent p-4 transition-colors lg:flex-row lg:p-8 scrollbar-none">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl leading-none text-ink">
              Karre Game's <span className="text-base font-bold opacity-50">· Salon {roomId}</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--player-blue-fill)]">{statusLabel}</span>
              <GameTimer startedAt={state.startedAt} running={state.status === "playing"} />
            </div>
          </div>
          <ProfileMenu />
        </div>
        {error && <p className="text-xs font-bold text-[var(--player-red-fill)]">{error}</p>}
        {!connected && state.status === "playing" && (
          <div className="flex items-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-[var(--player-red-soft)] px-3 py-2 text-sm font-bold text-[var(--player-red-fill)]">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--player-red-fill)]" />
            Connexion perdue avec le serveur — tentative de reconnexion…
          </div>
        )}
        {state.status === "finished" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border-2 border-ink-border bg-surface p-8 shadow-stack text-center animate-in fade-in zoom-in duration-300">
              <h2 className="mb-4 font-display text-3xl uppercase tracking-wide text-ink">Partie terminée</h2>
              <p className="mb-6 font-bold text-lg text-ink/80">
                {state.winnerId
                  ? (state.winnerId === currentUserId
                    ? "🎉 Victoire ! Vous avez gagné !"
                    : `Le vainqueur est ${state.players.find(p => p.id === state.winnerId)?.displayName || "un adversaire"}.`)
                  : "Match nul ! L'égalité est parfaite."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onQuit || (() => router.push("/"))}
                  className="flex-1 rounded-lg border-[1.5px] border-ink-border bg-ground px-4 py-3 font-bold text-ink hover:bg-ink/5 active:translate-x-px active:translate-y-px"
                >
                  Quitter
                </button>
                {onRematch && (
                  <button
                    onClick={onRematch}
                    className="flex-1 rounded-lg border-[1.5px] border-ink-border bg-[var(--player-green-fill)] px-4 py-3 font-bold text-ink shadow-stack-sm active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
                  >
                    Rejouer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {isWaitingForOthers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/80 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border-2 border-ink-border bg-surface p-8 shadow-stack text-center animate-in fade-in zoom-in duration-300">
              <h2 className="mb-2 font-display text-2xl uppercase tracking-wide text-ink">En attente</h2>
              
              <div className="mb-6 mt-4 flex justify-center gap-2">
                <div className="h-3 w-3 animate-bounce rounded-full bg-[var(--player-blue-fill)]" style={{ animationDelay: "0ms" }} />
                <div className="h-3 w-3 animate-bounce rounded-full bg-[var(--player-red-fill)]" style={{ animationDelay: "150ms" }} />
                <div className="h-3 w-3 animate-bounce rounded-full bg-[var(--player-green-fill)]" style={{ animationDelay: "300ms" }} />
              </div>

              <p className="mb-6 font-bold text-ink/80">
                Vos adversaires n'ont pas encore intégré la partie ou n'ont pas choisi leur couleur.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: "Karre Game's",
                        text: "Rejoignez ma partie de Karré !",
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Lien copié dans le presse-papiers !");
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-[var(--player-blue-fill)] px-4 py-3 font-bold text-[var(--player-blue-text)] shadow-stack-sm hover:-translate-y-0.5 active:translate-x-px active:translate-y-px active:shadow-stack-pressed transition-all"
                >
                  <Share2 size={18} />
                  Partager le lien
                </button>
                <button
                  onClick={onCancelWait}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-ground px-4 py-3 font-bold text-ink hover:bg-ink/5 active:translate-x-px active:translate-y-px transition-colors"
                >
                  Retour au salon
                </button>
              </div>
            </div>
          </div>
        )}

        {countdown !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm">
            <span
              key={countdown}
              className="animate-countdown-pop font-display text-8xl font-black text-white drop-shadow-lg sm:text-9xl"
            >
              {countdown}
            </span>
          </div>
        )}

        {state.status === "playing" && countdown === null && (
          <div key={state.currentPlayerIndex} className="animate-in zoom-in-95 fade-in duration-300 mb-2 mt-2 flex justify-center">
            {state.players[state.currentPlayerIndex].id === currentUserId ? (
              <div className="flex items-center gap-3 rounded-full border-2 border-ink bg-surface px-6 py-3 shadow-md">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: `var(--player-${state.players[state.currentPlayerIndex].color || "blue"}-fill)` }}></span>
                  <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: `var(--player-${state.players[state.currentPlayerIndex].color || "blue"}-fill)` }}></span>
                </span>
                <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wider text-ink">
                  C'est à votre tour de jouer !
                </h2>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border-[1.5px] border-ink-border bg-surface px-4 py-2 opacity-80">
                <div className="h-2 w-2 animate-bounce rounded-full bg-ink/50" />
                <h2 className="font-display text-sm font-bold uppercase tracking-widest text-ink/70">
                  C'est à {state.players[state.currentPlayerIndex].displayName} de jouer
                </h2>
              </div>
            )}
          </div>
        )}

        <div className="relative mx-auto w-full max-w-2xl">
          <KarreBoard
            state={state}
            currentUserId={currentUserId}
            onPlayEdge={onPlayEdge}
            remoteHover={remoteHover}
            onHoverEdge={onHoverEdge}
          />
          <MiniMap state={state} className="absolute left-3 top-3" />
        </div>
      </div>

      <PlayerSidebar
        state={state}
        onQuit={onQuit || (() => router.push("/"))}
        onRematch={onRematch}
        onChat={onChat}
        isSolo={isSolo}
        currentUserId={currentUserId}
        className="w-full lg:w-72"
      />
    </main>
  );
}

/** Chrono de partie : compte depuis startedAt, s'arrête quand la partie n'est plus "playing". */
function GameTimer({ startedAt, running }: { startedAt: string | null; running: boolean }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsedMs(0);
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsedMs(Date.now() - start);
    tick();
    if (!running) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, running]);

  if (!startedAt) return null;

  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="inline-flex items-center rounded-md border-[1.5px] border-ink-border bg-surface px-2 py-0.5 font-display text-sm text-ink">
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-ground px-6 text-center text-ink transition-colors">
      <div className="absolute right-6 top-6">
        <ProfileMenu />
      </div>
      <div className="rounded-xl border-[1.5px] border-ink-border bg-surface p-8 shadow-stack">
        <p className="font-bold">{text}</p>
      </div>
    </main>
  );
}

function WaitingRoom({
  state,
  currentUserId,
  selectColor,
  updateInitials,
  startGame,
}: {
  state: GameState;
  currentUserId: string;
  selectColor: (c: string) => void;
  updateInitials: (initials: string) => void;
  startGame: () => void;
}) {
  const router = useRouter();
  const me = state.players.find((p) => p.id === currentUserId);
  const isHost = state.players[0]?.id === currentUserId;
  const allPicked = state.players.every((p) => p.color);
  const [editingInitials, setEditingInitials] = useState(false);
  const [initialsInput, setInitialsInput] = useState("");
  const isMultiplayer = state.mode === "multiplayer";
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  // On autorise à cliquer sur "Lancer la partie" (pour voir le plateau flouté) dès qu'on a choisi sa propre couleur.
  const canStart = !!me?.color;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 bg-transparent px-6 text-ink transition-colors">
      <button
        onClick={() => router.push("/")}
        className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-ink-border bg-surface text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
        title="Retour à l'accueil"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="absolute right-6 top-6">
        <ProfileMenu />
      </div>

      <div className="text-center">
        <h1 className="font-display text-4xl leading-none text-ink">Salle d&apos;attente</h1>
        <p className="mt-2 text-sm font-bold uppercase tracking-wide opacity-60">Salon {state.roomId}</p>
      </div>

      {isMultiplayer && (
        <div className="flex flex-col items-center gap-4">
          <p className="font-bold text-sm opacity-60">Inviter des amis :</p>
          <div className="flex flex-wrap justify-center gap-3 max-w-sm">
            <button
              onClick={() => {
                const url = window.location.origin + window.location.pathname;
                navigator.clipboard.writeText(url);
                showToast("Lien d'invitation copié !");
              }}
              className="flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-surface px-4 py-2 text-sm font-bold text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed flex-1 min-w-[140px]"
            >
              <Link2 size={16} />
              Copier le lien
            </button>
            <button
              onClick={() => {
                const url = window.location.origin + window.location.pathname;
                const text = `Salut 👋\n\nJe vous invite à me rejoindre pour une partie de Karre Game's avec le code ${state.roomId} ou depuis ce lien : ${url}\n\nÀ très bientôt`;
                navigator.clipboard.writeText(text);
                showToast("Message d'invitation copié !");
              }}
              className="flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-surface px-4 py-2 text-sm font-bold text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed flex-1 min-w-[140px]"
            >
              <Copy size={16} />
              Message complet
            </button>
            <button
              onClick={() => {
                const url = window.location.origin + window.location.pathname;
                const text = `Salut 👋\n\nJe vous invite à me rejoindre pour une partie de Karre Game's avec le code ${state.roomId} ou depuis ce lien : ${url}\n\nÀ très bientôt`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
              }}
              className="flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-[#25D366] px-4 py-2 text-sm font-bold text-white shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed flex-1 min-w-[140px]"
            >
              <MessageCircle size={16} />
              WhatsApp
            </button>
            <button
              onClick={() => {
                const url = window.location.origin + window.location.pathname;
                const text = `Salut 👋\n\nJe vous invite à me rejoindre pour une partie de Karre Game's avec le code ${state.roomId} ou depuis ce lien : ${url}\n\nÀ très bientôt`;
                window.location.href = `mailto:?subject=Invitation à jouer à Karre Game's&body=${encodeURIComponent(text)}`;
              }}
              className="flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink-border bg-surface px-4 py-2 text-sm font-bold text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed flex-1 min-w-[140px]"
            >
              <Mail size={16} />
              Email
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        {state.players.map((p) => {
          const colors = p.color ? PLAYER_COLORS[p.color].light : null;
          const isMe = p.id === currentUserId;
          return (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] font-display text-lg"
                style={
                  colors
                    ? { backgroundColor: colors.fill, color: colors.text, borderColor: colors.ring }
                    : { backgroundColor: "var(--surface)", color: "var(--line)", borderColor: "var(--line)" }
                }
              >
                {p.initials}
              </div>
              {isMe && editingInitials ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    maxLength={3}
                    autoFocus
                    value={initialsInput}
                    onChange={(e) => setInitialsInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && initialsInput.trim()) {
                        updateInitials(initialsInput);
                        setEditingInitials(false);
                      }
                    }}
                    className="w-14 rounded-md border-[1.5px] border-ink-border bg-surface px-1 py-0.5 text-center font-display text-sm uppercase text-ink outline-none"
                  />
                  <button
                    onClick={() => {
                      if (initialsInput.trim()) updateInitials(initialsInput);
                      setEditingInitials(false);
                    }}
                    className="rounded-md border-[1.5px] border-ink-border bg-[var(--player-blue-fill)] px-2 py-0.5 font-display text-xs text-[var(--player-blue-text)]"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (isMe) {
                      setInitialsInput(p.initials);
                      setEditingInitials(true);
                    }
                  }}
                  className={`flex items-center gap-1 text-sm font-bold ${isMe ? "hover:opacity-70" : ""}`}
                >
                  {p.displayName}
                  {isMe && <Pencil size={12} className="opacity-50" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border-2 border-ink-border bg-surface p-6 shadow-stack">
        <h2 className="font-display text-sm uppercase tracking-wide text-ink">Choisis ta couleur</h2>
        <div className="grid grid-cols-4 gap-4">
          {PLAYER_COLOR_ORDER.map((c) => {
            const takenByOther = state.players.some((p) => p.color === c && p.id !== currentUserId);
            const selected = me?.color === c;
            return (
              <button
                key={c}
                disabled={takenByOther}
                onClick={() => selectColor(c)}
                className={`h-12 w-12 rounded-full border-2 transition-transform ${takenByOther ? "cursor-not-allowed opacity-25 grayscale" : "hover:scale-110 active:scale-95"
                  }`}
                style={{
                  backgroundColor: PLAYER_COLORS[c].light.fill,
                  borderColor: selected ? "var(--ink)" : "transparent",
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        {isHost ? (
          <button
            onClick={() => {
              if (!canStart) {
                if (state.players.length < 2) {
                  showToast("Vos adversaires n'ont pas encore rejoint la partie !");
                } else {
                  showToast("Tout le monde n'a pas encore choisi sa couleur !");
                }
                return;
              }
              primeAudio();
              startGame();
            }}
            className="rounded-lg border-[1.5px] border-ink-border bg-[var(--player-blue-fill)] px-8 py-4 font-bold text-xl text-[var(--player-blue-text)] shadow-stack transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
          >
            Lancer la partie
          </button>
        ) : (
          <p className="text-sm font-bold opacity-60">En attente du créateur du salon…</p>
        )}
        {!canStart && isMultiplayer && (
          <p className="text-xs font-bold opacity-50">
            {state.players.length < 2
              ? "En attente d'autres joueurs — invite-les avec le bouton ci-dessus."
              : "En attente que tout le monde ait choisi sa couleur…"}
          </p>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
          <div className="animate-toast-in rounded-lg border-[1.5px] border-ink-border bg-surface px-4 py-3 text-sm font-bold text-ink shadow-stack">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}
