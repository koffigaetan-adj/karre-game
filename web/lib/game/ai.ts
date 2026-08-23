/**
 * IA solo — pas de LLM, pas d'appel réseau : un algorithme classique pour
 * dots-and-boxes basé sur 3 règles, dans l'ordre :
 *
 *  1. Si un coup capture une case, le jouer (et laisser la boucle de partie
 *     rejouer immédiatement, comme un humain).
 *  2. Sinon, jouer un coup "sûr" : qui ne porte aucune case adjacente à
 *     3 bordures (ce qui l'offrirait à l'adversaire au tour suivant).
 *  3. Si aucun coup sûr n'existe (fin de partie, chaînes ouvertes), il faut
 *     sacrifier une case : en "easy" on choisit au hasard, en "medium" on
 *     simule la capture en cascade que l'adversaire obtiendrait pour chaque
 *     coup possible et on choisit celui qui lui en laisse le moins.
 */

import type { EdgeType, GameState } from "../types/game";
import { getAdjacentBoxes, listAvailableMoves } from "./engine";

export type AiDifficulty = "easy" | "medium";

type EdgeGrid = (string | null)[][];

function boxFilledCount(h: EdgeGrid, v: EdgeGrid, row: number, col: number): number {
  return (
    (h[row][col] !== null ? 1 : 0) +
    (h[row + 1][col] !== null ? 1 : 0) +
    (v[row][col] !== null ? 1 : 0) +
    (v[row][col + 1] !== null ? 1 : 0)
  );
}

function wouldCapture(state: GameState, type: EdgeType, row: number, col: number): boolean {
  return getAdjacentBoxes(type, row, col, state.rows, state.cols).some(
    (box) => boxFilledCount(state.horizontalEdges, state.verticalEdges, box.row, box.col) === 3
  );
}

/** Sûr = ne fait passer aucune case adjacente de 2 à 3 bordures tracées. */
function isSafeMove(state: GameState, type: EdgeType, row: number, col: number): boolean {
  return getAdjacentBoxes(type, row, col, state.rows, state.cols).every(
    (box) => boxFilledCount(state.horizontalEdges, state.verticalEdges, box.row, box.col) < 2
  );
}

/** Simule la capture immédiate qu'obtiendrait l'adversaire (sans cascade, puisque le rejeu est désactivé). */
function simulateOpponentCapture(h: EdgeGrid, v: EdgeGrid, rows: number, cols: number): number {
  let captured = 0;
  const done = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (done[row][col] || boxFilledCount(h, v, row, col) !== 3) continue;
      if (h[row][col] === null) h[row][col] = "SIM";
      else if (h[row + 1][col] === null) h[row + 1][col] = "SIM";
      else if (v[row][col] === null) v[row][col] = "SIM";
      else v[row][col + 1] = "SIM";
      done[row][col] = true;
      captured++;
    }
  }
  return captured;
}

export function pickBotMove(
  state: GameState,
  difficulty: AiDifficulty = "easy"
): { type: EdgeType; row: number; col: number } {
  const available = listAvailableMoves(state);
  if (available.length === 0) throw new Error("Aucun coup disponible.");

  const capturing = available.filter((m) => wouldCapture(state, m.type, m.row, m.col));
  if (capturing.length > 0) return pickRandom(capturing);

  const safe = available.filter((m) => isSafeMove(state, m.type, m.row, m.col));
  if (safe.length > 0) return pickRandom(safe);

  if (difficulty === "easy") return pickRandom(available);

  // "medium" : minimiser la cascade offerte à l'adversaire.
  let best = available[0];
  let bestLoss = Infinity;
  for (const move of available) {
    const h = state.horizontalEdges.map((r) => [...r]);
    const v = state.verticalEdges.map((r) => [...r]);
    (move.type === "h" ? h : v)[move.row][move.col] = "SIM";
    // Évaluation : on compte combien l'adversaire pourra capturer immédiatement
    const loss = simulateOpponentCapture(h, v, state.rows, state.cols);
    if (loss < bestLoss) {
      bestLoss = loss;
      best = move;
    }
  }
  return best;
}

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
