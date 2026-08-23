"""
Moteur de jeu pur, en miroir de web/lib/game/engine.ts.

Source de vérité côté serveur : chaque coup reçu sur le WebSocket est
validé ici avant d'être diffusé (broadcast) à tous les joueurs du salon.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass

from .models import EdgeType, GameState, Move, Player, BoardSize

# Bordure du pourtour de l'arène : pré-tracée dès la création de la partie,
# non attribuable à un joueur, non jouable. Doit matcher WALL_EDGE dans
# web/lib/types/game.ts.
WALL_EDGE = "WALL"


class InvalidMoveError(Exception):
    pass


def create_empty_game_state(room_id: str, size: BoardSize, players: list[Player]) -> GameState:
    rows = 17
    cols = 17
    radius = 8
    
    if size == "small":
        rows = 9
        cols = 9
        radius = 4
    elif size == "medium":
        rows = 13
        cols = 13
        radius = 6

    horizontal_edges = [[WALL_EDGE] * cols for _ in range(rows + 1)]
    vertical_edges = [[WALL_EDGE] * (cols + 1) for _ in range(rows)]
    boxes = [["OUTSIDE"] * cols for _ in range(rows)]

    def is_playable(r: int, c: int) -> bool:
        return 0 <= r < rows and 0 <= c < cols and abs(r - radius) + abs(c - radius) <= radius

    playable_cells = set()
    for r in range(rows):
        for c in range(cols):
            if is_playable(r, c):
                playable_cells.add((r, c))

    # Une bordure entre deux cases jouables reste à dessiner (None) ; une
    # bordure face à une case hors-losange est le contour de l'arène et
    # reste WALL_EDGE (déjà tracée, non jouable).
    for (r, c) in playable_cells:
        boxes[r][c] = None
        horizontal_edges[r][c] = None if is_playable(r - 1, c) else WALL_EDGE
        horizontal_edges[r + 1][c] = None if is_playable(r + 1, c) else WALL_EDGE
        vertical_edges[r][c] = None if is_playable(r, c - 1) else WALL_EDGE
        vertical_edges[r][c + 1] = None if is_playable(r, c + 1) else WALL_EDGE

    base_cells = {}
    if len(players) == 2:
        base_cells[0] = [(0, radius), (rows - 1, radius)]
        base_cells[1] = [(radius, 0), (radius, cols - 1)]
    else:
        base_cells[0] = [(0, radius)]
        base_cells[1] = [(radius, cols - 1)]
        base_cells[2] = [(rows - 1, radius)]
        base_cells[3] = [(radius, 0)]

    for idx, player in enumerate(players):
        if idx in base_cells:
            for (r, c) in base_cells[idx]:
                boxes[r][c] = player.id
                horizontal_edges[r][c] = player.id
                horizontal_edges[r + 1][c] = player.id
                vertical_edges[r][c] = player.id
                vertical_edges[r][c + 1] = player.id
    return GameState(
        room_id=room_id,
        size=size,
        rows=rows,
        cols=cols,
        players=players,
        current_player_index=0,
        horizontal_edges=horizontal_edges,
        vertical_edges=vertical_edges,
        boxes=boxes,
        status="playing" if len(players) >= 2 else "waiting",
    )


def get_adjacent_boxes(
    edge_type: EdgeType, row: int, col: int, rows: int, cols: int
) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    if edge_type == "h":
        if row - 1 >= 0:
            result.append((row - 1, col))
        if row < rows:
            result.append((row, col))
    else:
        if col - 1 >= 0:
            result.append((row, col - 1))
        if col < cols:
            result.append((row, col))
    return result


def _is_box_closed(state: GameState, row: int, col: int) -> bool:
    return (
        state.horizontal_edges[row][col] is not None
        and state.horizontal_edges[row + 1][col] is not None
        and state.vertical_edges[row][col] is not None
        and state.vertical_edges[row][col + 1] is not None
    )


@dataclass
class ApplyMoveResult:
    state: GameState
    captured_boxes: list[tuple[int, int]]
    play_again: bool
    game_over: bool


def apply_move(prev: GameState, edge_type: EdgeType, row: int, col: int, player_id: str) -> ApplyMoveResult:
    if prev.status != "playing":
        raise InvalidMoveError("La partie n'est pas en cours.")

    current_player = prev.players[prev.current_player_index]
    if current_player.id != player_id:
        raise InvalidMoveError("Ce n'est pas votre tour.")

    edge_grid = prev.horizontal_edges if edge_type == "h" else prev.vertical_edges
    if not (0 <= row < len(edge_grid)) or not (0 <= col < len(edge_grid[0])):
        raise InvalidMoveError("Bordure hors grille.")
    if edge_grid[row][col] is not None:
        raise InvalidMoveError("Cette bordure est déjà tracée.")

    state = prev.model_copy(deep=True)
    grid = state.horizontal_edges if edge_type == "h" else state.vertical_edges
    grid[row][col] = player_id

    captured_boxes: list[tuple[int, int]] = []
    for br, bc in get_adjacent_boxes(edge_type, row, col, state.rows, state.cols):
        if state.boxes[br][bc] is None and _is_box_closed(state, br, bc):
            state.boxes[br][bc] = player_id
            captured_boxes.append((br, bc))

    for player in state.players:
        if player.id == player_id:
            player.score += len(captured_boxes)

    total_boxes = sum(1 for row in state.boxes for box in row if box != "OUTSIDE")
    boxes_filled = sum(p.score for p in state.players)
    game_over = (boxes_filled + 4) >= total_boxes
    play_again = False # Règle modifiée : on ne rejoue jamais, même si on capture !

    if not play_again:
        state.current_player_index = (state.current_player_index + 1) % len(state.players)

    if game_over:
        ranked = sorted(state.players, key=lambda p: p.score, reverse=True)
        is_tie = len(ranked) > 1 and ranked[0].score == ranked[1].score
        state.winner_id = None if is_tie else ranked[0].id
        state.status = "finished"

    state.last_move = Move(type=edge_type, row=row, col=col, player_id=player_id)

    return ApplyMoveResult(
        state=state, captured_boxes=captured_boxes, play_again=play_again, game_over=game_over
    )
