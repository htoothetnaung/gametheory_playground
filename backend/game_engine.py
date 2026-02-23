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
from dataclasses import dataclass

# Add paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import GamePhase, GameConfig, Clue, Vote, RiskLevel
from agents.orchestrator import GameOrchestrator
from database import get_database_manager


@dataclass
class GameEngineConfig:
    """Configuration for the game engine"""

    llm_provider: str = "gemini"  # "ollama", "gemini", or "groq"
    llm_model: str = "gemini-2.0-flash"
    num_players: int = 6
    turn_delay_seconds: float = 2.0  # Delay between turns for UI
    auto_run: bool = True  # Auto-advance turns
    max_rounds: int = 2  # Clue-giving rounds before each voting phase
    noisy_channel_mode: bool = False
    noisy_channel_probability: float = 0.0
    delayed_information_turns: int = 0


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

        # Persistence
        self._db = get_database_manager()
        self._db_game_id: Optional[int] = None
        self._last_clue_count = 0
        self._last_phase: Optional[str] = None

    def set_callbacks(
        self,
        on_state_change: Optional[Callable[[dict], Awaitable[None]]] = None,
        on_agent_internal: Optional[Callable[[dict], Awaitable[None]]] = None,
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
            on_agent_internal=self._broadcast_agent_internal,
        )
        self.orchestrator.max_rounds = self.config.max_rounds
        self.orchestrator.configure_research_modes(
            noisy_channel_mode=self.config.noisy_channel_mode,
            noisy_channel_probability=self.config.noisy_channel_probability,
            delayed_information_turns=self.config.delayed_information_turns,
        )

        # Start the game
        state = await self.orchestrator.start_game(num_players)
        self._db_game_id = self._db.start_game_session(
            secret_word=state.secret_word,
            imposter_id=",".join(state.imposter_ids),
            num_players=len(state.players),
        )
        self._last_clue_count = 0
        self._last_phase = state.phase.value
        self._db.record_phase_snapshot(
            game_id=self._db_game_id,
            phase=state.phase.value,
            round_number=state.round,
            payload=state.to_frontend(),
        )

        # Start auto-run loop if enabled
        if self.config.auto_run:
            self._running = True
            self._game_task = asyncio.create_task(self._game_loop())

        return state.to_frontend()

    async def _game_loop(self):
        """
        Main game loop - auto-advances turns.
        Runs in background task.

        Flow:
          clue_giving (max_rounds rounds, every alive player gives 1 clue per round)
          → voting (one player eliminated)
          → win-condition check
          → if game continues, reset round to 1 and go back to clue_giving
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

                # Defensive None guards
                if state.current_player_index is None:
                    state.current_player_index = 0
                if state.round is None:
                    state.round = 1

                if state.phase == GamePhase.ENDED:
                    self._persist_runtime_state()
                    self._persist_game_end()
                    break

                if state.phase == GamePhase.CLUE_GIVING:
                    # Run a turn
                    await self.orchestrator.run_turn()
                    self._persist_runtime_state()
                    # Delay for UI
                    await asyncio.sleep(self.config.turn_delay_seconds)

                elif state.phase == GamePhase.VOTING:
                    # Run voting phase → eliminates one player
                    await self.orchestrator.run_voting_phase()
                    self._persist_runtime_state()
                    await asyncio.sleep(self.config.turn_delay_seconds)

                    # After voting, check if the game ended (imposter caught
                    # or too few civilians). If not, cycle back to clue_giving.
                    if state.phase != GamePhase.ENDED:
                        state.phase = GamePhase.CLUE_GIVING
                        state.round = 1
                        state.current_player_index = 0
                        state.votes = []  # clear votes for next cycle
                        await self.orchestrator._broadcast_state()

                elif state.phase == GamePhase.IMPOSTER_GUESS:
                    # Imposter makes final guess
                    if self.orchestrator.imposter_state:
                        best_guess, _ = (
                            self.orchestrator.imposter_state.get_best_guess()
                        )
                        await self.orchestrator.imposter_guess(best_guess)
                    self._persist_runtime_state()
                    await asyncio.sleep(self.config.turn_delay_seconds)

            except Exception as e:
                print(f"Game loop error: {e}")
                import traceback

                traceback.print_exc()
                await asyncio.sleep(1.0)

    def _persist_runtime_state(self):
        if not self.orchestrator or not self.orchestrator.state or not self._db_game_id:
            return

        state = self.orchestrator.state
        state_payload = state.to_frontend()

        current_phase = state.phase.value
        if self._last_phase != current_phase:
            self._db.record_phase_snapshot(
                game_id=self._db_game_id,
                phase=current_phase,
                round_number=state.round,
                payload=state_payload,
            )
            self._last_phase = current_phase

        clues = state_payload.get("clues", [])
        if len(clues) > self._last_clue_count:
            for clue in clues[self._last_clue_count :]:
                self._db.record_clue(
                    game_id=self._db_game_id,
                    player_id=clue.get("playerId", ""),
                    player_name=clue.get("playerName", ""),
                    clue_text=clue.get("clue", ""),
                    semantic_distance=float(clue.get("semanticDistance", 0.0)),
                    risk_level=clue.get("riskLevel", "safe"),
                    round_number=state.round,
                )
            self._last_clue_count = len(clues)

    def _persist_game_end(self):
        if not self.orchestrator or not self.orchestrator.state or not self._db_game_id:
            return
        state_payload = self.orchestrator.state.to_frontend()
        winner = state_payload.get("winner")
        self._db.end_game_session(self._db_game_id, winner)
        self._db.update_player_performance(
            players=state_payload.get("players", []),
            winner=winner,
            clues=state_payload.get("clues", []),
            imposter_id=",".join(state_payload.get("imposterIds", []))
            or state_payload.get("imposterId", ""),
        )

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
        self._persist_runtime_state()
        return clue.to_frontend() if clue else None

    async def submit_human_clue(self, player_id: str, clue_text: str) -> Optional[dict]:
        """Submit a clue for a human-controlled player slot."""
        if not self.orchestrator or not self.orchestrator.state:
            raise ValueError("No active game")

        state = self.orchestrator.state
        if state.phase != GamePhase.CLUE_GIVING:
            raise ValueError("Clues can only be submitted during clue_giving phase")

        current_player = state.get_current_player()
        if not current_player or current_player.id != player_id:
            raise ValueError("It is not this player's turn")

        if not current_player.is_alive:
            raise ValueError("Eliminated players cannot submit clues")

        current_player.is_speaking = True
        await self._broadcast_state(state.to_frontend())

        (
            similarity,
            risk_level,
        ) = await self.orchestrator.embedding_service.calculate_semantic_distance(
            clue_text,
            state.secret_word,
        )

        clue = Clue(
            player_id=current_player.id,
            player_name=current_player.name,
            clue=clue_text,
            semantic_distance=similarity,
            risk_level=RiskLevel(risk_level),
        )

        state.clues.append(clue)
        current_player.is_speaking = False

        await self.orchestrator._advance_turn()
        await self._broadcast_state(state.to_frontend())

        self._persist_runtime_state()
        return clue.to_frontend()

    async def submit_human_vote(
        self, voter_id: str, target_id: str, reason: Optional[str] = None
    ) -> Optional[dict]:
        """Submit vote for human-controlled player slot."""
        if not self.orchestrator or not self.orchestrator.state:
            raise ValueError("No active game")

        state = self.orchestrator.state
        if state.phase != GamePhase.VOTING:
            raise ValueError("Votes can only be submitted during voting phase")

        alive_ids = {p.id for p in state.players if p.is_alive}
        if voter_id not in alive_ids or target_id not in alive_ids:
            raise ValueError("Voter and target must be alive players")
        if voter_id == target_id:
            raise ValueError("Players cannot vote for themselves")

        if any(v.voter_id == voter_id for v in state.votes):
            raise ValueError("This player has already voted")

        vote = Vote(voter_id=voter_id, target_id=target_id, reason=reason)
        state.votes.append(vote)

        total_alive = len(alive_ids)
        if len(state.votes) >= total_alive:
            vote_counts: dict[str, int] = {}
            for cast in state.votes:
                vote_counts[cast.target_id] = vote_counts.get(cast.target_id, 0) + 1
            if vote_counts:
                eliminated_id = max(
                    vote_counts.keys(), key=lambda pid: vote_counts[pid]
                )
                await self.orchestrator.eliminate_player(eliminated_id)

        await self._broadcast_state(state.to_frontend())
        self._persist_runtime_state()
        return vote.to_frontend()

    async def set_phase(self, phase: str):
        """Manually set game phase"""
        if self.orchestrator and self.orchestrator.state:
            self.orchestrator.state.phase = GamePhase(phase)
            self._persist_runtime_state()
            if self.orchestrator.state.phase == GamePhase.ENDED:
                self._persist_game_end()
            await self._broadcast_state(self.orchestrator.state.to_frontend())

    async def eliminate_player(self, player_id: str):
        """Manually eliminate a player"""
        if self.orchestrator:
            await self.orchestrator.eliminate_player(player_id)
            self._persist_runtime_state()
            if (
                self.orchestrator.state
                and self.orchestrator.state.phase == GamePhase.ENDED
            ):
                self._persist_game_end()

    def get_state(self) -> Optional[dict]:
        """Get current game state"""
        if self.orchestrator and self.orchestrator.state:
            return self.orchestrator.state.to_frontend()
        return None

    async def get_semantic_vectors(self) -> list[dict]:
        """Get semantic vectors for visualization"""
        if self.orchestrator:
            return await self.orchestrator.get_semantic_vectors()
        return []

    def get_imposter_beliefs(self) -> dict:
        """Get imposter's belief distribution for admin dashboard"""
        if self.orchestrator and self.orchestrator.imposter_state:
            return self.orchestrator.imposter_state.to_dict()
        return {
            "candidateWords": [],
            "confidence": 0,
            "entropy": 1,
            "topGuess": "",
            "thoughtProcess": "",
        }

    def get_game_metrics(self) -> dict:
        if self.orchestrator:
            return self.orchestrator.get_game_metrics()
        return {}

    def get_persistent_player_stats(self) -> list[dict]:
        return self._db.get_player_stats()

    def get_belief_convergence_rate(self) -> float:
        return self._db.get_belief_convergence_rate()

    def get_strategy_effectiveness(self) -> dict:
        return self._db.get_strategy_effectiveness()


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
