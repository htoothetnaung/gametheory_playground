"""
Game Engine - Core game loop and state management.

Handles:
- Game initialization and configuration
- Turn-based game loop execution
- Phase transitions
- Win condition checking
- Event broadcasting to WebSocket clients
"""
import asyncio
import os
import sys
from typing import Optional, Callable, Awaitable, Set
from dataclasses import dataclass, field

# Add paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import GameState, GamePhase, GameConfig, Clue, AgentInternal
from agents.orchestrator import GameOrchestrator


@dataclass
class GameEngineConfig:
    """Configuration for the game engine"""
    llm_provider: str = "gemini"  # "gemini" or "groq"
    llm_model: str = "gemini-2.0-flash"
    num_players: int = 6
    turn_delay_seconds: float = 2.0  # Delay between turns for UI
    auto_run: bool = True  # Auto-advance turns
    max_rounds: int = 3


class GameEngine:
    """
    Main game engine that manages the game loop.
    
    Connects the Orchestrator (agents) with WebSocket broadcasting.
    """
    
    def __init__(self, config: Optional[GameEngineConfig] = None):
        self.config = config or GameEngineConfig()
        self.orchestrator: Optional[GameOrchestrator] = None
        
        # WebSocket client connections
        self._ws_clients: Set = set()
        
        # Callbacks
        self._on_state_change: Optional[Callable[[dict], Awaitable[None]]] = None
        self._on_agent_internal: Optional[Callable[[dict], Awaitable[None]]] = None
        
        # Game loop control
        self._running = False
        self._game_task: Optional[asyncio.Task] = None
        
    def set_callbacks(
        self,
        on_state_change: Optional[Callable[[dict], Awaitable[None]]] = None,
        on_agent_internal: Optional[Callable[[dict], Awaitable[None]]] = None
    ):
        """Set event callbacks for WebSocket broadcasting"""
        self._on_state_change = on_state_change
        self._on_agent_internal = on_agent_internal
    
    async def _broadcast_state(self, state: dict):
        """Internal callback to broadcast state changes"""
        if self._on_state_change:
            await self._on_state_change(state)
    
    async def _broadcast_agent_internal(self, internal: dict):
        """Internal callback to broadcast agent thoughts"""
        if self._on_agent_internal:
            await self._on_agent_internal(internal)
    
    async def start_game(self, config: Optional[GameConfig] = None) -> dict:
        """
        Initialize and start a new game.
        
        Args:
            config: Optional game configuration
            
        Returns:
            Initial game state as dict
        """
        # Stop any existing game
        await self.stop_game()
        
        num_players = config.num_players if config else self.config.num_players
        word_pool = config.word_pool if config else None
        
        # Create orchestrator with callbacks
        self.orchestrator = GameOrchestrator(
            llm_provider=self.config.llm_provider,
            llm_model=self.config.llm_model,
            word_pool=word_pool,
            on_state_change=self._broadcast_state,
            on_agent_internal=self._broadcast_agent_internal
        )
        self.orchestrator.max_rounds = self.config.max_rounds
        
        # Start the game
        state = await self.orchestrator.start_game(num_players)
        
        # Start auto-run loop if enabled
        if self.config.auto_run:
            self._running = True
            self._game_task = asyncio.create_task(self._game_loop())
        
        return state.to_frontend()
    
    async def _game_loop(self):
        """
        Main game loop - auto-advances turns.
        Runs in background task.
        """
        while self._running and self.orchestrator:
            try:
                # Check if game is paused or ended
                if self.orchestrator.is_paused:
                    await asyncio.sleep(0.5)
                    continue
                
                state = self.orchestrator.state
                if not state:
                    break
                
                if state.phase == GamePhase.ENDED:
                    break
                
                if state.phase == GamePhase.CLUE_GIVING:
                    # Run a turn
                    await self.orchestrator.run_turn()
                    # Delay for UI
                    await asyncio.sleep(self.config.turn_delay_seconds)
                    
                elif state.phase == GamePhase.VOTING:
                    # Run voting phase
                    await self.orchestrator.run_voting_phase()
                    await asyncio.sleep(self.config.turn_delay_seconds)
                    
                elif state.phase == GamePhase.IMPOSTER_GUESS:
                    # Imposter makes final guess
                    if self.orchestrator.imposter_state:
                        best_guess, _ = self.orchestrator.imposter_state.get_best_guess()
                        await self.orchestrator.imposter_guess(best_guess)
                    await asyncio.sleep(self.config.turn_delay_seconds)
                
            except Exception as e:
                print(f"Game loop error: {e}")
                await asyncio.sleep(1.0)
    
    async def stop_game(self):
        """Stop the current game"""
        self._running = False
        if self._game_task:
            self._game_task.cancel()
            try:
                await self._game_task
            except asyncio.CancelledError:
                pass
            self._game_task = None
    
    async def pause(self):
        """Pause the game"""
        if self.orchestrator:
            self.orchestrator.pause()
            if self.orchestrator.state:
                await self._broadcast_state(self.orchestrator.state.to_frontend())
    
    async def resume(self):
        """Resume the game"""
        if self.orchestrator:
            self.orchestrator.resume()
            if self.orchestrator.state:
                await self._broadcast_state(self.orchestrator.state.to_frontend())
    
    async def reset(self, config: Optional[GameConfig] = None) -> dict:
        """Reset and start a new game"""
        return await self.start_game(config)
    
    async def next_turn(self) -> Optional[dict]:
        """
        Manually advance to next turn (when auto_run is False).
        
        Returns:
            The clue given, or None
        """
        if not self.orchestrator:
            return None
        
        clue = await self.orchestrator.run_turn()
        return clue.to_frontend() if clue else None
    
    async def set_phase(self, phase: str):
        """Manually set game phase"""
        if self.orchestrator and self.orchestrator.state:
            self.orchestrator.state.phase = GamePhase(phase)
            await self._broadcast_state(self.orchestrator.state.to_frontend())
    
    async def eliminate_player(self, player_id: str):
        """Manually eliminate a player"""
        if self.orchestrator:
            await self.orchestrator.eliminate_player(player_id)
    
    def get_state(self) -> Optional[dict]:
        """Get current game state"""
        if self.orchestrator and self.orchestrator.state:
            return self.orchestrator.state.to_frontend()
        return None
    
    def get_semantic_vectors(self) -> list[dict]:
        """Get semantic vectors for visualization"""
        if self.orchestrator:
            return self.orchestrator.get_semantic_vectors()
        return []
    
    def get_imposter_beliefs(self) -> dict:
        """Get imposter's belief distribution for admin dashboard"""
        if self.orchestrator and self.orchestrator.imposter_state:
            return self.orchestrator.imposter_state.to_dict()
        return {
            "candidateWords": [],
            "confidence": 0,
            "topGuess": "",
            "thoughtProcess": ""
        }


# Singleton engine instance
_game_engine: Optional[GameEngine] = None


def get_game_engine(config: Optional[GameEngineConfig] = None) -> GameEngine:
    """Get or create the game engine singleton"""
    global _game_engine
    if _game_engine is None:
        _game_engine = GameEngine(config)
    return _game_engine


def reset_game_engine(config: Optional[GameEngineConfig] = None) -> GameEngine:
    """Reset the game engine with new config"""
    global _game_engine
    _game_engine = GameEngine(config)
    return _game_engine
