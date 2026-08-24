"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { EdgeType, GameState } from "@/lib/types/game";
import { PLAYER_COLORS, WALL_EDGE } from "@/lib/types/game";
import { Bot } from "lucide-react";
import confetti from "canvas-confetti";
import { playClick, playCapture } from "@/lib/audio";
import { useSettingsStore } from "@/lib/store/useSettingsStore";

const CELL = 72; // taille d'une case en unités SVG
const PADDING = 36; // marge autour du losange

interface HoveredEdgeInfo {
  playerId: string;
  type: EdgeType;
  row: number;
  col: number;
}

interface KwadraBoardProps {
  state: GameState;
  /** id de l'utilisateur local ; omis en mode hotseat (tout le monde peut cliquer) */
  currentUserId?: string;
  onPlayEdge: (type: EdgeType, row: number, col: number) => void;
  interactive?: boolean;
  className?: string;
  /** Survol local à relayer aux autres joueurs (multijoueur uniquement). */
  onHoverEdge?: (edge: { type: EdgeType; row: number; col: number } | null) => void;
  /** Survol d'un adversaire, reçu du serveur : aperçu en couleur atténuée. */
  remoteHover?: HoveredEdgeInfo | null;
}

/**
 * Plateau "Karré" : grille logique rectangulaire classique (dots-and-boxes),
 * pivotée de 45° au rendu pour obtenir l'aspect losange/arène demandé.
 * Pan/zoom tactile géré via transform CSS (pas de dépendance externe) —
 * remplaçable par react-zoom-pan-pinch si besoin de gestes plus riches.
 */
export function KwadraBoard({
  state,
  currentUserId,
  onPlayEdge,
  interactive = true,
  className = "",
  onHoverEdge,
  remoteHover = null,
}: KwadraBoardProps) {
  const { rows, cols } = state;

  const W = cols * CELL;
  const H = rows * CELL;
  const padding = 36;
  const viewBox = `${-padding} ${-padding} ${W + padding * 2} ${H + padding * 2}`;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = interactive && (!currentUserId || currentPlayer?.id === currentUserId);
  const previewColor = currentPlayer?.color ? PLAYER_COLORS[currentPlayer.color].light.fill : "var(--ink)";

  const remoteHoverPlayer = remoteHover ? state.players.find((p) => p.id === remoteHover.playerId) : null;
  const remoteHoverColor = remoteHoverPlayer?.color ? PLAYER_COLORS[remoteHoverPlayer.color].light.fill : null;

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [justCaptured, setJustCaptured] = useState<Set<string>>(new Set());
  const [isShaking, setIsShaking] = useState(false);
  const prevBoxesRef = useRef(state.boxes);
  const { sfxEnabled } = useSettingsStore();

  // Détecte les cases nouvellement capturées pour déclencher l'animation de remplissage.
  useEffect(() => {
    const prev = prevBoxesRef.current;
    const changed = new Set<string>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (prev[r]?.[c] == null && state.boxes[r][c] != null) {
          changed.add(`${r}-${c}`);
        }
      }
    }
    if (changed.size > 0) {
      setJustCaptured(changed);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 300);
      playCapture(sfxEnabled);

      // Confetti sur chaque case capturée
      changed.forEach((key) => {
        const [r, c] = key.split("-").map(Number);
        const owner = state.boxes[r][c];
        const player = state.players.find((p) => p.id === owner);
        const colorHex = player?.color ? PLAYER_COLORS[player.color].light.fill : "#ffffff";

        // Coordonnées approximatives pour le confetti
        // Le plateau est centré, on lance depuis le centre global
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: [colorHex],
          disableForReducedMotion: true,
          zIndex: 100,
        });
      });

      const t = setTimeout(() => setJustCaptured(new Set()), 420);
      prevBoxesRef.current = state.boxes;
      return () => clearTimeout(t);
    }
    prevBoxesRef.current = state.boxes;
  }, [state.boxes, rows, cols]);

  const { pan, zoomIn, zoomOut, reset, bind } = usePanZoom();

  const handleEdgeClick = (type: EdgeType, row: number, col: number) => {
    if (!interactive || !isMyTurn) return;
    const grid = type === "h" ? state.horizontalEdges : state.verticalEdges;
    if (grid[row][col] !== null) return;

    playClick(sfxEnabled);
    onPlayEdge(type, row, col);
  };

  const edgeOwnerColor = (owner: string | null) => {
    if (!owner) return null;
    const player = state.players.find((p) => p.id === owner);
    return player && player.color ? PLAYER_COLORS[player.color] : null;
  };

  const boxes = useMemo(() => {
    const list: { row: number; col: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push({ row: r, col: c });
    return list;
  }, [rows, cols]);

  // No corner seats needed as bases are in the grid

  return (
    <div className={`relative w-full min-w-0 select-none ${className} ${isShaking ? "animate-shake" : ""}`}>
      <div
        className="w-full min-w-0 overflow-hidden rounded-xl border border-ink-border bg-surface shadow-stack touch-none transition-colors"
        style={{ aspectRatio: "1 / 1" }}
        {...bind}
      >
        <div
          className="h-full w-full transition-transform duration-75 ease-out"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.scale})` }}
        >
          <svg viewBox={viewBox} className="h-full w-full">
            <rect
              x={-padding}
              y={-padding}
              width={W + padding * 2}
              height={H + padding * 2}
              fill="var(--surface)"
            />

            <g>

              {/* Cases */}
              {boxes.map(({ row, col }) => {
                const owner = state.boxes[row][col];
                if (owner === "OUTSIDE") return null;
                const player = owner ? state.players.find((p) => p.id === owner) : null;
                const colors = player && player.color ? PLAYER_COLORS[player.color] : null;
                const key = `${row}-${col}`;
                const x = col * CELL;
                const y = row * CELL;
                const bx = x + CELL / 2;
                const by = y + CELL / 2;
                return (
                  <g key={key}>
                    <rect
                      x={x + 3}
                      y={y + 3}
                      width={CELL - 6}
                      height={CELL - 6}
                      rx={4}
                      fill={colors ? colors.light.fill : "var(--ground)"}
                      className={justCaptured.has(key) ? "Kwadra-box-pop" : ""}
                      style={{ transformOrigin: `${bx}px ${by}px` }}
                    />
                    {colors && (
                      player?.isAI ? (
                        <foreignObject x={x} y={y} width={CELL} height={CELL} className="flex items-center justify-center">
                          <div className="flex h-full w-full items-center justify-center">
                            <Bot size={CELL * 0.4} color={colors.light.text} />
                          </div>
                        </foreignObject>
                      ) : (
                        <text
                          x={bx}
                          y={by + 1}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={CELL * 0.34}
                          fill={colors.light.text}
                          style={{ fontFamily: "var(--font-body)", fontWeight: "bold" }}
                        >
                          {player?.initials}
                        </text>
                      )
                    )}
                  </g>
                );
              })}

              {/* Bordures horizontales */}
              {state.horizontalEdges.map((r, row) =>
                r.map((owner, col) => {
                  const b1 = row > 0 ? state.boxes[row - 1][col] : "OUTSIDE";
                  const b2 = row < rows ? state.boxes[row][col] : "OUTSIDE";
                  if (b1 === "OUTSIDE" && b2 === "OUTSIDE") return null;

                  const x1 = col * CELL;
                  const x2 = x1 + CELL;
                  const y = row * CELL;
                  const key = `h-${row}-${col}`;
                  const color = edgeOwnerColor(owner);
                  const canPlay = interactive && isMyTurn && owner === null;
                  const hovered = hoveredEdge === key;
                  const isRemoteHovered =
                    !!remoteHoverColor && remoteHover?.type === "h" && remoteHover.row === row && remoteHover.col === col;
                  return (
                    <g key={key}>
                      <line
                        x1={x1}
                        y1={y}
                        x2={x2}
                        y2={y}
                        stroke={
                          owner === WALL_EDGE
                            ? "var(--ink)"
                            : color
                              ? color.light.fill
                              : hovered && canPlay
                                ? previewColor
                                : isRemoteHovered
                                  ? remoteHoverColor!
                                  : "var(--line)"
                        }
                        strokeOpacity={owner === null && !(hovered && canPlay) ? (isRemoteHovered ? 0.45 : 0.7) : 1}
                        strokeWidth={owner !== null ? 4.5 : hovered && canPlay ? 4 : isRemoteHovered ? 3 : 2}
                        strokeDasharray={owner !== null || isRemoteHovered ? undefined : "3 6"}
                        strokeLinecap="round"
                        className="transition-all duration-150"
                      />
                      <line
                        x1={x1}
                        y1={y}
                        x2={x2}
                        y2={y}
                        stroke="transparent"
                        strokeWidth={18}
                        style={{ cursor: canPlay ? "pointer" : "default" }}
                        onPointerEnter={() => {
                          if (!canPlay) return;
                          setHoveredEdge(key);
                          onHoverEdge?.({ type: "h", row, col });
                        }}
                        onPointerLeave={() => {
                          setHoveredEdge((k) => (k === key ? null : k));
                          if (canPlay) onHoverEdge?.(null);
                        }}
                        onClick={() => handleEdgeClick("h", row, col)}
                      />
                    </g>
                  );
                })
              )}

              {/* Bordures verticales */}
              {state.verticalEdges.map((r, row) =>
                r.map((owner, col) => {
                  const b1 = col > 0 ? state.boxes[row][col - 1] : "OUTSIDE";
                  const b2 = col < cols ? state.boxes[row][col] : "OUTSIDE";
                  if (b1 === "OUTSIDE" && b2 === "OUTSIDE") return null;

                  const x = col * CELL;
                  const y1 = row * CELL;
                  const y2 = y1 + CELL;
                  const key = `v-${row}-${col}`;
                  const color = edgeOwnerColor(owner);
                  const canPlay = interactive && isMyTurn && owner === null;
                  const hovered = hoveredEdge === key;
                  const isRemoteHovered =
                    !!remoteHoverColor && remoteHover?.type === "v" && remoteHover.row === row && remoteHover.col === col;
                  return (
                    <g key={key}>
                      <line
                        x1={x}
                        y1={y1}
                        x2={x}
                        y2={y2}
                        stroke={
                          owner === WALL_EDGE
                            ? "var(--ink)"
                            : color
                              ? color.light.fill
                              : hovered && canPlay
                                ? previewColor
                                : isRemoteHovered
                                  ? remoteHoverColor!
                                  : "var(--line)"
                        }
                        strokeOpacity={owner === null && !(hovered && canPlay) ? (isRemoteHovered ? 0.45 : 0.7) : 1}
                        strokeWidth={owner !== null ? 4.5 : hovered && canPlay ? 4 : isRemoteHovered ? 3 : 2}
                        strokeDasharray={owner !== null || isRemoteHovered ? undefined : "3 6"}
                        strokeLinecap="round"
                        className="transition-all duration-150"
                      />
                      <line
                        x1={x}
                        y1={y1}
                        x2={x}
                        y2={y2}
                        stroke="transparent"
                        strokeWidth={18}
                        style={{ cursor: canPlay ? "pointer" : "default" }}
                        onPointerEnter={() => {
                          if (!canPlay) return;
                          setHoveredEdge(key);
                          onHoverEdge?.({ type: "v", row, col });
                        }}
                        onPointerLeave={() => {
                          setHoveredEdge((k) => (k === key ? null : k));
                          if (canPlay) onHoverEdge?.(null);
                        }}
                        onClick={() => handleEdgeClick("v", row, col)}
                      />
                    </g>
                  );
                })
              )}

              {/* Points (dots) */}
              {Array.from({ length: rows + 1 }).map((_, row) =>
                Array.from({ length: cols + 1 }).map((_, col) => {
                  const b1 = row > 0 && col > 0 ? state.boxes[row - 1][col - 1] : "OUTSIDE";
                  const b2 = row > 0 && col < cols ? state.boxes[row - 1][col] : "OUTSIDE";
                  const b3 = row < rows && col > 0 ? state.boxes[row][col - 1] : "OUTSIDE";
                  const b4 = row < rows && col < cols ? state.boxes[row][col] : "OUTSIDE";
                  if (b1 === "OUTSIDE" && b2 === "OUTSIDE" && b3 === "OUTSIDE" && b4 === "OUTSIDE") return null;

                  return (
                    <circle
                      key={`dot-${row}-${col}`}
                      cx={col * CELL}
                      cy={row * CELL}
                      r={2.5}
                      fill="var(--ink)"
                    />
                  );
                })
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* Contrôles zoom, pouce-friendly sur mobile */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <ZoomButton label="+" onClick={zoomIn} />
        <ZoomButton label="−" onClick={zoomOut} />
        <ZoomButton label="⤾" onClick={reset} />
      </div>
    </div>
  );
}

function ZoomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-ink-border bg-surface font-display text-lg text-ink shadow-stack-sm transition-transform active:translate-x-px active:translate-y-px active:shadow-stack-pressed"
    >
      {label}
    </button>
  );
}

/** Pan/zoom minimal par transform CSS, avec support pincement à deux doigts. */
function usePanZoom() {
  const [pan, setPan] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastDist = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const clampScale = (s: number) => Math.min(3, Math.max(0.6, s));

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (err) { }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    } else {
      lastDist.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist.current != null) {
        const delta = dist / lastDist.current;
        setPan((p) => ({ ...p, scale: clampScale(p.scale * delta) }));
      }
      lastDist.current = dist;
    } else if (pointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const startX = dragStart.current.panX;
      const startY = dragStart.current.panY;
      setPan((p) => ({ ...p, x: startX + dx, y: startY + dy }));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch (err) { }
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastDist.current = null;
    if (pointers.current.size === 0) dragStart.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    // Ne pas appeler e.preventDefault() car l'événement peut être passif,
    // ce qui lève une exception non gérée dans React.
    setPan((p) => ({ ...p, scale: clampScale(p.scale - e.deltaY * 0.001) }));
  };

  const zoomIn = () => setPan((p) => ({ ...p, scale: clampScale(p.scale + 0.2) }));
  const zoomOut = () => setPan((p) => ({ ...p, scale: clampScale(p.scale - 0.2) }));
  const reset = () => setPan({ x: 0, y: 0, scale: 1 });

  return {
    pan,
    zoomIn,
    zoomOut,
    reset,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer,
      onWheel,
    },
  };
}
