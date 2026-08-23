from sqlalchemy import Column, String, Integer, ForeignKey, JSON, DateTime, Boolean
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True) # le player_id
    display_name = Column(String)
    initials = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True, index=True) # le room_id
    state = Column(JSON) # L'état complet du jeu sérialisé
    status = Column(String, default="waiting") # "waiting", "playing", "finished"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class GamePlayer(Base):
    __tablename__ = "game_players"

    game_id = Column(String, ForeignKey("games.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    score = Column(Integer, default=0)
    is_winner = Column(Boolean, default=False)
