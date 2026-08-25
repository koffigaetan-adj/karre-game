"""
Test de parité : rejoue le scénario golden (généré par le moteur Python via
tools/generate_parity_fixture.py) et vérifie que le moteur Python produit
toujours exactement les coups/états enregistrés.

Si ce test échoue après une modification du moteur, le moteur TypeScript
(web/lib/game/engine.ts) doit être mis en miroir, puis le golden file
régénéré (python tools/generate_parity_fixture.py) et les deux tests
doivent repasser.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "server"))

from app.game_engine import apply_move, create_empty_game_state  # noqa: E402
from app.models import Player  # noqa: E402

FIXTURE_PATH = ROOT / "tests" / "fixtures" / "game_script.json"


def replay_scenario(scenario: dict) -> None:
    players = [Player(id=p["id"], display_name=p["displayName"], initials=p["initials"]) for p in scenario["players"]]
    state = create_empty_game_state(scenario["roomId"], scenario["size"], list(players))

    initial = {
        "rows": state.rows,
        "cols": state.cols,
        "horizontalEdges": state.horizontal_edges,
        "verticalEdges": state.vertical_edges,
        "boxes": state.boxes,
    }
    assert initial == scenario["initial"], f"{scenario['name']} : état initial divergent"

    for i, move in enumerate(scenario["moves"]):
        player = state.players[state.current_player_index]
        result = apply_move(state, move["type"], move["row"], move["col"], player.id)

        expected_step = scenario["steps"][i]
        actual_step = {
            "captured": len(result.captured_boxes),
            "currentPlayerIndex": result.state.current_player_index,
            "scores": [p.score for p in result.state.players],
        }
        assert actual_step == expected_step, (
            f"{scenario['name']} coup #{i} ({move['type']} {move['row']},{move['col']}) : "
            f"{actual_step} != {expected_step}"
        )
        state = result.state

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
    assert final == scenario["final"], f"{scenario['name']} : état final divergent"


def test_engine_parity_against_golden_file():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    assert fixture["scenarios"], "Le golden file ne doit pas être vide"
    for scenario in fixture["scenarios"]:
        replay_scenario(scenario)
