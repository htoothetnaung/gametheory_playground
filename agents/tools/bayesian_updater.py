"""
Bayesian Updater Tool for ADK Agents.

Game Theory Application (Straffin Chapter 10 - Games Against Nature):
This tool implements Bayesian Decision Making for the Imposter agent.
The Imposter is playing a "Game Against Nature" where:
- Prior: All words are equally likely (uniform distribution)
- Evidence: Each clue provides information to update beliefs
- Posterior: Updated probability distribution over candidate words

The Imposter must reduce entropy (uncertainty) to guess the secret word.
"""
import asyncio
import sys
import os
from typing import Optional

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from backend.embeddings import get_embedding_service


# Default word pool for the game
DEFAULT_WORD_POOL = [
    "coffee", "apple", "ocean", "mountain", "guitar", 
    "diamond", "thunder", "butterfly", "castle", "dragon",
    "sunset", "robot", "jungle", "pizza", "rocket",
    "library", "volcano", "penguin", "rainbow", "telescope",
    "chocolate", "elephant", "keyboard", "lightning", "pyramid"
]


class BayesianBeliefState:
    """
    Maintains the Imposter's belief distribution over possible secret words.
    
    Implements Bayesian updating per Straffin Chapter 10.
    """
    
    def __init__(self, word_pool: Optional[list[str]] = None):
        self.word_pool = word_pool or DEFAULT_WORD_POOL.copy()
        # Initialize uniform prior - all words equally likely
        n = len(self.word_pool)
        self.beliefs: dict[str, float] = {word: 1.0 / n for word in self.word_pool}
        self.clue_history: list[str] = []
        
    def get_top_candidates(self, n: int = 5) -> list[dict]:
        """Get top N most likely words"""
        sorted_beliefs = sorted(
            self.beliefs.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        return [
            {"word": word, "probability": prob}
            for word, prob in sorted_beliefs[:n]
        ]
    
    def get_confidence(self) -> float:
        """
        Calculate overall confidence (inverse entropy).
        High confidence = beliefs concentrated on few words.
        Low confidence = beliefs spread across many words.
        """
        import math
        entropy = 0.0
        for prob in self.beliefs.values():
            if prob > 0:
                entropy -= prob * math.log2(prob)
        
        # Normalize to 0-1 (max entropy = log2(n))
        max_entropy = math.log2(len(self.word_pool))
        if max_entropy == 0:
            return 1.0
        
        # Invert so higher = more confident
        return 1.0 - (entropy / max_entropy)


def update_word_beliefs(
    current_beliefs: dict[str, float],
    new_clue: str,
    word_pool: Optional[list[str]] = None
) -> dict:
    """
    Update Bayesian beliefs based on a new clue.
    
    This is a FUNCTION TOOL for Google ADK Imposter agent.
    Implements Bayesian updating from Straffin Chapter 10.
    
    Args:
        current_beliefs: dict mapping words to current probabilities
        new_clue: The new clue word/phrase to incorporate
        word_pool: Optional list of possible secret words
        
    Returns:
        dict with:
        - updated_beliefs: new probability distribution
        - top_candidates: top 5 most likely words with probabilities
        - confidence: overall confidence level (0-1)
        - entropy_reduction: how much uncertainty was reduced
        - reasoning: explanation of the Bayesian update
        
    Bayesian Update Formula:
        P(word|clue) ∝ P(clue|word) × P(word)
        
    Where P(clue|word) is approximated by semantic similarity.
    """
    # Run async calculation
    loop = asyncio.get_event_loop()
    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(
                asyncio.run,
                _async_update(current_beliefs, new_clue, word_pool)
            )
            return future.result()
    else:
        return asyncio.run(_async_update(current_beliefs, new_clue, word_pool))


async def _async_update(
    current_beliefs: dict[str, float],
    new_clue: str,
    word_pool: Optional[list[str]]
) -> dict:
    """Async implementation of Bayesian update"""
    import math
    
    service = get_embedding_service()
    
    # Use provided beliefs or initialize uniform
    if not current_beliefs:
        pool = word_pool or DEFAULT_WORD_POOL
        n = len(pool)
        current_beliefs = {word: 1.0 / n for word in pool}
    
    # Calculate prior entropy
    prior_entropy = 0.0
    for prob in current_beliefs.values():
        if prob > 0:
            prior_entropy -= prob * math.log2(prob)
    
    # Calculate likelihood P(clue|word) for each word using semantic similarity
    likelihoods = {}
    for word in current_beliefs.keys():
        similarity, _ = await service.calculate_semantic_distance(new_clue, word)
        # Use similarity as likelihood (higher similarity = more likely this is the word)
        # Add small epsilon to avoid zero probabilities
        likelihoods[word] = similarity + 0.01
    
    # Bayesian update: P(word|clue) ∝ P(clue|word) × P(word)
    unnormalized = {
        word: likelihoods[word] * current_beliefs[word]
        for word in current_beliefs.keys()
    }
    
    # Normalize to get valid probability distribution
    total = sum(unnormalized.values())
    updated_beliefs = {
        word: prob / total 
        for word, prob in unnormalized.items()
    }
    
    # Calculate posterior entropy
    posterior_entropy = 0.0
    for prob in updated_beliefs.values():
        if prob > 0:
            posterior_entropy -= prob * math.log2(prob)
    
    # Information gain (entropy reduction)
    entropy_reduction = prior_entropy - posterior_entropy
    
    # Get top candidates
    sorted_beliefs = sorted(
        updated_beliefs.items(),
        key=lambda x: x[1],
        reverse=True
    )
    top_candidates = [
        {"word": word, "probability": round(prob, 4)}
        for word, prob in sorted_beliefs[:5]
    ]
    
    # Calculate confidence
    max_entropy = math.log2(len(current_beliefs))
    confidence = 1.0 - (posterior_entropy / max_entropy) if max_entropy > 0 else 1.0
    normalized_entropy = (posterior_entropy / max_entropy) if max_entropy > 0 else 0.0
    
    # Generate reasoning
    top_word = top_candidates[0]["word"] if top_candidates else "unknown"
    top_prob = top_candidates[0]["probability"] if top_candidates else 0
    
    reasoning = (
        f"Bayesian Update: Clue '{new_clue}' analyzed. "
        f"Information gain: {entropy_reduction:.3f} bits. "
        f"Top hypothesis: '{top_word}' ({top_prob*100:.1f}% probability). "
        f"Overall confidence: {confidence*100:.1f}%."
    )
    
    return {
        "updated_beliefs": updated_beliefs,
        "top_candidates": top_candidates,
        "confidence": round(confidence, 3),
        "entropy": round(normalized_entropy, 3),
        "entropy_reduction": round(entropy_reduction, 3),
        "reasoning": reasoning,
        "clue_analyzed": new_clue
    }


def initialize_beliefs(word_pool: Optional[list[str]] = None) -> dict:
    """
    Initialize uniform prior beliefs over word pool.
    
    Args:
        word_pool: List of possible secret words
        
    Returns:
        dict mapping each word to equal probability (1/n)
    """
    pool = word_pool or DEFAULT_WORD_POOL
    n = len(pool)
    return {word: 1.0 / n for word in pool}


def get_best_guess(beliefs: dict[str, float]) -> tuple[str, float]:
    """
    Get the most likely word based on current beliefs.
    
    Returns:
        tuple of (word, probability)
    """
    if not beliefs:
        return ("unknown", 0.0)
    
    best_word = max(beliefs.items(), key=lambda x: x[1])
    return best_word
