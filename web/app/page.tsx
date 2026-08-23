"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Info } from "lucide-react";

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
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-ground px-6 text-ink transition-colors">
      {/* Profil positionné en haut à droite */}
      <div className="absolute right-6 top-6 flex items-center gap-4">
        <button
          onClick={() => setShowInfo(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-[var(--player-yellow-fill)] text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
          title="Règles du jeu"
        >
          <Info size={20} />
        </button>

        {status === "loading" ? (
          <div className="h-11 w-32 animate-pulse rounded-full border-2 border-line bg-surface" />
        ) : session ? (
          <ProfileMenu />
        ) : (
          <button
            onClick={() => signIn("google")}
            className="rounded-full border-2 border-ink bg-[var(--player-blue-fill)] px-5 py-2 text-sm font-bold text-[var(--player-blue-text)] shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
          >
            Se connecter
          </button>
        )}
      </div>

      {/* Le "couvercle de boîte" du jeu */}
      <div className="w-full max-w-md rounded-xl border-[3px] border-ink bg-surface p-8 shadow-stack">
        <div className="mb-8 text-center flex flex-col items-center gap-2">
          <Image src="/logo.jpg" alt="Karré Logo" width={80} height={80} className="rounded-xl border-2 border-ink shadow-stack-sm mb-2" />
          <h1 className="font-display text-5xl font-black tracking-tight text-ink">Karré</h1>
          <p className="text-sm font-bold text-ink/60">Le classique réinventé.</p>
        </div>
        <div className="grid gap-4">
          <div className="flex justify-center gap-2 mb-2">
            {(["small", "medium", "large"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all border-2 ${
                  selectedSize === s
                    ? "border-ink bg-ink text-surface"
                    : "border-line bg-surface text-ink/60 hover:border-ink hover:text-ink"
                }`}
              >
                {s === "small" && "Petite (9x9)"}
                {s === "medium" && "Moyenne (13x13)"}
                {s === "large" && "Classique (17x17)"}
              </button>
            ))}
          </div>

          <button
            onClick={startSolo}
            className="rounded-lg border-2 border-ink bg-[var(--player-blue-fill)] px-4 py-4 text-sm font-bold text-[var(--player-blue-text)] shadow-stack transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
          >
            Jouer contre le Robot 🤖
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => createRoom(2)}
              className="rounded-lg border-2 border-ink bg-surface px-4 py-4 text-sm font-bold text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
            >
              Créer (2 joueurs)
            </button>
            <button
              onClick={() => createRoom(4)}
              className="rounded-lg border-2 border-ink bg-surface px-4 py-4 text-sm font-bold text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
            >
              Créer (4 joueurs)
            </button>
          </div>

          <div className="mt-1 flex gap-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Code de partie…"
              className="flex-1 rounded-lg border-2 border-ink bg-ground px-4 py-3 text-sm font-bold text-ink outline-none placeholder:font-medium placeholder:opacity-50 focus:bg-surface"
            />
            <button
              onClick={joinRoom}
              className="rounded-lg border-2 border-ink bg-surface px-6 py-3 text-sm font-bold text-ink shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
            >
              Rejoindre
            </button>
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border-[3px] border-ink bg-surface p-6 shadow-stack">
            <h2 className="mb-4 font-display text-2xl text-ink">Comment jouer ?</h2>
            <div className="space-y-3 text-sm font-medium text-ink/80">
              <p>📍 <strong>Le But :</strong> Conquérir le plus grand nombre de cases avant que la grille ne soit remplie.</p>
              <p>✏️ <strong>Tour de jeu :</strong> Tracez un trait (horizontal ou vertical) entre deux points.</p>
              <p>📦 <strong>Capture :</strong> Si votre trait ferme une case, elle devient vôtre (feu d'artifice à la clé !) et <strong>vous rejouez immédiatement</strong>.</p>
              <p>🤖 <strong>Robot :</strong> Affrontez notre système algorithmique pour vous entraîner.</p>
              <p>👥 <strong>Multijoueur :</strong> Créez un salon privé et partagez le code à vos amis pour jouer en temps réel !</p>
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full rounded-lg border-2 border-ink bg-[var(--player-green-fill)] px-4 py-3 font-bold text-ink shadow-stack-sm active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
            >
              C'est compris !
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
