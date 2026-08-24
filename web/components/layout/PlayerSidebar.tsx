"use client";

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { PLAYER_COLORS } from "@/lib/types/game";
import type { GameState } from "@/lib/types/game";
import { LogOut, Share2, SkipForward, RefreshCw, Send } from "lucide-react";
import { playChatNotification } from "@/lib/audio";
import { useSettingsStore } from "@/lib/store/useSettingsStore";

interface PlayerSidebarProps {
  state: GameState;
  isSolo?: boolean;
  currentUserId?: string;
  onInvite?: () => void;
  onQuit?: () => void;
  onRematch?: () => void;
  onChat?: (text: string) => void;
  className?: string;
}

/** Tableau de bord desktop (latéral) / barre d'actions mobile (bas d'écran) — un scorepad de jeu de société. */
export function PlayerSidebar({ state, isSolo = false, currentUserId, onInvite, onQuit, onRematch, onChat, className = "" }: PlayerSidebarProps) {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [chatText, setChatText] = useState("");
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(state.messages?.length || 0);
  const { sfxEnabled } = useSettingsStore();

  useEffect(() => {
    const msgs = state.messages || [];
    if (msgs.length > prevMessagesLength.current) {
      // Autoscroll
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      
      const lastMsg = msgs[msgs.length - 1];
      // Si c'est le message de quelqu'un d'autre
      if (lastMsg && lastMsg.senderId !== currentUserId) {
        setHasNewMessage(true);
        if (sfxEnabled) {
          playChatNotification(true);
        }
      }
    }
    prevMessagesLength.current = msgs.length;
  }, [state.messages, currentUserId, sfxEnabled]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim() && onChat) {
      onChat(chatText);
      setChatText("");
    }
  };
  return (
    <aside className={`flex flex-col gap-4 ${className}`}>
      <div className="rounded-xl border-2 border-line bg-surface p-4 transition-colors">
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-ink">Joueurs</h2>
        <ul className="flex flex-col gap-2">
          {state.players.map((player, i) => {
            const colors = player.color ? PLAYER_COLORS[player.color].light : null;
            const isTurn = state.status === "playing" && i === state.currentPlayerIndex;
            return (
              <li
                key={player.id}
                className={`flex items-center gap-3 rounded-lg border-2 px-2.5 py-2 transition-all ${
                  isTurn ? "border-ink shadow-stack-sm" : "border-transparent"
                }`}
                style={{ background: isTurn && colors ? colors.soft : "transparent" }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-display text-sm"
                  style={
                    colors
                      ? { background: colors.fill, color: colors.text, borderColor: colors.ring }
                      : { background: "var(--ground)", color: "var(--line)", borderColor: "var(--line)" }
                  }
                >
                  {player.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {player.displayName}
                    {!player.connected && <span className="ml-1 text-xs font-medium opacity-60">(déconnecté)</span>}
                  </p>
                  {isTurn && <p className="text-xs font-medium opacity-70">à son tour…</p>}
                </div>
                <span className="font-display text-xl tabular-nums text-ink">{player.score}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {state.status === "finished" && (
        <div className="rounded-xl border-2 border-ink bg-surface p-4 shadow-stack-sm">
          <p className="font-display text-lg text-ink">
            {state.winnerId
              ? `Vainqueur : ${state.players.find((p) => p.id === state.winnerId)?.displayName}`
              : "Égalité !"}
          </p>
        </div>
      )}

      {state.status === "finished" && onRematch && (
        <button
          onClick={onRematch}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-[var(--player-blue-fill)] px-4 py-3 font-display text-lg text-surface shadow-stack active:translate-x-px active:translate-y-px active:shadow-stack-pressed transition-all"
        >
          <RefreshCw size={20} />
          Rejouer la partie
        </button>
      )}

      {/* CHAT BOX */}
      {!isSolo && state.status !== "waiting" && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-line bg-surface p-3 h-48">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-sm uppercase tracking-wide text-ink">Chat</h2>
            {hasNewMessage && (
              <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--player-red-fill)] animate-pulse" title="Nouveau message" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 text-sm pr-2 scrollbar-thin scrollbar-thumb-ink/20 scrollbar-track-transparent">
            {state.messages?.map((msg, idx) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] font-bold opacity-50 mb-0.5">{msg.senderName}</span>
                  <div className={`px-2 py-1.5 rounded-lg max-w-[90%] break-words ${isMe ? "bg-ink text-surface rounded-br-none" : "bg-ground border border-line rounded-bl-none text-ink"}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2 mt-auto pt-2 border-t border-line">
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onFocus={() => setHasNewMessage(false)}
              onClick={() => setHasNewMessage(false)}
              placeholder="Message..."
              className="flex-1 rounded-md border border-line bg-ground px-2 py-1.5 text-sm outline-none focus:border-ink"
            />
            <button type="submit" disabled={!chatText.trim()} className="rounded-md bg-ink p-1.5 text-surface disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        {!isSolo && state.status === "waiting" && <ActionButton icon={<Share2 size={18} />} label="Inviter" onClick={onInvite} />}
        {state.status !== "finished" && <ActionButton icon={<SkipForward size={18} />} label="Passer" disabled />}
        <ActionButton
          icon={<LogOut size={18} />}
          label="Quitter"
          onClick={() => {
            if (state.status === "finished" || state.status === "waiting") {
              onQuit?.();
            } else {
              setShowQuitConfirm(true);
            }
          }}
          variant="danger"
        />
      </div>

      {/* Alerte de confirmation pour quitter */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border-[3px] border-ink bg-surface p-6 shadow-stack text-center">
            <h3 className="font-display text-xl text-[var(--player-red-fill)] mb-2">Attention !</h3>
            <p className="text-sm font-bold text-ink/80 mb-6">
              Êtes-vous sûr de vouloir quitter la partie ? Si vous quittez maintenant, vous serez déclaré perdant par forfait.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="flex-1 rounded-lg border-2 border-ink bg-ground px-4 py-2 font-bold text-ink hover:bg-ink/5 active:translate-x-px active:translate-y-px"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowQuitConfirm(false);
                  onQuit?.();
                }}
                className="flex-1 rounded-lg border-2 border-ink bg-[var(--player-red-fill)] px-4 py-2 font-bold text-surface shadow-stack-sm active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
              >
                Abandonner
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 text-xs font-bold shadow-stack-sm transition-all active:translate-x-px active:translate-y-px active:shadow-stack-pressed disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
        variant === "danger" ? "border-ink bg-surface text-[var(--player-red-fill)]" : "border-ink bg-surface text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
