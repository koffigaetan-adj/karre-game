"""
Envoi de notifications Web Push ("c'est ton tour !") aux joueurs qui n'ont
pas l'onglet de la partie ouvert. Utilise VAPID (aucun service tiers requis,
contrairement à Firebase Cloud Messaging).

Variables d'environnement attendues côté serveur :
- VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY : générées une fois pour toutes (voir
  README pour la commande de génération), stables dans le temps.
- VAPID_CLAIM_EMAIL : email de contact exigé par le protocole Web Push
  (utilisé par les navigateurs pour contacter l'opérateur en cas d'abus).
"""

from __future__ import annotations

import os

from pywebpush import webpush, WebPushException

from .database import AsyncSessionLocal
from .crud import get_push_subscriptions, delete_push_subscription

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIM_EMAIL = os.getenv("VAPID_CLAIM_EMAIL", "mailto:contact@Kwadra-games.app")


async def send_turn_notification(user_id: str, room_id: str, opponent_name: str) -> None:
    """Notifie tous les appareils abonnés d'un joueur que c'est son tour.
    N'échoue jamais bruyamment : un push cassé (abonnement expiré) est
    simplement nettoyé de la base, le reste du jeu continue normalement."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return  # Notifications non configurées côté serveur — no-op silencieux.

    async with AsyncSessionLocal() as db:
        subscriptions = await get_push_subscriptions(db, user_id)
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=(
                        '{"title": "À toi de jouer !", '
                        f'"body": "{opponent_name} a joué — c\'est ton tour sur Kwadra.", '
                        f'"url": "/game/{room_id}"}}'
                    ),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_CLAIM_EMAIL},
                )
            except WebPushException as exc:
                status = getattr(exc.response, "status_code", None)
                if status in (404, 410):
                    # Abonnement expiré/révoqué côté navigateur : on l'oublie.
                    await delete_push_subscription(db, sub.endpoint)
                # Toute autre erreur (réseau, clé mal configurée) est ignorée :
                # une notification manquée ne doit jamais casser une partie.
