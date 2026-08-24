from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

EdgeType = Literal["h", "v"]
PlayerColor = Literal["blue", "red", "green", "yellow", "purple", "orange", "cyan", "pink"]
GameStatus = Literal["waiting", "playing", "finished"]
BoardSize = Literal["small", "medium", "large"]


class CamelModel(BaseModel):
    """Champs Python en snake_case, sérialisés en camelCase pour matcher
    web/lib/types/game.ts (GameState, Player, Move) côté frontend."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Player(CamelModel):
    id: str
    display_name: str
    initials: str
    color: Optional[PlayerColor] = None
    score: int = 0
    is_ai: bool = False
    connected: bool = True


class Move(CamelModel):
    type: EdgeType
    row: int
    col: int
    player_id: str

class ChatMessage(CamelModel):
    sender_id: str
    sender_name: str
    text: str
    timestamp: str


class GameState(CamelModel):
    room_id: str
    mode: Literal["solo", "multiplayer"] = "multiplayer"
    size: BoardSize = "large"
    rows: int
    cols: int
    players: list[Player]
    current_player_index: int = 0
    horizontal_edges: list[list[Optional[str]]]
    vertical_edges: list[list[Optional[str]]]
    boxes: list[list[Optional[str]]]
    status: GameStatus = "waiting"
    winner_id: Optional[str] = None
    # Distingue une victoire "normale" (plateau rempli) d'une partie stoppée
    # net par un abandon — l'historique ne doit pas afficher ça comme une
    # vraie victoire/défaite (voir retour utilisateur du 2026-08-24).
    end_reason: Optional[Literal["completed", "forfeit"]] = None
    forfeited_by: Optional[str] = None
    last_move: Optional[Move] = None
    started_at: Optional[str] = None
    messages: list[ChatMessage] = []


class IncomingMove(BaseModel):
    type: EdgeType
    row: int
    col: int


class PushKeys(CamelModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(CamelModel):
    user_id: str
    endpoint: str
    keys: PushKeys
