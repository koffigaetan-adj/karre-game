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
from .models import GameState, IncomingMove, Player, ChatMessage

from contextlib import asynccontextmanager
from .database import engine, Base, AsyncSessionLocal
from .crud import save_game_state

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Création des tables au démarrage du serveur si elles n'existent pas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="Karré Realtime Server", lifespan=lifespan)

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
        # On sauvegarde dans la base de données en arrière-plan
        async with AsyncSessionLocal() as db:
            await save_game_state(db, self.state.room_id, self.state)
        
        for ws in list(self.connections.values()):
            await ws.send_json({"type": "state", "state": payload})


ROOMS: dict[str, Room] = {}


@app.post("/rooms/{room_id}")
def create_room(room_id: str, size: str = "large"):
    """Crée un salon vide ; les joueurs le rejoignent ensuite via le WebSocket."""
    ROOMS[room_id] = Room(create_empty_game_state(room_id, size, players=[]))
    return {"roomId": room_id}

from .crud import get_user_history

@app.get("/users/{user_id}/history")
async def get_history(user_id: str):
    async with AsyncSessionLocal() as db:
        history = await get_user_history(db, user_id)
        return {"matches": history}


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
            elif data.get("type") == "forfeit":
                if room.state.status == "playing":
                    room.state.status = "finished"
                    if len(room.state.players) == 2:
                        other = next(p for p in room.state.players if p.id != player_id)
                        room.state.winner_id = other.id
                await room.broadcast()
            elif data.get("type") == "chat":
                text = data.get("text", "").strip()
                if text:
                    msg = ChatMessage(
                        sender_id=player_id,
                        sender_name=display_name,
                        text=text,
                        timestamp=datetime.now(timezone.utc).isoformat()
                    )
                    room.state.messages.append(msg)
                    if len(room.state.messages) > 50:
                        room.state.messages = room.state.messages[-50:]
                    await room.broadcast()
            elif data.get("type") == "rematch":
                if room.state.status == "finished":
                    old_players = room.state.players
                    old_messages = room.state.messages
                    for p in old_players:
                        p.score = 0
                    new_state = create_empty_game_state(room_id, room.state.size, old_players)
                    new_state.messages = old_messages
                    new_state.status = "playing"
                    new_state.started_at = datetime.now(timezone.utc).isoformat()
                    room.state = new_state
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
        
        # Si la partie est en cours, la déconnexion compte comme un abandon
        if room.state.status == "playing":
            room.state.status = "finished"
            if len(room.state.players) == 2:
                other = next(p for p in room.state.players if p.id != player_id)
                room.state.winner_id = other.id
        
        await room.broadcast()
