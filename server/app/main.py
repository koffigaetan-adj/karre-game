"""
Backend temps réel FastAPI + WebSockets (Option A de l'architecture).

Alternative à Supabase Realtime : chaque salon ("room") vit en mémoire dans
`ROOMS` (à remplacer par Redis/Postgres pour un déploiement multi-instance).
Chaque client se connecte à /ws/rooms/{room_id}, envoie ses coups en JSON,
reçoit l'état complet du jeu en retour après validation par `game_engine`.

Lancer en local : uvicorn app.main:app --reload
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .game_engine import InvalidMoveError, apply_move, create_empty_game_state
from .models import GameState, IncomingMove, Player, ChatMessage, PushSubscriptionIn

from contextlib import asynccontextmanager
from .database import engine, Base, AsyncSessionLocal
from .crud import save_game_state, save_push_subscription
from .push import send_turn_notification, VAPID_PUBLIC_KEY

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


# Un téléphone qui se verrouille, un PC qui se met en veille, ou juste un
# changement d'onglet, coupe la connexion WebSocket sans que ce soit un vrai
# abandon — on laisse largement le temps de revenir avant de compter une
# déconnexion comme un forfait (la reconnexion automatique du client,
# useRoomSocket, s'en charge dès que l'appareil/l'onglet redevient actif).
RECONNECT_GRACE_SECONDS = 10 * 60


class Room:
    def __init__(self, state: GameState):
        self.state = state
        self.connections: dict[str, WebSocket] = {}  # player_id -> socket
        self.disconnect_timers: dict[str, asyncio.Task] = {}

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

@app.delete("/users/{user_id}/history")
async def delete_history(user_id: str):
    async with AsyncSessionLocal() as db:
        from .crud import clear_user_history
        await clear_user_history(db, user_id)
        return {"status": "ok"}


@app.get("/push/vapid-public-key")
def get_vapid_public_key():
    """Clé publique VAPID à passer à PushManager.subscribe() côté client."""
    return {"publicKey": VAPID_PUBLIC_KEY}


@app.post("/push/subscribe")
async def subscribe_to_push(payload: PushSubscriptionIn):
    async with AsyncSessionLocal() as db:
        await save_push_subscription(db, payload.user_id, payload.endpoint, payload.keys.p256dh, payload.keys.auth)
    return {"status": "ok"}


@app.websocket("/ws/rooms/{room_id}")
async def room_socket(websocket: WebSocket, room_id: str, player_id: str, display_name: str, initials: str, size: str = "large"):
    await websocket.accept()
    
    # Vérifier si la partie est déjà terminée en base de données
    async with AsyncSessionLocal() as db:
        from .crud import get_game_status
        status = await get_game_status(db, room_id)
        if status == "finished":
            await websocket.send_json({"type": "error", "message": "Cette partie est déjà terminée et ne peut plus être rejointe."})
            await websocket.close()
            return

    room = ROOMS.setdefault(room_id, Room(create_empty_game_state(room_id, size, players=[])))

    if not any(p.id == player_id for p in room.state.players):
        room.state.players.append(
            Player(id=player_id, display_name=display_name, initials=initials, color=None)
        )
        # Game stays in "waiting" until explicitly started

    # Le joueur revient à temps : on annule le forfait programmé et on le
    # remarque comme connecté.
    pending_timer = room.disconnect_timers.pop(player_id, None)
    if pending_timer:
        pending_timer.cancel()
    for p in room.state.players:
        if p.id == player_id:
            p.connected = True

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
            elif data.get("type") == "update_initials":
                new_initials = (data.get("initials") or "").strip().upper()[:3]
                if new_initials and room.state.status == "waiting":
                    for p in room.state.players:
                        if p.id == player_id:
                            p.initials = new_initials
                    await room.broadcast()
            elif data.get("type") == "start_game":
                if len(room.state.players) >= 2 and all(p.color for p in room.state.players):
                    old_players = room.state.players
                    old_messages = room.state.messages
                    new_state = create_empty_game_state(room_id, room.state.size, old_players)
                    new_state.messages = old_messages
                    new_state.status = "playing"
                    new_state.started_at = datetime.now(timezone.utc).isoformat()
                    room.state = new_state
                await room.broadcast()
            elif data.get("type") == "forfeit":
                if room.state.status == "playing":
                    room.state.status = "finished"
                    room.state.end_reason = "forfeit"
                    room.state.forfeited_by = player_id
                    remaining = [p for p in room.state.players if p.id != player_id]
                    if remaining:
                        best = max(remaining, key=lambda p: p.score)
                        room.state.winner_id = best.id
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
            elif data.get("type") == "hover":
                # Aperçu de survol : pas un coup, pas persisté, juste relayé aux
                # autres joueurs du salon pour qu'ils voient en direct la ligne
                # que le joueur actif s'apprête à jouer.
                edge_type = data.get("edgeType")
                is_current_player = (
                    room.state.status == "playing"
                    and room.state.players
                    and room.state.players[room.state.current_player_index].id == player_id
                )
                if edge_type is None or is_current_player:
                    payload = {
                        "type": "opponent_hover",
                        "playerId": player_id,
                        "edgeType": edge_type,
                        "row": data.get("row"),
                        "col": data.get("col"),
                    }
                    for pid, ws in list(room.connections.items()):
                        if pid != player_id:
                            await ws.send_json(payload)
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

                    # Le tour a changé de joueur : si celui à qui c'est le tour n'a
                    # pas l'onglet ouvert, on le notifie plutôt que de le laisser
                    # découvrir la relance en revenant sur l'appli de lui-même.
                    if room.state.status == "playing":
                        next_player = room.state.players[room.state.current_player_index]
                        if (
                            next_player.id != player_id
                            and not next_player.is_ai
                            and next_player.id not in room.connections
                        ):
                            asyncio.create_task(send_turn_notification(next_player.id, room_id, display_name))
                except InvalidMoveError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        room.connections.pop(player_id, None)
        for p in room.state.players:
            if p.id == player_id:
                p.connected = False

        if room.state.status == "playing":
            # Pas de verdict immédiat : on prévient les autres joueurs que
            # celui-ci est déconnecté (déjà visible via player.connected côté
            # client) et on programme le forfait, annulable s'il revient.
            async def declare_forfeit_after_grace_period() -> None:
                try:
                    await asyncio.sleep(RECONNECT_GRACE_SECONDS)
                except asyncio.CancelledError:
                    return
                if player_id in room.connections or room.state.status != "playing":
                    return
                room.state.status = "finished"
                room.state.end_reason = "forfeit"
                room.state.forfeited_by = player_id
                remaining = [p for p in room.state.players if p.id != player_id]
                if remaining:
                    best = max(remaining, key=lambda p: p.score)
                    room.state.winner_id = best.id
                room.disconnect_timers.pop(player_id, None)
                await room.broadcast()
                if not any(p.connected for p in room.state.players):
                    ROOMS.pop(room_id, None)

            room.disconnect_timers[player_id] = asyncio.create_task(declare_forfeit_after_grace_period())
            await room.broadcast()
        elif not any(p.connected for p in room.state.players):
            # Hors partie en cours (salon d'attente, partie déjà finie) : pas
            # de raison d'attendre, on nettoie tout de suite si tout le monde
            # est parti.
            ROOMS.pop(room_id, None)
        else:
            await room.broadcast()
