# Kwadra

Jeu de stratégie multijoueur "dots-and-boxes" sur arène en losange, avec
salons privés, chat, historique de parties et mode solo contre un bot.

En production :
- Frontend : [Kwadra-games.vercel.app](https://Kwadra-games.vercel.app) (Vercel)
- Backend temps réel : `Kwadra-game.onrender.com` (Render)
- Base de données : Postgres (Neon)

## Comment c'est fait

La grille de jeu reste, en interne, une grille rectangulaire classique
(dots-and-boxes) : c'est ce qui permet une logique de capture simple et un
state facilement synchronisable. L'aspect "losange / arène" est un effet
purement visuel : `KwadraBoard` fait pivoter le rendu SVG de 45° (voir
`web/components/board/KwadraBoard.tsx`), avec chaque texte d'initiales
contre-pivoté pour rester lisible.

Auth : Auth.js (NextAuth) + Google OAuth — pas de Supabase. Temps réel :
FastAPI + WebSockets (`server/`), qui est la source de vérité (chaque coup
est validé côté serveur avant d'être diffusé à tous les joueurs du salon).
Les parties et leurs joueurs sont persistés en base (SQLAlchemy async,
Postgres/Neon en prod, SQLite en local par défaut) plutôt que gardés
uniquement en mémoire.

Le frontend est une PWA installable (`web/public/manifest.json`) et suit le
design system "Kraft & Counters" documenté dans `DESIGN.md` : fond clair/sombre
neutre classique, couleurs de joueurs comme seuls accents vifs, bordures encre
fines, ombres plates ("stack"), aucun gradient. Les sons (clic, musique
d'ambiance) sont synthétisés en direct via
Web Audio (`web/lib/audio.ts`) — aucune dépendance à un fichier audio
distant.

## Arborescence

```
gameskarrés/
├── README.md
├── DESIGN.md                           # Système de design "Kraft & Counters"
├── PRODUCT.md                          # Contexte produit
├── tests/
│   └── fixtures/game_script.json       # Scénario golden des tests de parité TS↔Python
├── tools/
│   └── generate_parity_fixture.py      # (Re)génère le scénario golden via le moteur Python
├── web/                                # Frontend Next.js (App Router)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── .env.local.example
│   ├── public/
│   │   ├── manifest.json               # PWA (installable)
│   │   ├── icon-*.png, logo-*.png      # Icônes clair/sombre
│   ├── app/
│   │   ├── layout.tsx                  # Layout racine, thème sombre, AuthProvider
│   │   ├── globals.css                 # Tokens de design + keyframes (capture, toast…)
│   │   ├── page.tsx                    # Lobby : connexion Google, Solo, Créer, Rejoindre
│   │   ├── api/auth/[...nextauth]/route.ts  # Endpoint Auth.js
│   │   ├── api/ws-ticket/route.ts      # Ticket HMAC éphémère pour le WebSocket
│   │   └── game/[roomId]/page.tsx      # Salle d'attente + écran de partie (solo ou WS)
│   ├── components/
│   │   ├── ProfileMenu.tsx             # Menu profil (déconnexion, réglages son/musique…)
│   │   ├── ThemeProvider.tsx           # Thème clair/sombre
│   │   ├── board/
│   │   │   ├── KwadraBoard.tsx          # Plateau SVG interactif (le cœur du jeu)
│   │   │   └── MiniMap.tsx             # Mini-carte d'orientation (mobile)
│   │   └── layout/
│   │       └── PlayerSidebar.tsx       # Dashboard joueurs / actions (Inviter, Quitter…)
│   ├── lib/
│   │   ├── types/game.ts               # Schéma du state de partie (GameState, Player…)
│   │   ├── auth/                       # Config Auth.js (options.ts, AuthProvider.tsx)
│   │   ├── audio.ts                    # Clic + musique d'ambiance (Web Audio, synthétisé)
│   │   ├── sound.ts                    # Son de capture de case
│   │   ├── emojis.ts                   # Palette d'emojis du chat en partie
│   │   ├── store/
│   │   │   ├── useSettingsStore.ts     # Préférences (son, musique, thème…)
│   │   │   └── useHistoryStore.ts      # Historique des parties jouées
│   │   └── game/
│   │       ├── engine.ts               # Logique pure : applyMove, captures, fin de partie
│   │       ├── ai.ts                   # Bot solo (heuristique, pas de LLM)
│   │       └── useRoomSocket.ts        # Hook client du WebSocket temps réel (avec reconnexion auto)
│   └── tests/
│       └── engine-parity.test.ts       # Vitest : parité moteur TS contre le golden file
│
└── server/                             # Backend FastAPI + WebSockets, source de vérité
    ├── requirements.txt
    ├── app/
    │   ├── main.py                     # Endpoint WS /ws/rooms/{room_id}, gestion des salons
    │   ├── game_engine.py              # Même logique que web/lib/game/engine.ts, en Python
    │   ├── models.py                   # Pydantic : Player, Move, GameState (alias camelCase
    │   │                               #  pour matcher le JSON attendu par le frontend)
    │   ├── database.py                 # Connexion SQLAlchemy async (Postgres/Neon ou SQLite local)
    │   ├── models_db.py                # Tables ORM : User, Game, GamePlayer
    │   └── crud.py                     # Lecture/écriture des parties et utilisateurs en base
    └── tests/
        └── test_engine_parity.py       # Pytest : parité moteur Python contre le golden file
```

## Lancer le projet

**1. Backend temps réel**

```bash
cd server
python -m venv .venv && .venv/Scripts/activate   # ou source .venv/bin/activate sous Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Sans variable `DATABASE_URL`, le backend utilise du SQLite local
(`kwadra.db`) — pratique pour développer sans dépendance externe. En
production, `DATABASE_URL` pointe vers Postgres/Neon (le module
`database.py` normalise automatiquement le schéma `postgres://` en
`postgresql+asyncpg://` et les paramètres `sslmode`/`channel_binding` des
URL Render/Neon, qu'asyncpg ne comprend pas nativement).

Deux variables d'environnement supplémentaires côté backend :
- `NEXTAUTH_SECRET` : **obligatoire**, identique à celle du frontend. Le
  WebSocket refuse toute connexion sans ticket valide (le frontend obtient
  ce ticket signé auprès de `/api/ws-ticket` avec sa session NextAuth, et
  le backend vérifie la signature HMAC + l'expiration + l'identité).
- `ALLOWED_ORIGINS` : origines CORS autorisées, séparées par des virgules
  (ex: `https://kwadra-games.vercel.app`). Par défaut : `*`.

Au démarrage, le serveur restaure depuis la base les parties encore
`"playing"` : un redéploiement Render ne tue plus les matchs en cours.

**2. Frontend**

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Remplir `.env.local` :
- `NEXTAUTH_SECRET` : `openssl rand -base64 32` — **même valeur à définir
  côté backend** (elle signe les tickets du WebSocket).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : Google Cloud Console → APIs &
  Services → Identifiants → Créer des identifiants OAuth. URI de redirection
  autorisée : `http://localhost:3000/api/auth/callback/google`.
- `NEXT_PUBLIC_WS_URL` : `ws://localhost:8000` en local.

**3. Jouer**

- `/` : lobby, connexion Google.
- Solo (vs IA) : aucun réseau requis, tout se joue dans `lib/game/ai.ts`.
- Créer/Rejoindre : passe par le WebSocket FastAPI — lance bien le backend
  (étape 1) avant, sinon l'écran de jeu reste bloqué sur "Connexion au
  serveur de partie…". En cas de coupure réseau en cours de partie, le
  client retente automatiquement une reconnexion (voir `useRoomSocket.ts`).

Alternative Windows : `start.bat` à la racine lance backend et frontend en
une seule commande.

## Déploiement

- **Frontend (Vercel)** : déployer le dossier `web/`. Variables d'env à
  configurer dans le dashboard Vercel : `NEXTAUTH_URL` (l'URL de prod),
  `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `NEXT_PUBLIC_WS_URL` (`wss://...`, attention au schéma `wss` et non `wws`).
  Penser à ajouter l'URL de prod comme URI de redirection OAuth autorisée
  côté Google Cloud Console.
- **Backend (Render)** : déployer le dossier `server/` (`uvicorn
  app.main:app --host 0.0.0.0 --port $PORT`). Variables d'env :
  `DATABASE_URL` (Neon Postgres), `NEXTAUTH_SECRET` (identique au frontend),
  `ALLOWED_ORIGINS` (domaine Vercel de prod, ex:
  `https://kwadra-games.vercel.app`).
- **Base de données** : Postgres géré par Neon, référencé via
  `DATABASE_URL` côté backend.

## Tests

Le cœur du jeu existe en double — TypeScript (`web/lib/game/engine.ts`) et
Python (`server/app/game_engine.py`) — et les deux doivent rester
strictement équivalents. Des tests de parité rejouent un scénario golden
déterministe (`tests/fixtures/game_script.json`) sur chaque moteur :
le moindre écart (grilles, scores, captures, vainqueur) fait échouer le test.

```bash
python tools/generate_parity_fixture.py   # (re)générer le scénario après un changement de règle
python -m pytest server/tests -q          # moteur Python
cd web && npm test                        # moteur TypeScript (vitest)
```

## Ce qui reste à faire

- IA "difficile" : `ai.ts` gère déjà easy/medium (capture > coup sûr >
  minimisation de la cascade offerte) ; un niveau plus fort demanderait une
  vraie analyse de chaînes (stratégie "double-cross").
- Typographie : `DESIGN.md` documente un système à deux polices
  (Anton + Karla) alors que seul Poppins est actuellement chargé dans
  `layout.tsx` — à harmoniser.
