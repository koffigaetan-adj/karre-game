import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import { applyMove, createEmptyGameState } from "../lib/game/engine";
import type { EdgeType, Player } from "../lib/types/game";

/**
 * Test de parité : rejoue le scénario golden (généré par le moteur PYTHON via
 * tools/generate_parity_fixture.py) et vérifie que le moteur TypeScript
 * produit exactement les mêmes coups/états.
 *
 * Si ce test échoue après une modification du moteur, le moteur Python
 * (server/app/game_engine.py) doit être mis en miroir, puis le golden file
 * régénéré et les deux tests doivent repasser.
 */

interface GoldenStep {
  captured: number;
  currentPlayerIndex: number;
  scores: number[];
}

interface GoldenScenario {
  name: string;
  size: "small" | "medium" | "large" | "giant";
  roomId: string;
  players: { id: string; displayName: string; initials: string }[];
  initial: {
    rows: number;
    cols: number;
    horizontalEdges: (string | null)[][];
    verticalEdges: (string | null)[][];
    boxes: (string | null)[][];
  };
  moves: { type: EdgeType; row: number; col: number }[];
  steps: GoldenStep[];
  final: Record<string, unknown>;
}

const FIXTURE_PATH = new URL("../../tests/fixtures/game_script.json", import.meta.url);
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as { scenarios: GoldenScenario[] };

function toPlayers(scenario: GoldenScenario): Player[] {
  return scenario.players.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    initials: p.initials,
    color: null,
    score: 0,
    connected: true,
  }));
}

describe("parité engine.ts ↔ game_engine.py (golden file)", () => {
  it("le fixture contient des scénarios", () => {
    expect(fixture.scenarios.length).toBeGreaterThan(0);
  });

  for (const scenario of fixture.scenarios) {
    it(`scénario ${scenario.name} : ${scenario.moves.length} coups identiques côté TS`, () => {
      const state = createEmptyGameState({
        roomId: scenario.roomId,
        size: scenario.size,
        mode: "multiplayer",
        players: toPlayers(scenario),
      });

      // État initial identique au golden
      expect(state.rows).toBe(scenario.initial.rows);
      expect(state.cols).toBe(scenario.initial.cols);
      expect(state.horizontalEdges).toEqual(scenario.initial.horizontalEdges);
      expect(state.verticalEdges).toEqual(scenario.initial.verticalEdges);
      expect(state.boxes).toEqual(scenario.initial.boxes);

      let current = state;
      scenario.moves.forEach((move, i) => {
        const player = current.players[current.currentPlayerIndex];
        const result = applyMove(current, move.type, move.row, move.col, player.id);

        const expected = scenario.steps[i];
        expect(result.capturedBoxes.length, `coup #${i} captures`).toBe(expected.captured);
        expect(
          result.state.players.map((p) => p.score),
          `coup #${i} scores`
        ).toEqual(expected.scores);
        expect(result.state.currentPlayerIndex, `coup #${i} joueur actif`).toBe(expected.currentPlayerIndex);

        current = result.state;
      });

      // État final identique au golden
      expect(current.status).toBe("finished");
      expect(current.rows).toBe((scenario.final as any).rows);
      expect(current.cols).toBe((scenario.final as any).cols);
      expect(current.horizontalEdges).toEqual((scenario.final as any).horizontalEdges);
      expect(current.verticalEdges).toEqual((scenario.final as any).verticalEdges);
      expect(current.boxes).toEqual((scenario.final as any).boxes);
      expect(current.currentPlayerIndex).toBe((scenario.final as any).currentPlayerIndex);
      expect(current.winnerId ?? null).toBe((scenario.final as any).winnerId);
      expect(current.endReason ?? null).toBe((scenario.final as any).endReason);
      expect(current.lastMove).toEqual((scenario.final as any).lastMove);
      expect(current.players.map((p) => p.score)).toEqual((scenario.final as any).scores);
    });
  }
});
