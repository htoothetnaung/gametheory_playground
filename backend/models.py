"""
Pydantic models for game state - matches frontend TypeScript types exactly.
Based on app/src/types/index.ts
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field
from enum import Enum
import time
import uuid


class GamePhase(str, Enum):
    CLUE_GIVING = "clue_giving"
    VOTING = "voting"
    IMPOSTER_GUESS = "imposter_guess"
    ENDED = "ended"


class RiskLevel(str, Enum):
    SAFE = "safe"
    MODERATE = "moderate"
    RISKY = "risky"
    DANGEROUS = "dangerous"


class PlayerRole(str, Enum):
    CIVILIAN = "civilian"
    IMPOSTER = "imposter"


class Player(BaseModel):
    """Represents a player in the game"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: PlayerRole
    is_alive: bool = True
    is_speaking: bool = False
    position: int
    color: str
    avatar_seed: str

    class Config:
        # Allow camelCase aliases for frontend compatibility
        populate_by_name = True

    def to_frontend(self) -> dict:
        """Convert to frontend-compatible format (camelCase)"""
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role.value,
            "isAlive": self.is_alive,
            "isSpeaking": self.is_speaking,
            "position": self.position,
            "color": self.color,
            "avatarSeed": self.avatar_seed,
        }


class CandidateWord(BaseModel):
    """A word the imposter suspects with its probability"""

    word: str
    probability: float = Field(ge=0.0, le=1.0)


class ImposterKnowledge(BaseModel):
    """Imposter's Bayesian belief state - tracks what they think the secret word is"""

    candidate_words: list[CandidateWord] = []
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    entropy: float = Field(default=1.0, ge=0.0)
    top_guess: str = ""
    thought_process: str = ""

    def to_frontend(self) -> dict:
        return {
            "candidateWords": [
                {"word": cw.word, "probability": cw.probability}
                for cw in self.candidate_words
            ],
            "confidence": self.confidence,
            "entropy": self.entropy,
            "topGuess": self.top_guess,
            "thoughtProcess": self.thought_process,
        }


class Clue(BaseModel):
    """A clue given by a player with game-theory metrics"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    player_name: str
    clue: str
    timestamp: float = Field(default_factory=time.time)
    semantic_distance: float = Field(ge=0.0, le=1.0)  # Cosine similarity to secret word
    risk_level: RiskLevel = RiskLevel.SAFE

    def to_frontend(self) -> dict:
        return {
            "id": self.id,
            "playerId": self.player_id,
            "playerName": self.player_name,
            "clue": self.clue,
            "timestamp": self.timestamp,
            "semanticDistance": self.semantic_distance,
            "riskLevel": self.risk_level.value,
        }


class Vote(BaseModel):
    """A vote cast by a player"""

    voter_id: str
    target_id: str
    reason: Optional[str] = None

    def to_frontend(self) -> dict:
        return {
            "voterId": self.voter_id,
            "targetId": self.target_id,
            "reason": self.reason,
        }


class AgentInternal(BaseModel):
    """Internal thoughts of an AI agent - for admin dashboard visualization"""

    player_id: str
    player_name: str
    role: PlayerRole
    thought: str
    strategy: str
    timestamp: float = Field(default_factory=time.time)

    def to_frontend(self) -> dict:
        return {
            "playerId": self.player_id,
            "playerName": self.player_name,
            "role": self.role.value,
            "thought": self.thought,
            "strategy": self.strategy,
            "timestamp": self.timestamp,
        }


class SemanticVector(BaseModel):
    """2D point for semantic vector space visualization (PCA/t-SNE reduced)"""

    x: float
    y: float
    label: str
    type: Literal["secret", "civilian_clue", "imposter_clue"]
    distance: Optional[float] = None

    def to_frontend(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "label": self.label,
            "type": self.type,
            "distance": self.distance,
        }


class GameState(BaseModel):
    """Complete game state - synced with frontend store"""

    secret_word: str
    imposter_ids: list[str] = []
    phase: GamePhase = GamePhase.CLUE_GIVING
    round: int = 1
    current_player_index: int = 0
    players: list[Player] = []
    clues: list[Clue] = []
    votes: list[Vote] = []
    imposter_knowledge: ImposterKnowledge = Field(default_factory=ImposterKnowledge)
    winner: Optional[Literal["civilians", "imposter"]] = None

    @property
    def imposter_id(self) -> str:
        """Backward-compatible property returning first imposter ID."""
        return self.imposter_ids[0] if self.imposter_ids else ""

    def to_frontend(self) -> dict:
        return {
            "secretWord": self.secret_word,
            "imposterId": self.imposter_ids[0] if self.imposter_ids else "",
            "imposterIds": self.imposter_ids,
            "phase": self.phase.value,
            "round": self.round,
            "currentPlayerIndex": self.current_player_index,
            "players": [p.to_frontend() for p in self.players],
            "clues": [c.to_frontend() for c in self.clues],
            "votes": [v.to_frontend() for v in self.votes],
            "imposterKnowledge": self.imposter_knowledge.to_frontend(),
            "winner": self.winner,
        }

    def get_current_player(self) -> Optional[Player]:
        alive_players = [p for p in self.players if p.is_alive]
        if 0 <= self.current_player_index < len(alive_players):
            return alive_players[self.current_player_index]
        return None

    def get_imposters(self) -> list[Player]:
        return [p for p in self.players if p.id in self.imposter_ids]

    def get_imposter(self) -> Optional[Player]:
        """Backward-compatible: returns first imposter."""
        imposters = self.get_imposters()
        return imposters[0] if imposters else None

    def get_alive_count(self) -> int:
        return sum(1 for p in self.players if p.is_alive)


# ============ Request/Response Models for API ============


class GameConfig(BaseModel):
    """Configuration for starting a new game"""

    num_players: int = Field(default=5, ge=3, le=10)
    word_pool: Optional[list[str]] = None  # If None, use default pool


class ClueRequest(BaseModel):
    """Request to generate a clue for current player"""

    pass  # Game engine handles context


class VoteRequest(BaseModel):
    """Request to cast a vote"""

    voter_id: str
    target_id: str
    reason: Optional[str] = None


class GameActionResponse(BaseModel):
    """Generic response for game actions"""

    success: bool
    message: str
    state: Optional[dict] = None
