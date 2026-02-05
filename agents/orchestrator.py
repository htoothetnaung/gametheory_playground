"""
Game Orchestrator - Multi-agent coordinator for Semantic Signaling.

This orchestrator manages the game flow:
1. Turn-based clue giving (Civilian/Imposter agents)
2. Phase transitions (clue_giving → voting → imposter_guess → ended)
3. Agent coordination and state synchronization

Game Theory Application (Straffin Chapter 19 & 23 - N-Person Games & Coalitions):
- Civilians form a "Grand Coalition" trying to identify the Imposter
- The Imposter tries to "disrupt the Core" by blending in
- Voting uses coalition-value calculations
"""
import os
import sys
import random
from typing import Optional, Callable, Awaitable

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.civilian_agent import create_civilian_agent, generate_civilian_clue
from agents.imposter_agent import create_imposter_agent, generate_imposter_clue, ImposterState
from agents.tools.bayesian_updater import DEFAULT_WORD_POOL, update_word_beliefs

from backend.models import (
    GameState, GamePhase, Player, PlayerRole, Clue, Vote,
    ImposterKnowledge, CandidateWord, AgentInternal, RiskLevel
)
from backend.embeddings import get_embedding_service


# Player name pool for generated players
PLAYER_NAMES = [
    "Alex", "Jordan", "Taylor", "Casey", "Morgan",
    "Riley", "Quinn", "Avery", "Blake", "Cameron"
]

# Player colors for UI
PLAYER_COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
]


class GameOrchestrator:
    """
    Orchestrates the multi-agent game loop.
    
    Manages turn order, agent invocation, state updates,
    and broadcasts events to connected clients.
    """
    
    def __init__(
        self,
        llm_provider: str = "gemini",
        llm_model: str = "gemini-2.0-flash",
        word_pool: Optional[list[str]] = None,
        on_state_change: Optional[Callable[[dict], Awaitable[None]]] = None,
        on_agent_internal: Optional[Callable[[dict], Awaitable[None]]] = None,
    ):
        """
        Initialize the game orchestrator.
        
        Args:
            llm_provider: "gemini" or "groq"
            llm_model: Model name to use
            word_pool: Custom word pool (uses default if None)
            on_state_change: Callback when game state changes
            on_agent_internal: Callback for agent internal thoughts
        """
        self.llm_provider = llm_provider
        self.llm_model = llm_model
        self.word_pool = word_pool or DEFAULT_WORD_POOL.copy()
        self.on_state_change = on_state_change
        self.on_agent_internal = on_agent_internal
        
        # Game state
        self.state: Optional[GameState] = None
        self.imposter_state: Optional[ImposterState] = None
        
        # Agents (created on game start)
        self.civilian_agent = None
        self.imposter_agent = None
        
        # Embedding service
        self.embedding_service = get_embedding_service()
        
        # Game settings
        self.clues_per_round = 1  # Each player gives 1 clue per round
        self.max_rounds = 3
        self.is_paused = False
        
    async def start_game(self, num_players: int = 6) -> GameState:
        """
        Start a new game.
        
        Args:
            num_players: Number of players (3-10)
            
        Returns:
            Initial GameState
        """
        # Validate
        num_players = max(3, min(10, num_players))
        
        # Select secret word
        secret_word = random.choice(self.word_pool)
        
        # Create players
        players = []
        imposter_index = random.randint(0, num_players - 1)
        
        for i in range(num_players):
            role = PlayerRole.IMPOSTER if i == imposter_index else PlayerRole.CIVILIAN
            player = Player(
                name=PLAYER_NAMES[i],
                role=role,
                position=i,
                color=PLAYER_COLORS[i],
                avatar_seed=f"avatar_{i}_{random.randint(1000, 9999)}"
            )
            players.append(player)
        
        imposter_id = players[imposter_index].id
        
        # Create game state
        self.state = GameState(
            secret_word=secret_word,
            imposter_id=imposter_id,
            phase=GamePhase.CLUE_GIVING,
            round=1,
            current_player_index=0,
            players=players,
            clues=[],
            votes=[],
            imposter_knowledge=ImposterKnowledge(),
            winner=None
        )
        
        # Initialize imposter belief state
        self.imposter_state = ImposterState(self.word_pool)
        
        # Create agents
        self.civilian_agent = create_civilian_agent(
            model=self.llm_model,
            provider=self.llm_provider
        )
        self.imposter_agent = create_imposter_agent(
            model=self.llm_model,
            provider=self.llm_provider
        )
        
        # Broadcast initial state
        await self._broadcast_state()
        
        return self.state
    
    async def run_turn(self) -> Optional[Clue]:
        """
        Run a single turn - current player gives a clue.
        
        Returns:
            The Clue given, or None if game is over/paused
        """
        if self.is_paused or not self.state:
            return None
            
        if self.state.phase != GamePhase.CLUE_GIVING:
            return None
        
        # Get current player
        current_player = self.state.get_current_player()
        if not current_player:
            return None
        
        # Mark player as speaking
        current_player.is_speaking = True
        await self._broadcast_state()
        
        # Get clue history
        clue_history = [c.clue for c in self.state.clues]
        
        # Generate clue based on role
        if current_player.role == PlayerRole.IMPOSTER:
            result = await self._run_imposter_turn(current_player, clue_history)
        else:
            result = await self._run_civilian_turn(current_player, clue_history)
        
        # Create clue object
        similarity, risk_level = await self.embedding_service.calculate_semantic_distance(
            result["clue"],
            self.state.secret_word
        )
        
        clue = Clue(
            player_id=current_player.id,
            player_name=current_player.name,
            clue=result["clue"],
            semantic_distance=similarity,
            risk_level=RiskLevel(risk_level)
        )
        
        # Add clue to state
        self.state.clues.append(clue)
        
        # Update imposter knowledge if this was imposter's turn
        if current_player.role == PlayerRole.IMPOSTER and self.imposter_state:
            self.state.imposter_knowledge = ImposterKnowledge(
                candidate_words=[
                    CandidateWord(word=c["word"], probability=c["probability"])
                    for c in self.imposter_state.get_top_candidates(5)
                ],
                confidence=self.imposter_state.confidence,
                top_guess=self.imposter_state.get_best_guess()[0],
                thought_process=result.get("analysis", "")
            )
        
        # Clear speaking flag
        current_player.is_speaking = False
        
        # Advance to next player
        await self._advance_turn()
        
        # Broadcast updated state
        await self._broadcast_state()
        
        return clue
    
    async def _run_civilian_turn(
        self, 
        player: Player, 
        clue_history: list[str]
    ) -> dict:
        """Run a civilian agent's turn"""
        result = await generate_civilian_clue(
            agent=self.civilian_agent,
            secret_word=self.state.secret_word,
            clue_history=clue_history,
            player_name=player.name
        )
        
        # Broadcast agent internal thoughts
        if self.on_agent_internal:
            internal = AgentInternal(
                player_id=player.id,
                player_name=player.name,
                role=PlayerRole.CIVILIAN,
                thought=result.get("reasoning", "Generating clue..."),
                strategy=result.get("strategy", "Mixed Strategy")
            )
            await self.on_agent_internal(internal.to_frontend())
        
        return result
    
    async def _run_imposter_turn(
        self,
        player: Player,
        clue_history: list[str]
    ) -> dict:
        """Run the imposter agent's turn"""
        # First, update beliefs with any new clues
        for clue in clue_history:
            if clue not in self.imposter_state.analyzed_clues:
                update_result = update_word_beliefs(
                    current_beliefs=self.imposter_state.beliefs,
                    new_clue=clue,
                    word_pool=self.word_pool
                )
                self.imposter_state.beliefs = update_result["updated_beliefs"]
                self.imposter_state.confidence = update_result["confidence"]
                self.imposter_state.analyzed_clues.append(clue)
        
        # Generate bluff clue
        result = await generate_imposter_clue(
            agent=self.imposter_agent,
            imposter_state=self.imposter_state,
            clue_history=clue_history,
            player_name=player.name
        )
        
        # Broadcast agent internal thoughts
        if self.on_agent_internal:
            thought = (
                f"Analysis: {result.get('analysis', 'Analyzing clues...')} | "
                f"Top guess: {self.imposter_state.get_best_guess()[0]} | "
                f"Confidence: {self.imposter_state.confidence*100:.0f}%"
            )
            internal = AgentInternal(
                player_id=player.id,
                player_name=player.name,
                role=PlayerRole.IMPOSTER,
                thought=thought,
                strategy="Bayesian Bluffing"
            )
            await self.on_agent_internal(internal.to_frontend())
        
        return result
    
    async def _advance_turn(self):
        """Advance to the next player's turn"""
        if not self.state:
            return
        
        alive_players = [p for p in self.state.players if p.is_alive]
        
        # Move to next player
        self.state.current_player_index += 1
        
        # Check if round is complete
        if self.state.current_player_index >= len(alive_players):
            self.state.current_player_index = 0
            self.state.round += 1
            
            # Check if max rounds reached → move to voting
            if self.state.round > self.max_rounds:
                self.state.phase = GamePhase.VOTING
                self.state.round = self.max_rounds
    
    async def run_voting_phase(self) -> Optional[str]:
        """
        Run the voting phase.
        
        Game Theory Application (Straffin Ch.19 - Coalitions):
        Civilians form voting coalitions to identify the imposter.
        
        Returns:
            ID of eliminated player, or None
        """
        if not self.state or self.state.phase != GamePhase.VOTING:
            return None
        
        # Simple voting: each agent votes for most suspicious player
        # (In full implementation, use coalition-value calculations)
        
        vote_counts: dict[str, int] = {}
        alive_players = [p for p in self.state.players if p.is_alive]
        
        for player in alive_players:
            # Each player votes for someone else
            candidates = [p for p in alive_players if p.id != player.id]
            if not candidates:
                continue
                
            # Simple heuristic: vote for player with most "risky" clue
            # (Real implementation would use agent reasoning)
            target = random.choice(candidates)
            
            vote = Vote(
                voter_id=player.id,
                target_id=target.id,
                reason="Suspicious clue pattern"
            )
            self.state.votes.append(vote)
            vote_counts[target.id] = vote_counts.get(target.id, 0) + 1
        
        # Find player with most votes
        if vote_counts:
            eliminated_id = max(vote_counts.keys(), key=lambda x: vote_counts[x])
            await self.eliminate_player(eliminated_id)
            return eliminated_id
        
        return None
    
    async def eliminate_player(self, player_id: str):
        """Eliminate a player from the game"""
        if not self.state:
            return
        
        for player in self.state.players:
            if player.id == player_id:
                player.is_alive = False
                break
        
        # Check win conditions
        imposter = self.state.get_imposter()
        
        if imposter and not imposter.is_alive:
            # Imposter eliminated - Civilians win!
            self.state.winner = "civilians"
            self.state.phase = GamePhase.ENDED
        elif self.state.get_alive_count() <= 2:
            # Too few players left - Imposter wins!
            self.state.winner = "imposter"
            self.state.phase = GamePhase.ENDED
        else:
            # Continue to imposter guess phase
            self.state.phase = GamePhase.IMPOSTER_GUESS
        
        await self._broadcast_state()
    
    async def imposter_guess(self, guess: str) -> bool:
        """
        Imposter makes final guess for the secret word.
        
        Returns:
            True if correct (Imposter wins), False otherwise
        """
        if not self.state:
            return False
        
        is_correct = guess.lower().strip() == self.state.secret_word.lower().strip()
        
        if is_correct:
            self.state.winner = "imposter"
        else:
            self.state.winner = "civilians"
        
        self.state.phase = GamePhase.ENDED
        await self._broadcast_state()
        
        return is_correct
    
    def pause(self):
        """Pause the game"""
        self.is_paused = True
    
    def resume(self):
        """Resume the game"""
        self.is_paused = False
    
    async def reset(self, num_players: int = 6) -> GameState:
        """Reset and start a new game"""
        self.is_paused = False
        self.embedding_service.clear_cache()
        return await self.start_game(num_players)
    
    async def _broadcast_state(self):
        """Broadcast current state to connected clients"""
        if self.on_state_change and self.state:
            await self.on_state_change(self.state.to_frontend())
    
    def get_semantic_vectors(self) -> list[dict]:
        """
        Get 2D semantic vectors for visualization.
        Uses simple PCA-like projection for demo.
        
        Returns:
            List of SemanticVector dicts for the admin dashboard
        """
        if not self.state:
            return []
        
        vectors = []
        
        # Secret word at origin
        vectors.append({
            "x": 0.0,
            "y": 0.0,
            "label": self.state.secret_word,
            "type": "secret",
            "distance": 0.0
        })
        
        # Clues positioned by semantic distance
        import math
        for i, clue in enumerate(self.state.clues):
            # Position based on distance and angle
            distance = clue.semantic_distance
            angle = (2 * math.pi * i) / max(len(self.state.clues), 1)
            
            # Scale distance for visualization (closer = higher similarity)
            visual_distance = (1 - distance) * 2
            
            player = next(
                (p for p in self.state.players if p.id == clue.player_id),
                None
            )
            clue_type = "imposter_clue" if player and player.role == PlayerRole.IMPOSTER else "civilian_clue"
            
            vectors.append({
                "x": visual_distance * math.cos(angle),
                "y": visual_distance * math.sin(angle),
                "label": clue.clue,
                "type": clue_type,
                "distance": distance
            })
        
        return vectors
