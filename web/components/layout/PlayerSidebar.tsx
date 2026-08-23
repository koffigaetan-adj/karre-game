"use client";

import type { ReactNode } from "react";
import { PLAYER_COLORS } from "@/lib/types/game";
import type { GameState } from "@/lib/types/game";
import { LogOut, Share2, SkipForward } from "lucide-react";

interface PlayerSidebarProps {
  state: GameState;
  onInvite?: () => void;
  onQuit?: () => void;
  className?: string;
}

/** Tableau de bord desktop (latéral) / barre d'actions mobile (bas d'écran) — un scorepad de jeu de société. */
export function PlayerSidebar({ state, onInvite, onQuit, className = "" }: PlayerSidebarProps) {
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

      <div className="mt-auto flex gap-2">
        <ActionButton icon={<Share2 size={18} />} label="Inviter" onClick={onInvite} />
        <ActionButton icon={<SkipForward size={18} />} label="Passer" disabled />
        <ActionButton icon={<LogOut size={18} />} label="Quitter" onClick={onQuit} variant="danger" />
      </div>
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
