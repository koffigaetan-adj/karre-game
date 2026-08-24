import os
from typing import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

# Par défaut on utilise SQLite en asynchrone pour faciliter les tests si aucune URL n'est fournie,
# mais en production on utilisera postgresql+asyncpg://...
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./karrre.db")

# Render/Neon utilisent souvent postgres://, mais asyncpg a besoin de postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

connect_args = {}

# Les URL Postgres de Render/Neon embarquent sslmode= et channel_binding=
# en query string (syntaxe libpq) qu'asyncpg ne comprend pas nativement.
# Une simple substitution de sous-chaîne ("?sslmode=require" -> "") casse
# l'URL dès qu'un autre paramètre suit (ex: &channel_binding=require reste
# collé au nom de la base, sans "?" pour le délimiter) — on parse donc
# proprement la query string au lieu de bricoler le texte brut.
# On ne touche à l'URL que si elle a effectivement une query string à
# nettoyer : urlsplit/urlunsplit ne restitue pas fidèlement les URL du
# style "sqlite+aiosqlite:///./fichier.db" (le "///" devient "/"), ce qui
# cassait le fallback SQLite local dès que DATABASE_URL n'était pas défini.
if "?" in DATABASE_URL:
    parts = urlsplit(DATABASE_URL)
    query_params = dict(parse_qsl(parts.query))
    if query_params.pop("sslmode", None) == "require":
        connect_args["ssl"] = "require"
    query_params.pop("channel_binding", None)
    DATABASE_URL = urlunsplit(parts._replace(query=urlencode(query_params)))

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
