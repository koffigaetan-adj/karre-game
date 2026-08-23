"""
Backend temps réel FastAPI + WebSockets (Option A de l'architecture).

Alternative à Supabase Realtime : chaque salon ("room") vit en mémoire dans
`ROOMS` (à remplacer par Redis/Postgres pour un déploiement multi-instance).
Chaque client se connecte à /ws/rooms/{room_id}, envoie ses coups en JSON,
reçoit l'état complet du jeu en retour après validation par `game_engine`.

Lancer en local : uvicorn app.main:app --reload
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .game_engine import InvalidMoveError, apply_move, create_empty_game_state
from .models import GameState, IncomingMove, Player

app = FastAPI(title="Karré Realtime Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restreindre au domaine Vercel en production
    allow_methods=["*"],
    allow_headers=["*"],
)


class Room:
    def __init__(self, state: GameState):
        self.state = state
        self.connections: dict[str, WebSocket] = {}  # player_id -> socket

    async def broadcast(self) -> None:
        payload = self.state.model_dump(mode="json", by_alias=True)
        for ws in list(self.connections.values()):
            await ws.send_json({"type": "state", "state": payload})


ROOMS: dict[str, Room] = {}


@app.post("/rooms/{room_id}")
def create_room(room_id: str, size: str = "large"):
    """Crée un salon vide ; les joueurs le rejoignent ensuite via le WebSocket."""
    ROOMS[room_id] = Room(create_empty_game_state(room_id, size, players=[]))
    return {"roomId": room_id}


@app.websocket("/ws/rooms/{room_id}")
async def room_socket(websocket: WebSocket, room_id: str, player_id: str, display_name: str, initials: str, size: str = "large"):
    await websocket.accept()
    room = ROOMS.setdefault(room_id, Room(create_empty_game_state(room_id, size, players=[])))

    if not any(p.id == player_id for p in room.state.players):
        room.state.players.append(
            Player(id=player_id, display_name=display_name, initials=initials, color=None)
        )
        # Game stays in "waiting" until explicitly started

    room.connections[player_id] = websocket
    await room.broadcast()

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "select_color":
                new_color = data.get("color")
                for p in room.state.players:
                    if p.id == player_id:
                        p.color = new_color
                await room.broadcast()
            elif data.get("type") == "start_game":
                if len(room.state.players) >= 2 and all(p.color for p in room.state.players):
                    room.state.status = "playing"
                    room.state.started_at = datetime.now(timezone.utc).isoformat()
                await room.broadcast()
            else:
                move = IncomingMove(**data)
                try:
                    result = apply_move(room.state, move.type, move.row, move.col, player_id)
                    room.state = result.state
                    await room.broadcast()
                except InvalidMoveError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        room.connections.pop(player_id, None)
        for p in room.state.players:
            if p.id == player_id:
                p.connected = False
        await room.broadcast()
