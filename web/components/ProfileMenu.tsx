"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState, useRef, useEffect } from "react";
import { LogOut, Moon, Sun, Music, Volume2, Pencil, History, X } from "lucide-react";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useHistoryStore } from "@/lib/store/useHistoryStore";

export function ProfileMenu() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { musicEnabled, setMusicEnabled, sfxEnabled, setSfxEnabled, customInitials, setCustomInitials } = useSettingsStore();
  const { matches: localMatches, clearHistory } = useHistoryStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isEditingInitials, setIsEditingInitials] = useState(false);
  const [initialsInput, setInitialsInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session || !mounted) return null;

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 rounded-full border-2 border-ink bg-surface py-1 pl-1 pr-4 shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
      >
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-8 w-8 rounded-full shadow-sm" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
            {customInitials || session.user?.initials}
          </div>
        )}
        <span className="font-bold text-sm text-ink">{session.user?.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border-2 border-ink bg-surface p-2 shadow-stack">
          <div className="mb-2 border-b-2 border-line px-3 pb-2 pt-2">
            <p className="font-display text-sm text-ink">Paramètres</p>
          </div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-[var(--ground)]"
          >
            {theme === "dark" ? (
              <>
                <Sun size={18} />
                Mode Clair
              </>
            ) : (
              <>
                <Moon size={18} />
                Mode Sombre
              </>
            )}
          </button>

          <button
            onClick={() => setMusicEnabled(!musicEnabled)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-[var(--ground)]"
          >
            <div className="flex items-center gap-3">
              <Music size={18} />
              Musique
            </div>
            <div className={`h-4 w-8 rounded-full border-2 border-ink transition-colors ${musicEnabled ? "bg-[var(--player-blue-fill)]" : "bg-neutral-300 dark:bg-neutral-700"} relative`}>
              <div className={`absolute top-0.5 h-2 w-2 rounded-full border border-ink bg-white transition-transform ${musicEnabled ? "left-3 translate-x-1" : "left-0.5"}`} />
            </div>
          </button>

          <button
            onClick={() => setSfxEnabled(!sfxEnabled)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-[var(--ground)]"
          >
            <div className="flex items-center gap-3">
              <Volume2 size={18} />
              Bruitages
            </div>
            <div className={`h-4 w-8 rounded-full border-2 border-ink transition-colors ${sfxEnabled ? "bg-[var(--player-blue-fill)]" : "bg-neutral-300 dark:bg-neutral-700"} relative`}>
              <div className={`absolute top-0.5 h-2 w-2 rounded-full border border-ink bg-white transition-transform ${sfxEnabled ? "left-3 translate-x-1" : "left-0.5"}`} />
            </div>
          </button>

          <div className="my-1 border-t-2 border-line" />

          <div className="px-3 py-2">
            {!isEditingInitials ? (
              <button
                onClick={() => {
                  setInitialsInput(customInitials || session.user?.initials || "");
                  setIsEditingInitials(true);
                }}
                className="flex w-full items-center justify-between text-sm font-bold text-ink hover:opacity-75"
              >
                <span>Initiales ({customInitials || session.user?.initials})</span>
                <Pencil size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={2}
                  autoFocus
                  value={initialsInput}
                  onChange={(e) => setInitialsInput(e.target.value.toUpperCase())}
                  className="w-12 rounded-lg border-2 border-ink bg-surface px-2 py-1 text-center font-display text-sm uppercase text-ink outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    setCustomInitials(initialsInput || null);
                    setIsEditingInitials(false);
                  }}
                  className="rounded-lg border-2 border-ink bg-[var(--player-blue-fill)] px-3 py-1 font-display text-xs text-ink hover:opacity-90 active:translate-y-px"
                >
                  OK
                </button>
              </div>
            )}
          </div>
          
          <div className="my-1 border-t-2 border-line" />

          <button
            onClick={() => {
              setIsOpen(false);
              setShowHistory(true);
              
              if (session.user?.email) {
                setIsLoadingHistory(true);
                const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
                fetch(`${baseUrl}/users/${session.user.email}/history`)
                  .then(r => r.json())
                  .then(data => {
                    if (data && data.matches) {
                      setMatches(data.matches);
                    }
                  })
                  .catch(err => console.error("Erreur historique:", err))
                  .finally(() => setIsLoadingHistory(false));
              } else {
                setMatches(localMatches);
              }
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-[var(--ground)]"
          >
            <History size={18} />
            Historique
          </button>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-[var(--player-red-fill)] transition-colors hover:bg-[var(--player-red-soft)]"
          >
            <LogOut size={18} />
            Se déconnecter
          </button>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border-[3px] border-ink bg-surface shadow-stack">
            <div className="flex items-center justify-between border-b-2 border-line p-4">
              <h2 className="font-display text-xl text-ink">Historique</h2>
              <button onClick={() => setShowHistory(false)} className="rounded-lg p-1 text-ink hover:bg-ground">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingHistory ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-ink"></div>
                </div>
              ) : matches.length === 0 ? (
                <p className="text-center text-sm font-medium text-ink/60">Aucune partie terminée pour le moment.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {matches.map((match) => (
                    <div key={match.id} className="rounded-lg border-2 border-line p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-ink/60">
                          {new Date(match.date).toLocaleDateString()}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                          {match.mode}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {match.players
                          .sort((a: any, b: any) => b.score - a.score)
                          .map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className={`font-medium ${p.isWinner ? "font-bold text-[var(--player-green-fill)]" : "text-ink"}`}>
                                {p.displayName} {p.isWinner && "👑"}
                              </span>
                              <span className="font-bold">{p.score}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {matches.length > 0 && (
              <div className="border-t-2 border-line p-4">
                <button
                  onClick={clearHistory}
                  className="w-full rounded-lg border-2 border-ink bg-[var(--player-red-soft)] px-4 py-2 text-sm font-bold text-[var(--player-red-text)] transition-all hover:opacity-80 active:translate-x-px active:translate-y-px"
                >
                  Effacer l'historique
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
