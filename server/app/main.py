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
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from collections import deque
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from typing import get_args

from .game_engine import InvalidMoveError, apply_move, create_empty_game_state
from .models import GameState, IncomingMove, Player, PlayerColor, ChatMessage, PushSubscriptionIn

from contextlib import asynccontextmanager
from .database import engine, Base, AsyncSessionLocal
from .crud import save_game_state, save_push_subscription
from .push import send_turn_notification, VAPID_PUBLIC_KEY

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Création des tables au démarrage du serveur si elles n'existent pas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Restauration des parties en cours : le serveur vit en mémoire mais un
    # redéploiement Render (ou un simple crash) ne doit pas tuer les matchs
    # "playing" déjà persistés en base. Les salons "waiting" ne sont pas
    # restaurés : ils ne contiennent rien de critique et se recréent tout
    # seuls à la reconnexion des joueurs.
    from .crud import get_active_game_states
    try:
        async with AsyncSessionLocal() as db:
            active = await get_active_game_states(db)
        for room_id, state_dict in active:
            try:
                state = GameState.model_validate(state_dict)
                # Aucune socket n'existe encore après un redémarrage.
                for p in state.players:
                    p.connected = False
                ROOMS[room_id] = Room(state)
            except Exception:
                logging.exception("Restauration du salon %s impossible", room_id)
        if active:
            logging.info("%d salon(s) actif(s) restauré(s) depuis la base", len(active))
    except Exception:
        logging.exception("Restauration des salons actifs impossible (base injoignable ?)")

    yield
    await engine.dispose()


app = FastAPI(title="Kwadra Realtime Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Restreindre via la variable d'environnement ALLOWED_ORIGINS en prod
    # (ex: "https://kwadra-games.vercel.app"), séparées par des virgules.
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Un téléphone qui se verrouille, un PC qui se met en veille, ou juste un
# changement d'onglet, coupe la connexion WebSocket sans que ce soit un vrai
# abandon — on laisse largement le temps de revenir avant de compter une
# déconnexion comme un forfait (la reconnexion automatique du client,
# useRoomSocket, s'en charge dès que l'appareil/l'onglet redevient actif).
RECONNECT_GRACE_SECONDS = 10 * 60

# Chat : longueur maximale d'un message et fenêtre anti-spam par joueur.
CHAT_MAX_LENGTH = 300
CHAT_RATE_LIMIT_MESSAGES = 5
CHAT_RATE_WINDOW_SECONDS = 10.0


def _b64url_decode(value: str) -> bytes:
    # Node émet du base64url SANS padding ("=" omis) ; le décodeur Python
    # l'exige. On réaligne la longueur au multiple de 4.
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def verify_ws_ticket(ticket: str | None, player_id: str) -> str | None:
    """Vérifie le ticket HMAC émis par /api/ws-ticket (NextAuth côté frontend).

    Sans cette vérification, n'importe qui pouvait se connecter au WebSocket
    en prétendant être n'importe quel joueur (player_id non authentifié) et
    jouer/chat en son nom. Le ticket est signé avec NEXTAUTH_SECRET, partagé
    entre frontend et backend — aucun appel réseau à Google nécessaire.

    Retourne None si valide, sinon le message d'erreur à renvoyer au client.
    """
    secret = os.getenv("NEXTAUTH_SECRET")
    if not secret:
        return "Serveur de partie mal configuré : NEXTAUTH_SECRET manquant."
    if not ticket:
        return "Jeton d'authentification manquant."
    try:
        payload_b64, sig_b64 = ticket.split(".", 1)
        expected_sig = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(sig_b64), expected_sig):
            return "Jeton d'authentification invalide."
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("sub") != player_id:
            return "Identité incompatible avec ce jeton."
        if float(payload.get("exp", 0)) < time.time():
            return "Session expirée, rechargez la page."
    except Exception:
        return "Jeton d'authentification invalide."
    return None


class Room:
    def __init__(self, state: GameState):
        self.state = state
        self.connections: dict[str, WebSocket] = {}  # player_id -> socket
        self.disconnect_timers: dict[str, asyncio.Task] = {}
        # Fenêtres glissantes anti-spam chat : player_id -> horodatages d'envoi.
        self.chat_timestamps: dict[str, deque[float]] = {}
        self._save_task: asyncio.Task | None = None
        self._save_pending = False

    async def broadcast(self) -> None:
        payload = self.state.model_dump(mode="json", by_alias=True)
        # La latence perçue vient du réseau : on diffuse l'état aux joueurs
        # AVANT toute écriture en base. Auparavant, save_game_state (plusieurs
        # allers-retours SQL vers Neon, cold starts compris) s'exécutait avant
        # l'envoi — chaque coup héritait donc de la latence de la base.
        for pid, ws in list(self.connections.items()):
            try:
                await ws.send_json({"type": "state", "state": payload})
            except Exception:
                # Socket morte en pleine diffusion (le client ferme pile à ce
                # moment) : sans ce catch, l'exception remontait jusqu'au
                # handler du salon et tuait la boucle de traitement d'un
                # joueur encore vivant. On se contente de retirer la socket ;
                # le WebSocketDisconnect arrivera sur son propre handler.
                self.connections.pop(pid, None)
        self.schedule_save()

    def schedule_save(self) -> None:
        # Salon d'attente : rien de critique à persister (le salon est recréé
        # à la reconnexion si le serveur redémarre), et chaque changement de
        # couleur/initials déclencherait une écriture SQL inutile.
        if self.state.status == "waiting":
            return
        # Coalescing : une seule écriture en vol à la fois. Si d'autres coups
        # arrivent pendant qu'elle s'exécute, _save_pending est re-marqué et
        # une seule nouvelle écriture repart ensuite avec le dernier état —
        # les coups rapides ne s'empilent pas en file d'écritures SQL.
        self._save_pending = True
        if self._save_task is None or self._save_task.done():
            self._save_task = asyncio.create_task(self._persist())

    async def _persist(self) -> None:
        while self._save_pending:
            self._save_pending = False
            try:
                async with AsyncSessionLocal() as db:
                    await save_game_state(db, self.state.room_id, self.state)
            except Exception:
                # Le jeu vit en mémoire : une panne Neon ne doit pas casser la
                # partie en cours. On trace pour diagnostic.
                logging.exception("Sauvegarde du salon %s impossible", self.state.room_id)


ROOMS: dict[str, Room] = {}


@app.post("/rooms/{room_id}")
def create_room(room_id: str, size: str = "large", players: int = 2):
    """Crée un salon vide ; les joueurs le rejoignent ensuite via le WebSocket."""
    # Sans ce garde-fou, un POST sur l'id d'un salon existant écrasait la
    # Room en mémoire (état de partie perdu) — n'importe qui pouvait tuer
    # une partie en cours en devinant/répétant un room_id.
    if room_id in ROOMS:
        raise HTTPException(status_code=409, detail="Ce salon existe déjà.")
    ROOMS[room_id] = Room(
        create_empty_game_state(room_id, size, players=[], max_players=max(2, min(players, 4)))
    )
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
async def room_socket(
    websocket: WebSocket,
    room_id: str,
    player_id: str,
    display_name: str,
    initials: str,
    size: str = "large",
    players: int = 2,
    ticket: str | None = None,
):
    await websocket.accept()

    # Authentification : le player_id annoncé doit être prouvé par un ticket
    # HMAC émis par /api/ws-ticket (session NextAuth). Sans lui, la connexion
    # est refusée — sinon n'importe qui pouvait usurper l'identité d'un joueur.
    auth_error = verify_ws_ticket(ticket, player_id)
    if auth_error:
        await websocket.send_json({"type": "error", "message": auth_error})
        await websocket.close()
        return

    # Vérifier si la partie est déjà terminée en base de données
    async with AsyncSessionLocal() as db:
        from .crud import get_game_status
        status = await get_game_status(db, room_id)
        if status == "finished":
            await websocket.send_json({"type": "error", "message": "Cette partie est déjà terminée et ne peut plus être rejointe."})
            await websocket.close()
            return

    room = ROOMS.setdefault(room_id, Room(create_empty_game_state(room_id, size, players=[], max_players=max(2, min(players, 4)))))

    if not any(p.id == player_id for p in room.state.players):
        # Plafond de capacité côté serveur (2 ou 4 selon le mode choisi au
        # lobby) : le client filtre déjà, mais rien n'empêchait un client
        # modifié de rejoindre à 5, 6… et de corrompre la logique de tour.
        if len(room.state.players) >= room.state.max_players:
            await websocket.send_json({"type": "error", "message": "Ce salon est complet."})
            await websocket.close()
            return
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
            if not isinstance(data, dict):
                await websocket.send_json({"type": "error", "message": "Message inconnu ou invalide."})
                continue
            if data.get("type") == "select_color":
                new_color = data.get("color")
                # Unicité : deux joueurs ne doivent jamais pouvoir porter la
                # même couleur (le client grise déjà les couleurs prises, ce
                # contrôle protège contre les courses entre deux clics).
                if new_color not in get_args(PlayerColor):
                    await websocket.send_json({"type": "error", "message": "Couleur inconnue."})
                elif any(p.color == new_color for p in room.state.players if p.id != player_id):
                    await websocket.send_json({"type": "error", "message": "Cette couleur vient d'être prise par un autre joueur."})
                else:
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
                # L'hôte est le premier joueur du salon (même convention que
                # le client, qui n'affiche le bouton qu'à players[0]) : sans
                # ce contrôle, n'importe quel joueur fraîchement arrivé
                # pouvait lancer la partie à la place du créateur.
                is_host = bool(room.state.players) and room.state.players[0].id == player_id
                if not is_host:
                    await websocket.send_json({"type": "error", "message": "Seul le créateur du salon peut lancer la partie."})
                elif len(room.state.players) >= 2 and all(p.color for p in room.state.players):
                    old_players = room.state.players
                    old_messages = room.state.messages
                    new_state = create_empty_game_state(room_id, room.state.size, old_players, max_players=room.state.max_players)
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
                text = (data.get("text") or "").strip()[:CHAT_MAX_LENGTH]
                if text:
                    # Anti-spam : fenêtre glissante par joueur. Sans limite,
                    # un client bogué (ou malveillant) pouvait inonder le
                    # salon et saturer le broadcast + la persistance.
                    now = time.time()
                    window = room.chat_timestamps.setdefault(player_id, deque())
                    while window and now - window[0] > CHAT_RATE_WINDOW_SECONDS:
                        window.popleft()
                    if len(window) >= CHAT_RATE_LIMIT_MESSAGES:
                        await websocket.send_json({"type": "error", "message": "Ralentis un peu avec les messages !"})
                        continue
                    window.append(now)
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
                        if pid == player_id:
                            continue
                        try:
                            await ws.send_json(payload)
                        except Exception:
                            # Même logique que broadcast : une socket morte ne
                            # doit pas tuer le handler du salon.
                            room.connections.pop(pid, None)
            elif data.get("type") == "rematch":
                if room.state.status == "finished":
                    old_players = room.state.players
                    old_messages = room.state.messages
                    for p in old_players:
                        p.score = 0
                    new_state = create_empty_game_state(room_id, room.state.size, old_players, max_players=room.state.max_players)
                    new_state.messages = old_messages
                    new_state.status = "playing"
                    new_state.started_at = datetime.now(timezone.utc).isoformat()
                    room.state = new_state
                    await room.broadcast()
            elif data.get("type") == "ping":
                # Keepalive : les réseaux mobiles ferment silencieusement les
                # WebSockets inactives (timeout NAT après ~30-60 s). Le client
                # envoie un ping toutes les 25 s ; répondre prouve que le
                # tunnel est vivant et maintient la traduction NAT ouverte.
                # Sans cette branche, IncomingMove(**data) lèverait une erreur
                # de validation pydantic et tuerait la connexion.
                await websocket.send_json({"type": "pong"})
            else:
                # Un JSON malformé (type inconnu, champs manquants, mauvais
                # types…) levait une ValidationError pydantic non catchée qui
                # tuait la connexion WebSocket du joueur au lieu de simplement
                # rejeter le message — d'où ce try/except.
                try:
                    move = IncomingMove(**data)
                except ValidationError:
                    await websocket.send_json({"type": "error", "message": "Message inconnu ou invalide."})
                    continue
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
