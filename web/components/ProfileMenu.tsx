"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState, useRef, useEffect, useMemo } from "react";
import { LogOut, Moon, Sun, Music, Volume2, Bell, Pencil, History, X, Trophy, Flame } from "lucide-react";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useHistoryStore } from "@/lib/store/useHistoryStore";
import { AVATAR_EMOJIS } from "@/lib/emojis";
import { enablePushNotifications, getNotificationPermission } from "@/lib/push";

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
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setNotifPermission(getNotificationPermission());
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotifications = async () => {
    if (notifPermission === "granted" || notifPermission === "denied" || isSubscribing) return;
    setIsSubscribing(true);
    await enablePushNotifications(session?.user?.email || "");
    setNotifPermission(getNotificationPermission());
    setIsSubscribing(false);
  };

  // Victoires totales + série de victoires en cours (la plus récente en tête),
  // pour donner un petit truc à se chambrer entre amis dans l'historique.
  const stats = useMemo(() => {
    const myId = session?.user?.email;
    if (!myId) return { wins: 0, streak: 0 };
    let wins = 0;
    let streak = 0;
    let streakBroken = false;
    for (const m of matches) {
      if (m.endReason === "forfeit") continue; // un abandon n'est ni une victoire ni une défaite
      const me = m.players?.find((p: any) => p.id === myId);
      if (me?.isWinner) {
        wins++;
        if (!streakBroken) streak++;
      } else if (!streakBroken) {
        streakBroken = true;
      }
    }
    return { wins, streak };
  }, [matches, session?.user?.email]);

  if (!session || !mounted) return null;

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 rounded-full border-[1.5px] border-ink dark:border-transparent bg-surface py-1 pl-1 pr-4 shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
      >
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-8 w-8 rounded-full shadow-sm" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--player-blue-fill)] text-xs font-bold text-[var(--player-blue-text)] shadow-sm">
            {customInitials || session.user?.initials}
          </div>
        )}
        <span className="font-bold text-sm text-ink">{session.user?.name}</span>
      </button>

      {isOpen && (
        <div className="animate-menu-in absolute right-0 mt-2 w-56 origin-top-right rounded-xl border-[1.5px] border-ink dark:border-transparent bg-white dark:bg-[#202226] p-2 shadow-stack z-[100]">
          <div className="mb-2 border-b-[1.5px] border-line px-3 pb-2 pt-2">
            <p className="font-display text-xs uppercase tracking-wide text-ink/50">Paramètres</p>
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
            <div className={`h-4 w-8 rounded-full border-[1.5px] border-ink dark:border-transparent transition-colors ${musicEnabled ? "bg-[var(--player-blue-fill)]" : "bg-[var(--line)]"} relative`}>
              <div className={`absolute top-0.5 h-2 w-2 rounded-full border border-ink dark:border-transparent bg-white transition-transform ${musicEnabled ? "left-3 translate-x-1" : "left-0.5"}`} />
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
            <div className={`h-4 w-8 rounded-full border-[1.5px] border-ink dark:border-transparent transition-colors ${sfxEnabled ? "bg-[var(--player-blue-fill)]" : "bg-[var(--line)]"} relative`}>
              <div className={`absolute top-0.5 h-2 w-2 rounded-full border border-ink dark:border-transparent bg-white transition-transform ${sfxEnabled ? "left-3 translate-x-1" : "left-0.5"}`} />
            </div>
          </button>

          {notifPermission !== "unsupported" && (
            <button
              onClick={handleToggleNotifications}
              disabled={notifPermission === "denied" || isSubscribing}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-[var(--ground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <Bell size={18} />
                Notifications
              </div>
              <div
                className={`h-4 w-8 rounded-full border-[1.5px] border-ink dark:border-transparent transition-colors ${
                  notifPermission === "granted" ? "bg-[var(--player-blue-fill)]" : "bg-[var(--line)]"
                } relative`}
              >
                <div
                  className={`absolute top-0.5 h-2 w-2 rounded-full border border-ink dark:border-transparent bg-white transition-transform ${
                    notifPermission === "granted" ? "left-3 translate-x-1" : "left-0.5"
                  }`}
                />
              </div>
            </button>
          )}
          {notifPermission === "denied" && (
            <p className="px-3 pb-1 text-[10px] font-medium leading-snug text-ink/50">
              Bloquées par le navigateur — à réactiver dans ses réglages de site.
            </p>
          )}

          <div className="my-1 border-t-[1.5px] border-line" />

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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={2}
                    autoFocus
                    value={initialsInput}
                    onChange={(e) => setInitialsInput(e.target.value.toUpperCase())}
                    className="w-12 rounded-lg border-[1.5px] border-ink dark:border-transparent bg-surface px-2 py-1 text-center font-display text-sm uppercase text-ink outline-none focus:border-[var(--player-blue-fill)]"
                  />
                  <button
                    onClick={() => {
                      setCustomInitials(initialsInput || null);
                      setIsEditingInitials(false);
                    }}
                    className="rounded-lg border-[1.5px] border-ink dark:border-transparent bg-[var(--player-blue-fill)] px-3 py-1 font-display text-xs text-ink hover:opacity-90 active:translate-y-px"
                  >
                    OK
                  </button>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-50">ou choisis un emoji</p>
                <div className="grid grid-cols-6 gap-1">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setCustomInitials(emoji);
                        setIsEditingInitials(false);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors hover:bg-[var(--ground)] ${
                        customInitials === emoji ? "border-[1.5px] border-ink dark:border-transparent bg-[var(--ground)]" : ""
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="my-1 border-t-[1.5px] border-line" />

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border-2 border-ink dark:border-transparent bg-surface shadow-stack">
            <div className="flex items-center justify-between border-b-[1.5px] border-line p-4">
              <h2 className="font-display text-xl text-ink">Historique</h2>
              <button onClick={() => setShowHistory(false)} className="rounded-lg p-1 text-ink hover:bg-ground">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {!isLoadingHistory && matches.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1 rounded-lg border-[1.5px] border-line bg-ground/50 py-3">
                    <Trophy size={18} className="text-[var(--player-yellow-fill)]" />
                    <span className="font-display text-xl text-ink">{stats.wins}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">Victoires</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-lg border-[1.5px] border-line bg-ground/50 py-3">
                    <Flame size={18} className="text-[var(--player-red-fill)]" />
                    <span className="font-display text-xl text-ink">{stats.streak}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">Série en cours</span>
                  </div>
                </div>
              )}
              {isLoadingHistory ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-ink"></div>
                </div>
              ) : matches.length === 0 ? (
                <p className="text-center text-sm font-medium text-ink/60">Aucune partie terminée pour le moment.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {matches.map((match) => (
                    <div key={match.id} className="rounded-lg border-[1.5px] border-line p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-ink/60">
                          {new Date(match.date).toLocaleDateString()}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                          {match.mode}
                        </span>
                      </div>
                      {match.endReason === "forfeit" ? (
                        <p className="text-sm font-medium text-ink/70">
                          Abandonné par{" "}
                          <span className="font-bold text-ink">
                            {match.forfeitedBy === session.user?.email
                              ? "vous"
                              : match.players.find((p: any) => p.id === match.forfeitedBy)?.displayName || "un joueur"}
                          </span>
                        </p>
                      ) : (
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {matches.length > 0 && (
              <div className="border-t-[1.5px] border-line p-4">
                <button
                  onClick={() => {
                    clearHistory(); // Efface du state local (Zustand)
                    setMatches([]); // Efface de l'affichage courant
                    if (session.user?.email) {
                      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
                      fetch(`${baseUrl}/users/${session.user.email}/history`, {
                        method: "DELETE",
                      }).catch((err) => console.error("Erreur suppression historique:", err));
                    }
                  }}
                  className="w-full rounded-lg bg-[var(--player-red-fill)] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md hover:-translate-y-0.5 active:translate-x-px active:translate-y-px"
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
