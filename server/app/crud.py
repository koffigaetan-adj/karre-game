import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from .models_db import User, Game, GamePlayer
from .models import GameState

async def get_or_create_user(db: AsyncSession, player_id: str, display_name: str, initials: str):
    result = await db.execute(select(User).where(User.id == player_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=player_id, display_name=display_name, initials=initials)
        db.add(user)
        await db.commit()
    return user

async def save_game_state(db: AsyncSession, room_id: str, state: GameState):
    # Sérialiser l'état complet
    state_dict = state.model_dump(mode="json", by_alias=True)
    
    result = await db.execute(select(Game).where(Game.id == room_id))
    game = result.scalar_one_or_none()
    
    if not game:
        game = Game(id=room_id, state=state_dict, status=state.status)
        db.add(game)
    else:
        game.state = state_dict
        game.status = state.status
        
    await db.commit()

    # Mettre à jour les scores des joueurs pour l'historique
    for player in state.players:
        if player.id:
            # Assurer que l'utilisateur existe
            await get_or_create_user(db, player.id, player.display_name, player.initials)
            
            # Upsert GamePlayer (relation)
            gp_result = await db.execute(select(GamePlayer).where(GamePlayer.game_id == room_id, GamePlayer.user_id == player.id))
            gp = gp_result.scalar_one_or_none()
            
            is_winner = (state.winner_id == player.id) if state.winner_id else False
            
            if not gp:
                gp = GamePlayer(game_id=room_id, user_id=player.id, score=player.score, is_winner=is_winner)
                db.add(gp)
            else:
                gp.score = player.score
                gp.is_winner = is_winner
                
    await db.commit()
