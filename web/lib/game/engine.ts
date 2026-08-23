/**
 * Moteur de jeu pur (aucune dépendance React/réseau).
 *
 * Utilisé tel quel :
 *  - côté client pour le mode Solo / hotseat local,
 *  - côté serveur (FastAPI ou une Supabase Edge Function) comme source de
 *    vérité, en portant la même logique (voir server/app/game_engine.py,
 *    volontairement écrit en miroir de ce fichier).
 *
 * Toute fonction retourne un nouvel état (immutabilité) pour rester
 * facilement diffusable via WebSocket / Supabase Realtime.
 */

import type { EdgeType, GameState, Player, BoardSize } from "../types/game";
import { WALL_EDGE } from "../types/game";

export function createEmptyGameState(params: {
  roomId: string;
  size?: BoardSize;
  players: Player[];
  mode?: GameState["mode"];
}): GameState {
  const { roomId, mode = "multiplayer", size = "large" } = params;
  
  let rows = 17;
  let cols = 17;
  let radius = 8;
  
  if (size === "small") {
    rows = 9;
    cols = 9;
    radius = 4;
  } else if (size === "medium") {
    rows = 13;
    cols = 13;
    radius = 6;
  }

  const horizontalEdges: (string | null)[][] = Array.from({ length: rows + 1 }, () => Array(cols).fill(WALL_EDGE));
  const verticalEdges: (string | null)[][] = Array.from({ length: rows }, () => Array(cols + 1).fill(WALL_EDGE));
  const boxes: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill("OUTSIDE"));

  const isPlayable = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && Math.abs(r - radius) + Math.abs(c - radius) <= radius;

  const playableCells: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isPlayable(r, c)) playableCells.push({ r, c });
    }
  }

  // Une bordure entre deux cases jouables reste à dessiner (null) ; une
  // bordure face à une case hors-losange est le contour de l'arène et reste
  // WALL_EDGE (déjà tracée, non jouable) — pas de blanket-null ici.
  for (const { r, c } of playableCells) {
    boxes[r][c] = null;
    horizontalEdges[r][c] = isPlayable(r - 1, c) ? null : WALL_EDGE;
    horizontalEdges[r + 1][c] = isPlayable(r + 1, c) ? null : WALL_EDGE;
    verticalEdges[r][c] = isPlayable(r, c - 1) ? null : WALL_EDGE;
    verticalEdges[r][c + 1] = isPlayable(r, c + 1) ? null : WALL_EDGE;
  }

  // Les 4 pointes du losange sont pré-remplies (déjà capturées par leur
  // joueur) : on stamp leurs 4 bordures avec l'id du joueur, ce qui écrase
  // sans distinction ce que la boucle ci-dessus venait d'y mettre.
  // Les 4 pointes du losange sont pré-remplies (déjà capturées par leur joueur)
  const baseCells: Record<number, { r: number; c: number }[]> = {};
  if (params.players.length === 2) {
    baseCells[0] = [{ r: 0, c: radius }, { r: rows - 1, c: radius }]; // Joueur 1: Haut et Bas
    baseCells[1] = [{ r: radius, c: 0 }, { r: radius, c: cols - 1 }]; // Joueur 2: Gauche et Droite
  } else {
    baseCells[0] = [{ r: 0, c: radius }];
    baseCells[1] = [{ r: radius, c: cols - 1 }];
    baseCells[2] = [{ r: rows - 1, c: radius }];
    baseCells[3] = [{ r: radius, c: 0 }];
  }

  params.players.forEach((player, idx) => {
    if (baseCells[idx]) {
      baseCells[idx].forEach(({ r, c }) => {
        boxes[r][c] = player.id;
        horizontalEdges[r][c] = player.id;
        horizontalEdges[r + 1][c] = player.id;
        verticalEdges[r][c] = player.id;
        verticalEdges[r][c + 1] = player.id;
      });
    }
  });

  return {
    roomId,
    mode,
    size,
    rows,
    cols,
    players: params.players,
    currentPlayerIndex: 0,
    horizontalEdges,
    verticalEdges,
    boxes,
    status: params.players.length >= 2 ? "playing" : "waiting",
    winnerId: null,
    lastMove: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    messages: [],
  };
}

/** Les 1 ou 2 cases adjacentes à une bordure donnée. */
export function getAdjacentBoxes(
  type: EdgeType,
  row: number,
  col: number,
  rows: number,
  cols: number
): { row: number; col: number }[] {
  const result: { row: number; col: number }[] = [];
  if (type === "h") {
    // bordure horizontale (row, col): touche la case au-dessus (row-1, col)
    // et la case en dessous (row, col)
    if (row - 1 >= 0) result.push({ row: row - 1, col });
    if (row < rows) result.push({ row, col });
  } else {
    // bordure verticale (row, col): touche la case à gauche (row, col-1)
    // et la case à droite (row, col)
    if (col - 1 >= 0) result.push({ row, col: col - 1 });
    if (col < cols) result.push({ row, col });
  }
  return result;
}

function isBoxClosed(state: GameState, row: number, col: number): boolean {
  return (
    state.horizontalEdges[row][col] !== null &&
    state.horizontalEdges[row + 1][col] !== null &&
    state.verticalEdges[row][col] !== null &&
    state.verticalEdges[row][col + 1] !== null
  );
}

export class InvalidMoveError extends Error {}

export interface ApplyMoveResult {
  state: GameState;
  /** Cases capturées par CE coup (règle "séparation de bloc" : peut en contenir 2 d'un coup) */
  capturedBoxes: { row: number; col: number }[];
  /** true si le joueur rejoue (a capturé au moins une case) */
  playAgain: boolean;
  gameOver: boolean;
}

export function applyMove(
  prev: GameState,
  type: EdgeType,
  row: number,
  col: number,
  playerId: string
): ApplyMoveResult {
  if (prev.status !== "playing") {
    throw new InvalidMoveError("La partie n'est pas en cours.");
  }
  const currentPlayer = prev.players[prev.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new InvalidMoveError("Ce n'est pas votre tour.");
  }

  const edgeGrid = type === "h" ? prev.horizontalEdges : prev.verticalEdges;
  if (edgeGrid[row]?.[col] === undefined) {
    throw new InvalidMoveError("Bordure hors grille.");
  }
  if (edgeGrid[row][col] !== null) {
    throw new InvalidMoveError("Cette bordure est déjà tracée.");
  }

  const horizontalEdges = prev.horizontalEdges.map((r) => [...r]);
  const verticalEdges = prev.verticalEdges.map((r) => [...r]);
  const boxes = prev.boxes.map((r) => [...r]);

  (type === "h" ? horizontalEdges : verticalEdges)[row][col] = playerId;
  const checkState: GameState = { ...prev, horizontalEdges, verticalEdges, boxes };

  const capturedBoxes: { row: number; col: number }[] = [];
  for (const box of getAdjacentBoxes(type, row, col, prev.rows, prev.cols)) {
    if (boxes[box.row][box.col] === null && isBoxClosed(checkState, box.row, box.col)) {
      boxes[box.row][box.col] = playerId;
      capturedBoxes.push(box);
    }
  }

  const players = prev.players.map((p) =>
    p.id === playerId ? { ...p, score: p.score + capturedBoxes.length } : p
  );

  let totalBoxes = 0;
  for (let r = 0; r < prev.rows; r++) {
    for (let c = 0; c < prev.cols; c++) {
      if (prev.boxes[r][c] !== "OUTSIDE") {
        totalBoxes++;
      }
    }
  }
  // The base cells (4 for radius >= 1) are pre-filled
  const boxesFilled = players.reduce((sum, p) => sum + p.score, 0);
  const gameOver = boxesFilled + 4 >= totalBoxes;
  const playAgain = false; // Règle modifiée : on ne rejoue jamais, même si on capture !

  const currentPlayerIndex = playAgain
    ? prev.currentPlayerIndex
    : (prev.currentPlayerIndex + 1) % prev.players.length;

  let winnerId: string | null = null;
  if (gameOver) {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const isTie = ranked.length > 1 && ranked[0].score === ranked[1].score;
    winnerId = isTie ? null : ranked[0].id;
  }

  const state: GameState = {
    ...prev,
    horizontalEdges,
    verticalEdges,
    boxes,
    players,
    currentPlayerIndex,
    status: gameOver ? "finished" : "playing",
    winnerId,
    lastMove: { type, row, col, playerId },
  };

  return { state, capturedBoxes, playAgain, gameOver };
}

/** Toutes les bordures encore libres — pratique pour un coup IA aléatoire/naïf. */
export function listAvailableMoves(state: GameState): { type: EdgeType; row: number; col: number }[] {
  const moves: { type: EdgeType; row: number; col: number }[] = [];
  state.horizontalEdges.forEach((r, row) =>
    r.forEach((v, col) => v === null && moves.push({ type: "h", row, col }))
  );
  state.verticalEdges.forEach((r, row) =>
    r.forEach((v, col) => v === null && moves.push({ type: "v", row, col }))
  );
  return moves;
}
