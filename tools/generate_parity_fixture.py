"""
Génère tests/fixtures/game_script.json : un scénario de jeu déterministe
joué par le moteur PYTHON (source du golden file), puis rejoué par :

  - server/tests/test_engine_parity.py   (pytest, moteur Python)
  - web/tests/engine-parity.test.ts      (vitest, moteur TypeScript)

Si les deux moteurs divergent jamais (modification d'un seul des deux),
le test qui rejoue le scénario échoue immédiatement.

Toute séquence de bords deux-à-deux distincts est une partie valide :
le moteur alterne lui-même les joueurs (règle "pas de re-jouer après
capture"), donc pas besoin de stratégie particulière ici.

Lancer :  python tools/generate_parity_fixture.py   (à la racine du repo)
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from app.game_engine import apply_move, create_empty_game_state  # noqa: E402
from app.models import Player  # noqa: E402

SEED = 42
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "game_script.json"

SCENARIOS = [
    {
        "name": "duel-medium",
        "size": "medium",
        "players": [
            {"id": "alice@example.com", "displayName": "Alice", "initials": "AL"},
            {"id": "bob@example.com", "displayName": "Bob", "initials": "BO"},
        ],
    },
    {
        "name": "quad-small",
        "size": "small",
        "players": [
            {"id": "alice@example.com", "displayName": "Alice", "initials": "AL"},
            {"id": "bob@example.com", "displayName": "Bob", "initials": "BO"},
            {"id": "carol@example.com", "displayName": "Carol", "initials": "CA"},
            {"id": "dan@example.com", "displayName": "Dan", "initials": "DA"},
        ],
    },
]


def enumerate_edges(rows: int, cols: int):
    edges = [("h", r, c) for r in range(rows + 1) for c in range(cols)]
    edges += [("v", r, c) for r in range(rows) for c in range(cols + 1)]
    return edges


def run_scenario(scenario: dict) -> dict:
    rng = random.Random(SEED)
    py_players = [Player(id=p["id"], display_name=p["displayName"], initials=p["initials"]) for p in scenario["players"]]
    room_id = f"parity-{scenario['name']}"

    state = create_empty_game_state(room_id, scenario["size"], list(py_players))
    assert state.status == "playing", "Le scénario doit démarrer avec au moins 2 joueurs"

    initial = {
        "rows": state.rows,
        "cols": state.cols,
        "horizontalEdges": state.horizontal_edges,
        "verticalEdges": state.vertical_edges,
        "boxes": state.boxes,
    }

    moves = []
    steps = []
    total_captures = 0

    candidates = enumerate_edges(state.rows, state.cols)
    rng.shuffle(candidates)

    for edge_type, row, col in candidates:
        player = state.players[state.current_player_index]
        try:
            result = apply_move(state, edge_type, row, col, player.id)
        except Exception as exc:  # bord hors losange => WALL déjà tracé, on passe
            if "déjà tracée" not in str(exc):
                raise
            continue

        moves.append({"type": edge_type, "row": row, "col": col})
        total_captures += len(result.captured_boxes)
        steps.append(
            {
                "captured": len(result.captured_boxes),
                "currentPlayerIndex": result.state.current_player_index,
                "scores": [p.score for p in result.state.players],
            }
        )
        state = result.state
        if result.game_over:
            break

    assert total_captures > 0, f"{scenario['name']} : aucun capture dans le scénario, test inutile"
    assert state.status == "finished", f"{scenario['name']} : la partie doit être terminée"

    dump = state.model_dump(mode="json", by_alias=True)
    final = {
        "rows": dump["rows"],
        "cols": dump["cols"],
        "horizontalEdges": dump["horizontalEdges"],
        "verticalEdges": dump["verticalEdges"],
        "boxes": dump["boxes"],
        "currentPlayerIndex": dump["currentPlayerIndex"],
        "status": dump["status"],
        "winnerId": dump["winnerId"],
        "endReason": dump["endReason"],
        "lastMove": dump["lastMove"],
        "scores": [p["score"] for p in dump["players"]],
    }

    return {
        "name": scenario["name"],
        "size": scenario["size"],
        "roomId": room_id,
        "seed": SEED,
        "players": scenario["players"],
        "initial": initial,
        "moves": moves,
        "steps": steps,
        "final": final,
    }


def main() -> None:
    fixture = {"scenarios": [run_scenario(s) for s in SCENARIOS]}
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_PATH.write_text(json.dumps(fixture, indent=2), encoding="utf-8")
    for s in fixture["scenarios"]:
        print(f"{s['name']}: {len(s['moves'])} coups, gagnant={s['final']['winnerId']}")
    print(f"Écrit dans {FIXTURE_PATH}")


if __name__ == "__main__":
    main()
