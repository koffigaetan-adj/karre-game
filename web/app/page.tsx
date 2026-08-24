"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Info, Bot, Users, Play } from "lucide-react";

/** Lobby : connexion Google (Auth.js), puis Solo / Créer une partie / Rejoindre via code. */
export default function LobbyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [joinCode, setJoinCode] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [selectedSize, setSelectedSize] = useState<"small" | "medium" | "large">("medium");

  const requireAuth = (go: () => void) => {
    if (!session) {
      signIn("google");
      return;
    }
    go();
  };

  const startSolo = () =>
    requireAuth(() => router.push(`/game/${crypto.randomUUID().slice(0, 8)}?mode=solo&size=${selectedSize}`));
  const createRoom = (players: 2 | 4) =>
    requireAuth(() =>
      router.push(`/game/${crypto.randomUUID().slice(0, 8)}?mode=create&players=${players}&size=${selectedSize}`)
    );
  const joinRoom = () => requireAuth(() => joinCode && router.push(`/game/${joinCode}?mode=join`));

  return (
    <main className="relative flex h-[100dvh] flex-col items-center justify-center gap-4 overflow-hidden bg-transparent px-4 py-6 text-ink transition-colors md:gap-10 md:px-6 md:py-12">
      {/* Header Profile / Rules */}
      <div className="absolute right-4 top-4 z-50 flex items-center gap-3 md:right-6 md:top-6 md:gap-4">
        <button
          onClick={() => setShowInfo(true)}
          className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full border border-ink-border bg-[var(--player-yellow-fill)] text-[var(--player-yellow-text)] shadow-sm transition-all hover:-translate-y-1 active:translate-x-px active:translate-y-px"
          title="Règles du jeu"
        >
          <Info size={18} className="md:w-5 md:h-5" />
        </button>

        {status === "loading" ? (
          <div className="h-9 w-24 md:h-11 md:w-32 animate-pulse rounded-full border border-line bg-surface" />
        ) : session ? (
          <ProfileMenu />
        ) : (
          <button
            onClick={() => signIn("google")}
            className="rounded-full border border-ink-border bg-[var(--player-blue-fill)] px-4 py-1.5 md:px-5 md:py-2 text-xs md:text-sm font-bold text-[var(--player-blue-text)] shadow-sm transition-all hover:-translate-y-1 active:translate-x-px active:translate-y-px"
          >
            Se connecter
          </button>
        )}
      </div>

      {/* Hero Content */}
      <div className="relative z-10 w-full min-w-0 max-w-lg mt-8 text-center sm:mt-0">
        <div className="flex justify-center mb-4 md:mb-6">
          <Image src="/logo-light.png" alt="Karré Logo" width={96} height={96} className="w-20 h-20 md:w-28 md:h-28 dark:hidden drop-shadow-md hover:scale-105 transition-transform duration-300" />
          <Image src="/logo-dark.png" alt="Karré Logo" width={96} height={96} className="w-20 h-20 md:w-28 md:h-28 hidden dark:block drop-shadow-md hover:scale-105 transition-transform duration-300" />
        </div>
        <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-ink mb-2 md:mb-4 drop-shadow-sm">
          Karre Game's
        </h1>
        <p className="text-sm sm:text-lg font-bold text-ink/80 max-w-md mx-auto">
          Redécouvrez le classique du jeu de points et carrés.
        </p>
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full min-w-0 max-w-md rounded-2xl border border-ink-border bg-surface/70 backdrop-blur-xl p-5 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300">
        <div className="mb-4 md:mb-8 text-center">
          <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-ink">Nouvelle partie</h2>
        </div>
        
        <div className="grid gap-4 md:gap-6">
          {/* Size Selector */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-full border border-ink-border/20 bg-ground/50 p-1 backdrop-blur-sm">
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`rounded-full px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold transition-all ${
                    selectedSize === s
                      ? "bg-ink text-surface shadow-md"
                      : "text-ink/60 hover:text-ink hover:bg-ink/5"
                  }`}
                >
                  {s === "small" && "Petite (9x9)"}
                  {s === "medium" && "Moyenne (13x13)"}
                  {s === "large" && "Classique (17x17)"}
                </button>
              ))}
            </div>
          </div>

          {/* Game Modes */}
          <div className="grid gap-3 md:gap-4 mt-1 md:mt-2">
            <button
              onClick={startSolo}
              className="group relative overflow-hidden rounded-xl border border-transparent bg-surface/80 px-3 py-3 md:px-4 md:py-4 text-xs md:text-sm font-bold text-ink shadow-sm transition-all hover:-translate-y-1 hover:bg-white/30 dark:hover:bg-black/30 hover:border-ink/50 hover:shadow-md active:translate-x-px active:translate-y-px flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--player-yellow-fill)] to-[var(--player-orange-fill)] text-[var(--player-yellow-text)] shadow-inner">
                  <Bot size={16} className="md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                </div>
                <span>Jouer solo (contre le robot)</span>
              </div>
              <Play size={14} className="md:w-4 md:h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => createRoom(2)}
                className="group relative overflow-hidden rounded-xl border border-transparent bg-surface/80 px-3 py-3 md:px-4 md:py-4 text-xs md:text-sm font-bold text-ink shadow-sm transition-all hover:-translate-y-1 hover:bg-white/30 dark:hover:bg-black/30 hover:border-ink/50 hover:shadow-md active:translate-x-px active:translate-y-px flex flex-col items-center gap-2 md:gap-3"
              >
                <div className="relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--player-blue-fill)] to-[var(--player-cyan-fill)] text-[var(--player-blue-text)] shadow-inner">
                  <Users size={20} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 md:h-3.5 md:w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--player-blue-text)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 md:h-3.5 md:w-3.5 bg-[var(--player-blue-text)] border-[1.5px] border-[var(--player-blue-fill)]"></span>
                  </span>
                </div>
                <span>Partie à 2 joueurs</span>
              </button>
              
              <button
                onClick={() => createRoom(4)}
                className="group relative overflow-hidden rounded-xl border border-transparent bg-surface/80 px-3 py-3 md:px-4 md:py-4 text-xs md:text-sm font-bold text-ink shadow-sm transition-all hover:-translate-y-1 hover:bg-white/30 dark:hover:bg-black/30 hover:border-ink/50 hover:shadow-md active:translate-x-px active:translate-y-px flex flex-col items-center gap-2 md:gap-3"
              >
                <div className="relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--player-green-fill)] to-[#10b981] text-[var(--player-green-text)] shadow-inner">
                  <Users size={20} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 md:h-3.5 md:w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--player-green-text)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 md:h-3.5 md:w-3.5 bg-[var(--player-green-text)] border-[1.5px] border-[var(--player-green-fill)]"></span>
                  </span>
                </div>
                <span>Partie à 4 joueurs</span>
              </button>
            </div>
          </div>

          <div className="relative mt-2 border-t border-dashed border-line pt-6">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-surface/80 backdrop-blur-sm px-3 text-xs font-bold uppercase tracking-wider text-ink/50">Ou</span>
            <div className="flex gap-3">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Code de partie…"
                className="flex-1 rounded-lg border-[1.5px] border-ink-border bg-transparent backdrop-blur-sm px-4 py-3 text-sm font-bold text-ink outline-none placeholder:font-medium placeholder:opacity-50 focus:bg-transparent focus:ring-2 focus:ring-ink/20 transition-all"
              />
              <button
                onClick={joinRoom}
                className="rounded-lg border-[1.5px] border-ink-border bg-[var(--ink)] text-surface px-6 py-3 text-sm font-bold shadow-stack-sm transition-all hover:-translate-y-1 active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
              >
                Rejoindre
              </button>
            </div>
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border-2 border-ink-border bg-surface p-6 shadow-stack animate-in zoom-in-95 duration-300">
            <h2 className="mb-4 font-display text-2xl text-ink">Comment jouer ?</h2>
            <div className="space-y-4 text-sm font-medium text-ink/80">
              <p className="flex gap-3"><span className="text-xl">📍</span> <span><strong>Le But :</strong> Conquérir le plus grand nombre de cases avant que la grille ne soit remplie.</span></p>
              <p className="flex gap-3"><span className="text-xl">✏️</span> <span><strong>Tour de jeu :</strong> Tracez un trait (horizontal ou vertical) entre deux points.</span></p>
              <p className="flex gap-3"><span className="text-xl">📦</span> <span><strong>Capture :</strong> Si votre trait ferme une case, elle devient vôtre (feu d'artifice à la clé !) et <strong>vous rejouez immédiatement</strong>.</span></p>
              <p className="flex gap-3"><span className="text-xl">🤖</span> <span><strong>Solo :</strong> Affrontez notre algorithme pour vous entraîner.</span></p>
              <p className="flex gap-3"><span className="text-xl">👥</span> <span><strong>Multijoueur :</strong> Créez un salon privé et partagez le code à vos amis pour jouer en temps réel !</span></p>
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="mt-8 w-full rounded-lg border-[1.5px] border-ink-border bg-ground px-4 py-3 font-bold text-ink shadow-stack-sm active:translate-x-px active:translate-y-px hover:bg-ink/5 transition-colors"
            >
              C'est compris !
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
