"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { HelpCircle, Bot, Users, Play } from "lucide-react";
import { motion } from "framer-motion";

/** Lobby : connexion Google (Auth.js), puis Solo / Créer une partie / Rejoindre via code. */
export default function LobbyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [joinCode, setJoinCode] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [selectedSize, setSelectedSize] = useState<"small" | "medium" | "large" | "giant">("medium");

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
    <main className="relative flex h-[100dvh] flex-col items-center justify-center gap-[clamp(0.5rem,2.2dvh,2.5rem)] overflow-hidden bg-transparent px-4 text-ink transition-colors md:px-6">
      {/* Header Profile / Rules */}
      <div className="absolute right-4 top-4 z-50 flex items-center gap-3 md:right-6 md:top-6 md:gap-4">
        <button
          onClick={() => setShowInfo(true)}
          className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full border border-ink-border bg-[var(--player-yellow-fill)] text-[var(--player-yellow-text)] shadow-sm transition-all hover:-translate-y-1 active:translate-x-px active:translate-y-px"
          title="Règles du jeu"
        >
          <HelpCircle size={18} className="md:w-5 md:h-5" />
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
      <div className="relative z-10 w-full min-w-0 max-w-md shrink-0 text-center">
        <div className="flex justify-center mb-[clamp(0.25rem,1dvh,1rem)]">
          <Image src="/logo-light.png" alt="Kwadra Logo" width={96} height={96} className="h-[clamp(2.25rem,7dvh,5rem)] w-[clamp(2.25rem,7dvh,5rem)] dark:hidden drop-shadow-md hover:scale-105 transition-transform duration-300" />
          <Image src="/logo-dark.png" alt="Kwadra Logo" width={96} height={96} className="h-[clamp(2.25rem,7dvh,5rem)] w-[clamp(2.25rem,7dvh,5rem)] hidden dark:block drop-shadow-md hover:scale-105 transition-transform duration-300" />
        </div>
        <h1 className="font-display text-[clamp(1.25rem,4.5dvh,3rem)] font-black leading-tight tracking-tight text-ink mb-[clamp(0.125rem,0.5dvh,0.5rem)] drop-shadow-sm">
          Kwadra
        </h1>
        <p className="text-[clamp(0.65rem,1.6dvh,1rem)] font-bold text-ink/80 max-w-sm mx-auto">
          Redécouvrez le classique du jeu de points et carrés.
        </p>
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full min-w-0 max-w-md shrink-0 rounded-2xl border border-ink-border bg-surface/70 backdrop-blur-xl p-[clamp(0.75rem,2.5dvh,1.5rem)] shadow-xl hover:shadow-2xl transition-all duration-300">
        <div className="mb-[clamp(0.5rem,1.5dvh,1.25rem)] text-center">
          <h2 className="font-display text-[clamp(0.9rem,2.2dvh,1.25rem)] uppercase tracking-wide text-ink">Nouvelle partie</h2>
        </div>

        <div className="grid grid-cols-1 gap-[clamp(0.5rem,1.5dvh,1rem)]">
          {/* Size Selector */}
          <div className="w-full">
            <div className="flex w-full rounded-full border border-ink-border/20 bg-ground/50 p-1 backdrop-blur-sm relative">
              {(["small", "medium", "large", "giant"] as const).map((s) => {
                const isSelected = selectedSize === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`relative flex-1 min-w-0 truncate rounded-full px-[clamp(0.25rem,2vw,0.75rem)] py-[clamp(0.25rem,0.9dvh,0.5rem)] text-[clamp(0.5rem,2.4vw,0.6875rem)] font-bold uppercase tracking-widest transition-colors z-10 ${
                      isSelected ? "text-surface" : "text-ink/60 hover:text-ink hover:bg-ink/5"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="active-size"
                        className="absolute inset-0 rounded-full bg-ink shadow-md"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                    {s === "small" && "Petite"}
                    {s === "medium" && "Moyenne"}
                    {s === "large" && "Classique"}
                    {s === "giant" && "Géante"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Game Modes */}
          <div className="grid grid-cols-1 gap-[clamp(0.375rem,1dvh,0.75rem)]">
            <button
              onClick={startSolo}
              className="group relative overflow-hidden rounded-xl border border-transparent bg-white/30 dark:bg-black/30 px-3 py-[clamp(0.5rem,1.5dvh,1rem)] text-xs md:text-sm font-bold text-ink shadow-sm transition-all hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:border-ink/50 hover:shadow-md active:translate-x-px active:translate-y-px flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-[clamp(1.75rem,4.5dvh,2.5rem)] w-[clamp(1.75rem,4.5dvh,2.5rem)] items-center justify-center rounded-full bg-gradient-to-br from-[var(--player-yellow-fill)] to-[var(--player-orange-fill)] text-[var(--player-yellow-text)] shadow-inner">
                  <Bot size={16} className="md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                </div>
                <span>Jouer solo (contre le robot)</span>
              </div>
              <Play size={14} className="md:w-4 md:h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => createRoom(2)}
                className="group relative overflow-hidden rounded-xl border border-transparent bg-white/30 dark:bg-black/30 px-3 py-[clamp(0.5rem,1.5dvh,1rem)] text-xs md:text-sm font-bold text-ink shadow-sm transition-all hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:border-ink/50 hover:shadow-md active:translate-x-px active:translate-y-px flex flex-col items-center gap-[clamp(0.25rem,0.9dvh,0.75rem)]"
              >
                <div className="relative flex h-[clamp(2rem,5dvh,3rem)] w-[clamp(2rem,5dvh,3rem)] items-center justify-center rounded-full bg-gradient-to-br from-[var(--player-blue-fill)] to-[var(--player-cyan-fill)] text-[var(--player-blue-text)] shadow-inner">
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
                className="group relative overflow-hidden rounded-xl border border-transparent bg-white/30 dark:bg-black/30 px-3 py-[clamp(0.5rem,1.5dvh,1rem)] text-xs md:text-sm font-bold text-ink shadow-sm transition-all hover:-translate-y-1 hover:bg-white/50 dark:hover:bg-black/50 hover:border-ink/50 hover:shadow-md active:translate-x-px active:translate-y-px flex flex-col items-center gap-[clamp(0.25rem,0.9dvh,0.75rem)]"
              >
                <div className="relative flex h-[clamp(2rem,5dvh,3rem)] w-[clamp(2rem,5dvh,3rem)] items-center justify-center rounded-full bg-gradient-to-br from-[var(--player-green-fill)] to-[#10b981] text-[var(--player-green-text)] shadow-inner">
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

          <div className="relative border-t border-dashed border-line pt-[clamp(0.5rem,1.5dvh,1rem)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-surface/80 backdrop-blur-sm px-3 text-xs font-bold uppercase tracking-wider text-ink/50">Ou</span>
            <div className="flex gap-2 sm:gap-3">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Code de partie…"
                className="min-w-0 flex-1 rounded-xl border-[1.5px] border-ink-border/30 bg-white/30 dark:bg-black/30 px-[clamp(0.625rem,3vw,1rem)] py-[clamp(0.5rem,1.5dvh,0.75rem)] text-sm font-bold text-ink outline-none placeholder:font-medium placeholder:opacity-30 placeholder:text-ink focus:border-ink/70 focus:bg-white/50 dark:focus:bg-black/50 focus:ring-4 focus:ring-ink/10 transition-all shadow-inner hover:bg-white/50 dark:hover:bg-black/50"
              />
              <button
                onClick={joinRoom}
                className="shrink-0 rounded-xl border-[1.5px] border-ink-border bg-ink text-surface px-[clamp(0.875rem,4vw,1.5rem)] py-[clamp(0.5rem,1.5dvh,0.75rem)] text-sm font-bold shadow-md transition-all hover:-translate-y-1 hover:shadow-lg active:translate-x-px active:translate-y-px"
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
              <p className="flex gap-3"><span className="text-xl">🎯</span> <span><strong>Le But du jeu :</strong> Conquérir le plateau en capturant plus de cases que vos adversaires.</span></p>
              <p className="flex gap-3"><span className="text-xl">✏️</span> <span><strong>Comment jouer :</strong> À votre tour, reliez deux points voisins pour tracer un trait (horizontal ou vertical).</span></p>
              <p className="flex gap-3"><span className="text-xl">📦</span> <span><strong>Capture :</strong> Fermez le 4ème côté d'une case pour la capturer. La main passe ensuite au joueur suivant, même si vous venez de capturer !</span></p>
              <p className="flex gap-3"><span className="text-xl">✨</span> <span><strong>Le coup DOUBLE ! :</strong> Tracez un trait stratégique qui ferme deux cases d'un seul coup pour marquer double et déclencher l'animation spéciale !</span></p>
              <p className="flex gap-3"><span className="text-xl">🔥</span> <span><strong>Attention aux bords :</strong> Le plateau est en forme d'arène. L'espace se réduit vite, anticipez vos coups !</span></p>
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
