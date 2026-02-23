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
import re
import time
from typing import Optional, Callable, Awaitable

# Add paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.civilian_agent import create_civilian_agent, generate_civilian_clue
from agents.imposter_agent import (
    create_imposter_agent,
    generate_imposter_clue,
    ImposterState,
)
from agents.tools.bayesian_updater import DEFAULT_WORD_POOL, update_word_beliefs
from agents.voter_agent import (
    player_suspicion_score,
    calculate_shapley_values,
    choose_vote_target,
)

from backend.models import (
    GameState,
    GamePhase,
    Player,
    PlayerRole,
    Clue,
    Vote,
    ImposterKnowledge,
    CandidateWord,
    AgentInternal,
    RiskLevel,
)
from backend.embeddings import get_embedding_service


# Player name pool for generated players
PLAYER_NAMES = [
    "Ross",
    "Colin",
    "Austin",
    "HtooThet",
    "PyaeLinn",
    "MinSett",
    "YoonMe",
    "SuMyat",
    "Blake",
    "Cameron",
]

# Player colors for UI
PLAYER_COLORS = [
    "#FF4D6D",
    "#2DE2E6",
    "#4CC9F0",
    "#00F5D4",
    "#FFD60A",
    "#9D4EDD",
    "#06D6A0",
    "#FF9E00",
    "#F72585",
    "#72EFDD",
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
        self.max_rounds = 2  # 2 rounds of clue-giving before voting
        self.is_paused = False

        # Conversation memory and reasoning traces
        self.memory_window = 8
        self.reasoning_patterns: list[str] = []

        # Phase 5 baseline modes
        self.noisy_channel_mode = False
        self.noisy_channel_probability = 0.0
        self.delayed_information_turns = 0
        self._turn_counter = 0
        self._delayed_clue_buffer: list[dict] = []

        # Runtime strategy telemetry
        self._strategy_tracker = {"safe": 0, "risky": 0}
        self._llm_backoff_until = 0.0
        self._llm_backoff_reason = ""

    def _llm_backoff_active(self) -> bool:
        return time.time() < self._llm_backoff_until

    def _set_llm_backoff_from_error(self, err: Exception, fallback_seconds: int = 30):
        message = str(err)
        delay_seconds = fallback_seconds

        retry_match = re.search(r"retry in\s+([\d\.]+)s", message, re.IGNORECASE)
        if retry_match:
            try:
                delay_seconds = max(fallback_seconds, int(float(retry_match.group(1))))
            except Exception:
                delay_seconds = fallback_seconds

        retry_ms_match = re.search(r"retry in\s+([\d\.]+)ms", message, re.IGNORECASE)
        if retry_ms_match:
            try:
                delay_seconds = max(
                    fallback_seconds, int(float(retry_ms_match.group(1)) / 1000.0)
                )
            except Exception:
                delay_seconds = fallback_seconds

        self._llm_backoff_until = time.time() + delay_seconds
        self._llm_backoff_reason = message[:240]

    def _civilian_fallback_result(self, player: Player) -> dict:
        fallback_clues = ["everyday", "classic", "symbol", "memory", "habit", "detail"]
        clue_choice = fallback_clues[
            (self.state.round + player.position) % len(fallback_clues)
        ]
        reason = "Fallback clue used while model provider is temporarily unavailable."
        if self._llm_backoff_active() and self._llm_backoff_reason:
            reason = (
                "Fallback clue used during provider cooldown after quota/rate limit."
            )

        return {
            "clue": clue_choice,
            "reasoning": reason,
            "strategy": "Resilient fallback strategy",
            "raw_response": "",
        }

    def _imposter_fallback_result(self, player: Player) -> dict:
        fallback_bluffs = ["familiar", "common", "daily", "popular", "usual", "shared"]
        bluff_choice = fallback_bluffs[
            (self.state.round + player.position) % len(fallback_bluffs)
        ]
        analysis = "Fallback bluff due to temporary model/API failure."
        if self._llm_backoff_active() and self._llm_backoff_reason:
            analysis = (
                "Fallback bluff used during provider cooldown after quota/rate limit."
            )

        return {
            "clue": bluff_choice,
            "analysis": analysis,
            "top_guesses": "",
            "reasoning": "Using low-risk generic clue to stay in game.",
            "confidence": "0%",
            "confidence_value": 0.0,
            "raw_response": "",
        }

    def configure_research_modes(
        self,
        noisy_channel_mode: bool = False,
        noisy_channel_probability: float = 0.0,
        delayed_information_turns: int = 0,
    ):
        """Configure Phase 5 baseline research modes."""
        self.noisy_channel_mode = noisy_channel_mode
        self.noisy_channel_probability = max(0.0, min(1.0, noisy_channel_probability))
        self.delayed_information_turns = max(0, delayed_information_turns)

    async def start_game(
        self, num_players: int = 6, num_imposters: int = 2
    ) -> GameState:
        """
        Start a new game.

        Args:
            num_players: Number of players (3-10)
            num_imposters: Number of imposters (1 to num_players-2)

        Returns:
            Initial GameState
        """
        # Validate
        num_players = max(3, min(10, num_players))
        num_imposters = max(1, min(num_players - 2, num_imposters))

        # Select secret word
        secret_word = random.choice(self.word_pool)

        # Create players
        players = []
        imposter_indices = random.sample(range(num_players), num_imposters)

        for i in range(num_players):
            role = PlayerRole.IMPOSTER if i in imposter_indices else PlayerRole.CIVILIAN
            player = Player(
                name=PLAYER_NAMES[i],
                role=role,
                position=i,
                color=PLAYER_COLORS[i],
                avatar_seed=f"avatar_{i}_{random.randint(1000, 9999)}",
            )
            players.append(player)

        imposter_ids = [players[idx].id for idx in imposter_indices]

        # Create game state
        self.state = GameState(
            secret_word=secret_word,
            imposter_ids=imposter_ids,
            phase=GamePhase.CLUE_GIVING,
            round=1,
            current_player_index=0,
            players=players,
            clues=[],
            votes=[],
            imposter_knowledge=ImposterKnowledge(),
            winner=None,
        )

        # Initialize imposter belief state
        self.imposter_state = ImposterState(self.word_pool)
        self.reasoning_patterns = []
        self._turn_counter = 0
        self._delayed_clue_buffer = []
        self._strategy_tracker = {"safe": 0, "risky": 0}

        # Create agents
        self.civilian_agent = create_civilian_agent(
            model=self.llm_model, provider=self.llm_provider
        )
        self.imposter_agent = create_imposter_agent(
            model=self.llm_model, provider=self.llm_provider
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

        self._reveal_delayed_clues_if_due()

        # Get current player
        current_player = self.state.get_current_player()
        if not current_player:
            return None

        # Mark player as speaking
        current_player.is_speaking = True
        await self._broadcast_state()

        # Build context windows
        clue_history = [c.clue for c in self.state.clues][-self.memory_window :]
        recent_votes = self._get_recent_votes(self.memory_window)
        reasoning_context = self.reasoning_patterns[-self.memory_window :]

        # Generate clue based on role
        if current_player.role == PlayerRole.IMPOSTER:
            result = await self._run_imposter_turn(
                current_player,
                clue_history,
                recent_votes,
                reasoning_context,
            )
        else:
            result = await self._run_civilian_turn(
                current_player,
                clue_history,
                recent_votes,
                reasoning_context,
            )

        if self.noisy_channel_mode and random.random() < self.noisy_channel_probability:
            result["clue"] = self._apply_noisy_channel(result["clue"])

        # Create clue object
        (
            similarity,
            risk_level,
        ) = await self.embedding_service.calculate_semantic_distance(
            result["clue"], self.state.secret_word
        )

        clue = Clue(
            player_id=current_player.id,
            player_name=current_player.name,
            clue=result["clue"],
            semantic_distance=similarity,
            risk_level=RiskLevel(risk_level),
        )

        # Add clue to state (immediate or delayed reveal mode)
        if self.delayed_information_turns > 0:
            self._delayed_clue_buffer.append(
                {
                    "reveal_turn": self._turn_counter + self.delayed_information_turns,
                    "clue": clue,
                }
            )
        else:
            self.state.clues.append(clue)

        if self._turn_counter is None:
            self._turn_counter = 0
        self._turn_counter += 1
        self._reveal_delayed_clues_if_due()

        reasoning = result.get("reasoning") or result.get("analysis")
        if reasoning:
            self.reasoning_patterns.append(reasoning)

        # Update imposter knowledge if this was imposter's turn
        if current_player.role == PlayerRole.IMPOSTER and self.imposter_state:
            self.state.imposter_knowledge = ImposterKnowledge(
                candidate_words=[
                    CandidateWord(word=c["word"], probability=c["probability"])
                    for c in self.imposter_state.get_top_candidates(5)
                ],
                confidence=self.imposter_state.confidence,
                entropy=self.imposter_state.entropy,
                top_guess=self.imposter_state.get_best_guess()[0],
                thought_process=result.get("analysis", ""),
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
        clue_history: list[str],
        recent_votes: list[dict],
        reasoning_context: list[str],
    ) -> dict:
        """Run a civilian agent's turn"""
        if self._llm_backoff_active():
            result = self._civilian_fallback_result(player)
        else:
            try:
                result = await generate_civilian_clue(
                    agent=self.civilian_agent,
                    secret_word=self.state.secret_word,
                    clue_history=clue_history,
                    player_name=player.name,
                    votes_context=recent_votes,
                    reasoning_context=reasoning_context,
                )
            except Exception as err:
                print(f"Civilian agent fallback ({player.name}): {err}")
                self._set_llm_backoff_from_error(err)
                result = self._civilian_fallback_result(player)

        # Broadcast agent internal thoughts
        if self.on_agent_internal:
            internal = AgentInternal(
                player_id=player.id,
                player_name=player.name,
                role=PlayerRole.CIVILIAN,
                thought=result.get("reasoning", "Generating clue..."),
                strategy=result.get("strategy", "Mixed Strategy"),
            )
            await self.on_agent_internal(internal.to_frontend())

        return result

    async def _run_imposter_turn(
        self,
        player: Player,
        clue_history: list[str],
        recent_votes: list[dict],
        reasoning_context: list[str],
    ) -> dict:
        """Run the imposter agent's turn"""
        # First, update beliefs with any new clues
        for clue in clue_history:
            if clue not in self.imposter_state.analyzed_clues:
                update_result = update_word_beliefs(
                    current_beliefs=self.imposter_state.beliefs,
                    new_clue=clue,
                    word_pool=self.word_pool,
                )
                self.imposter_state.beliefs = update_result["updated_beliefs"]
                self.imposter_state.confidence = update_result["confidence"]
                self.imposter_state.entropy = update_result.get(
                    "entropy", self.imposter_state.entropy
                )
                self.imposter_state.entropy_history.append(self.imposter_state.entropy)
                self.imposter_state.analyzed_clues.append(clue)

        if self.imposter_state.entropy > 0.65:
            bluff_risk_hint = "safe"
            self.imposter_state.risk_profile = "safe"
            if self._strategy_tracker.get("safe") is None:
                self._strategy_tracker["safe"] = 0
            self._strategy_tracker["safe"] += 1
        elif self.imposter_state.entropy < 0.35:
            bluff_risk_hint = "risky"
            self.imposter_state.risk_profile = "risky"
            if self._strategy_tracker.get("risky") is None:
                self._strategy_tracker["risky"] = 0
            self._strategy_tracker["risky"] += 1
        else:
            bluff_risk_hint = "balanced"
            self.imposter_state.risk_profile = "balanced"

        # Generate bluff clue
        if self._llm_backoff_active():
            result = self._imposter_fallback_result(player)
            self.imposter_state.confidence = 0.0
        else:
            try:
                result = await generate_imposter_clue(
                    agent=self.imposter_agent,
                    imposter_state=self.imposter_state,
                    clue_history=clue_history,
                    player_name=player.name,
                    votes_context=recent_votes,
                    reasoning_context=reasoning_context,
                    bluff_risk_hint=bluff_risk_hint,
                )
            except Exception as err:
                print(f"Imposter agent fallback ({player.name}): {err}")
                self._set_llm_backoff_from_error(err)
                result = self._imposter_fallback_result(player)
                self.imposter_state.confidence = 0.0

        # Broadcast agent internal thoughts
        if self.on_agent_internal:
            thought = (
                f"Analysis: {result.get('analysis', 'Analyzing clues...')} | "
                f"Top guess: {self.imposter_state.get_best_guess()[0]} | "
                f"Confidence: {self.imposter_state.confidence * 100:.0f}%"
            )
            internal = AgentInternal(
                player_id=player.id,
                player_name=player.name,
                role=PlayerRole.IMPOSTER,
                thought=thought,
                strategy=f"Bayesian Bluffing ({self.imposter_state.risk_profile})",
            )
            await self.on_agent_internal(internal.to_frontend())

        return result

    async def _advance_turn(self):
        """Advance to the next player's turn"""
        if not self.state:
            return

        if self.state.current_player_index is None:
            self.state.current_player_index = 0
        if self.state.round is None:
            self.state.round = 1

        alive_players = [p for p in self.state.players if p.is_alive]
        if not alive_players:
            return

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

        vote_counts: dict[str, int] = {}
        alive_players = [p for p in self.state.players if p.is_alive]

        clue_payloads = [
            {
                "player_id": clue.player_id,
                "clue": clue.clue,
                "semantic_distance": clue.semantic_distance,
                "risk_level": clue.risk_level.value,
            }
            for clue in self.state.clues
        ]

        suspicion_scores: dict[str, float] = {}
        for player in alive_players:
            assessment = player_suspicion_score(player.id, clue_payloads)
            suspicion_scores[player.id] = assessment["suspicion_score"]

        shapley_values = calculate_shapley_values(suspicion_scores)

        for player in alive_players:
            target_id = choose_vote_target(
                voter_id=player.id,
                alive_player_ids=[p.id for p in alive_players],
                shapley_values=shapley_values,
                suspicion_scores=suspicion_scores,
            )
            if not target_id:
                continue

            target = next((p for p in alive_players if p.id == target_id), None)
            if not target:
                continue

            vote = Vote(
                voter_id=player.id,
                target_id=target.id,
                reason=(
                    f"Coalition target via Shapley={shapley_values.get(target.id, 0):.3f}, "
                    f"suspicion={suspicion_scores.get(target.id, 0):.3f}"
                ),
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
        imposters = self.state.get_imposters()
        alive_imposters = [imp for imp in imposters if imp.is_alive]

        if not alive_imposters:
            # All imposters eliminated - Civilians win!
            self.state.winner = "civilians"
            self.state.phase = GamePhase.ENDED
        elif self.state.get_alive_count() <= len(alive_imposters) + 1:
            # Too few civilians left - Imposters win!
            self.state.winner = "imposter"
            self.state.phase = GamePhase.ENDED
        # Otherwise, the game loop will cycle back to clue_giving

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

    async def reset(self, num_players: int = 6, num_imposters: int = 2) -> GameState:
        """Reset and start a new game"""
        self.is_paused = False
        self.embedding_service.clear_cache()
        return await self.start_game(num_players, num_imposters)

    async def _broadcast_state(self):
        """Broadcast current state to connected clients"""
        if self.on_state_change and self.state:
            await self.on_state_change(self.state.to_frontend())

    def _get_recent_votes(self, window: int) -> list[dict]:
        if not self.state:
            return []
        votes = self.state.votes[-window:]
        id_to_name = {p.id: p.name for p in self.state.players}
        return [
            {
                "voter": id_to_name.get(v.voter_id, v.voter_id),
                "target": id_to_name.get(v.target_id, v.target_id),
                "reason": v.reason or "",
            }
            for v in votes
        ]

    def _apply_noisy_channel(self, clue: str) -> str:
        if not clue:
            return clue
        if len(clue) < 4:
            return f"maybe {clue}"
        index = random.randint(1, len(clue) - 2)
        replacement = random.choice(["?", "~", "*"])
        return f"{clue[:index]}{replacement}{clue[index + 1 :]}"

    def _reveal_delayed_clues_if_due(self):
        if not self._delayed_clue_buffer or not self.state:
            return
        ready = [
            item
            for item in self._delayed_clue_buffer
            if item["reveal_turn"] <= self._turn_counter
        ]
        self._delayed_clue_buffer = [
            item
            for item in self._delayed_clue_buffer
            if item["reveal_turn"] > self._turn_counter
        ]
        for item in ready:
            self.state.clues.append(item["clue"])

    async def get_semantic_vectors(self) -> list[dict]:
        """
        Get 2D semantic vectors for visualization.
        Uses backend PCA/t-SNE projection.

        Returns:
            List of SemanticVector dicts for the admin dashboard
        """
        if not self.state:
            return []

        items = [
            {
                "text": self.state.secret_word,
                "label": self.state.secret_word,
                "type": "secret",
                "distance": 0.0,
            }
        ]
        for clue in self.state.clues:
            player = next(
                (p for p in self.state.players if p.id == clue.player_id), None
            )
            clue_type = (
                "imposter_clue"
                if player and player.role == PlayerRole.IMPOSTER
                else "civilian_clue"
            )
            items.append(
                {
                    "text": clue.clue,
                    "label": clue.clue,
                    "type": clue_type,
                    "distance": clue.semantic_distance,
                }
            )

        return await self.embedding_service.project_texts_to_2d(items)

    def get_game_metrics(self) -> dict:
        """Return runtime game-theory metrics for dashboards."""
        if not self.state:
            return {}

        clues = self.state.clues
        if not clues:
            return {
                "averageCivilianSimilarity": 0.0,
                "totalClues": 0,
                "optimalCluesCount": 0,
                "optimalCluesRatio": 0.0,
                "informationLeakage": False,
                "coordinationFailure": False,
                "imposterConfidence": self.imposter_state.confidence
                if self.imposter_state
                else 0.0,
                "playerLeakage": {},
                "strategyWinRate": {"safe": 0.0, "risky": 0.0},
                "entropyHistory": self.imposter_state.entropy_history[-12:]
                if self.imposter_state
                else [],
            }

        imposter_ids = set(self.state.imposter_ids)
        civilian_clues = [c for c in clues if c.player_id not in imposter_ids]
        civilian_similarities = [c.semantic_distance for c in civilian_clues]
        avg_similarity = (
            sum(civilian_similarities) / len(civilian_similarities)
            if civilian_similarities
            else 0.0
        )
        optimal_clues = sum(1 for s in civilian_similarities if 0.4 <= s <= 0.6)

        player_leakage: dict[str, float] = {}
        for player in self.state.players:
            player_clues = [
                c.semantic_distance for c in clues if c.player_id == player.id
            ]
            if player_clues:
                player_leakage[player.name] = round(
                    sum(player_clues) / len(player_clues), 3
                )

        safe_count = self._strategy_tracker.get("safe", 0)
        risky_count = self._strategy_tracker.get("risky", 0)
        total_strategy = max(safe_count + risky_count, 1)

        return {
            "averageCivilianSimilarity": round(avg_similarity, 3),
            "totalClues": len(clues),
            "optimalCluesCount": optimal_clues,
            "optimalCluesRatio": round(optimal_clues / len(civilian_clues), 3)
            if civilian_clues
            else 0.0,
            "informationLeakage": avg_similarity > 0.6,
            "coordinationFailure": avg_similarity < 0.4,
            "imposterConfidence": self.imposter_state.confidence
            if self.imposter_state
            else 0.0,
            "playerLeakage": player_leakage,
            "strategyWinRate": {
                "safe": round(safe_count / total_strategy, 3),
                "risky": round(risky_count / total_strategy, 3),
            },
            "entropyHistory": self.imposter_state.entropy_history[-12:]
            if self.imposter_state
            else [],
            "phase5Modes": {
                "noisy_channel": self.noisy_channel_mode,
                "delayed_information_turns": self.delayed_information_turns,
            },
        }
