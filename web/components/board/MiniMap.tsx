"use client";

import { PLAYER_COLORS } from "@/lib/types/game";
import type { GameState } from "@/lib/types/game";

interface MiniMapProps {
  state: GameState;
  className?: string;
}

/**
 * Vue miniature non-interactive de l'arène, pour se repérer une fois zoomé
 * sur le plateau principal (mobile notamment). La forme en losange vient des
 * cases jouables elles-mêmes (voir KarreBoard) — pas d'une rotation SVG.
 */
export function MiniMap({ state, className = "" }: MiniMapProps) {
  const { rows, cols } = state;
  const cell = 6;
  const pad = 4;
  const W = cols * cell;
  const H = rows * cell;
  const viewBox = `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`;

  return (
    <div className={`rounded-lg border-2 border-ink bg-surface p-1.5 shadow-stack-sm transition-colors ${className}`}>
      <svg viewBox={viewBox} className="h-16 w-16">
        {state.boxes.map((r, row) =>
          r.map((owner, col) => {
            if (owner === "OUTSIDE" || owner === null) return null;
            const player = state.players.find((p) => p.id === owner);
            const fill = player?.color ? PLAYER_COLORS[player.color].light.fill : "var(--line)";
            return (
              <rect
                key={`${row}-${col}`}
                x={col * cell + 0.5}
                y={row * cell + 0.5}
                width={cell - 1}
                height={cell - 1}
                fill={fill}
                className="transition-colors"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
