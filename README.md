# Karré — starter

Jeu de stratégie multijoueur "dots-and-boxes" sur arène en losange.

## Comment c'est fait

La grille de jeu reste, en interne, une grille rectangulaire classique
(dots-and-boxes) : c'est ce qui permet une logique de capture simple et un
state facilement synchronisable. L'aspect "losange / arène" est un effet
purement visuel : `KarreBoard` fait pivoter le rendu SVG de 45° (voir
`web/components/board/KarreBoard.tsx`), avec chaque texte d'initiales
contre-pivoté pour rester lisible.

Auth : Auth.js (NextAuth) + Google OAuth — pas de Supabase. Temps réel :
FastAPI + WebSockets (`server/`), qui est la source de vérité (chaque coup
est validé côté serveur avant d'être diffusé à tous les joueurs du salon).

## Arborescence

```
gameskarrés/
├── README.md
├── web/                                # Frontend Next.js (App Router)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── .env.local.example
│   ├── app/
│   │   ├── layout.tsx                  # Layout racine, thème sombre, AuthProvider
│   │   ├── globals.css                 # Tailwind + keyframes (capture de case)
│   │   ├── page.tsx                    # Lobby : connexion Google, Solo, Créer, Rejoindre
│   │   ├── api/auth/[...nextauth]/route.ts  # Endpoint Auth.js
│   │   └── game/[roomId]/page.tsx      # Écran de partie (solo vs bot, ou multijoueur WS)
│   ├── components/
│   │   ├── board/
│   │   │   ├── KarreBoard.tsx          # Plateau SVG interactif (le cœur du jeu)
│   │   │   └── MiniMap.tsx             # Mini-carte d'orientation (mobile)
│   │   └── layout/
│   │       └── PlayerSidebar.tsx       # Dashboard joueurs / actions (Inviter, Quitter…)
│   └── lib/
│       ├── types/game.ts               # Schéma du state de partie (GameState, Player…)
│       ├── auth/                       # Config Auth.js (options.ts, AuthProvider.tsx)
│       └── game/
│           ├── engine.ts               # Logique pure : applyMove, captures, fin de partie
│           ├── ai.ts                   # Bot solo (heuristique, pas de LLM)
│           └── useRoomSocket.ts        # Hook client du WebSocket temps réel
│
└── server/                             # Backend FastAPI + WebSockets, source de vérité
    ├── requirements.txt
    └── app/
        ├── main.py                     # Endpoint WS /ws/rooms/{room_id}, gestion des salons
        ├── game_engine.py              # Même logique que web/lib/game/engine.ts, en Python
        └── models.py                   # Pydantic : Player, Move, GameState (alias camelCase
                                         #  pour matcher le JSON attendu par le frontend)
```

## Lancer le projet

**1. Backend temps réel**

```bash
cd server
python -m venv .venv && .venv/Scripts/activate   # ou source .venv/bin/activate sous Linux/Mac
pip install fastapi "uvicorn[standard]" pydantic
uvicorn app.main:app --reload
```

> `requirements.txt` contient aussi des libs audio (`pyaudio`, `pydub`, `ffmpeg-python`)
> qui ne servent à rien ici — probablement ajoutées depuis un autre contexte dans ce
> dossier. Pas touché volontairement, à vérifier de ton côté.

**2. Frontend**

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Remplir `.env.local` :
- `NEXTAUTH_SECRET` : `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : Google Cloud Console → APIs &
  Services → Identifiants → Créer des identifiants OAuth. URI de redirection
  autorisée : `http://localhost:3000/api/auth/callback/google`.
- `NEXT_PUBLIC_WS_URL` : `ws://localhost:8000` en local.

**3. Jouer**

- `/` : lobby, connexion Google.
- Solo (vs IA) : aucun réseau requis, tout se joue dans `lib/game/ai.ts`.
- Créer/Rejoindre : passe par le WebSocket FastAPI — lance bien le backend
  (étape 1) avant, sinon l'écran de jeu reste bloqué sur "Connexion au
  serveur de partie…".

## Ce qui reste à faire (au-delà du starter)

- Capacité de salon (2 vs 4 joueurs) non appliquée côté serveur : `main.py`
  ajoute les joueurs dans l'ordre d'arrivée sans plafond — à ajouter dans
  `room_socket()`.
- Persistance des salons (actuellement en mémoire, perdus au redémarrage du
  serveur) — Redis ou Postgres si déploiement multi-instance.
- Lien/code d'invitation partageable depuis le lobby.
- IA "difficile" : `ai.ts` gère déjà easy/medium (capture > coup sûr >
  minimisation de la cascade offerte) ; un niveau plus fort demanderait une
  vraie analyse de chaînes (stratégie "double-cross").
- Déploiement : `web/` sur Vercel, `server/` sur Render/Railway (penser à
  restreindre `allow_origins` dans `main.py` au domaine Vercel).
