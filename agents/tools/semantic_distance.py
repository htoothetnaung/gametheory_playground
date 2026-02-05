"""
Semantic Distance Tool for ADK Agents.

Game Theory Application (Straffin Chapter 3 - Mixed Strategies):
This tool enables agents to evaluate the "risk" of their clues.
The optimal strategy is a MIXED STRATEGY where clues should land
in the 0.4-0.6 similarity range to balance:
- Information Hiding (don't reveal too much to imposter)
- Signaling (prove to civilians you know the word)
"""
import asyncio
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from backend.embeddings import get_embedding_service


def calculate_clue_risk(
    candidate_clue: str,
    secret_word: str
) -> dict:
    """
    Calculate the semantic distance and risk level for a candidate clue.
    
    This is a FUNCTION TOOL for Google ADK agents.
    Civilians use this to select clues in the optimal "Mixed Strategy" zone.
    
    Args:
        candidate_clue: The clue word/phrase being evaluated
        secret_word: The secret word civilians are trying to hint at
        
    Returns:
        dict with:
        - similarity: float (0-1), cosine similarity to secret word
        - risk_level: str, one of "safe", "moderate", "risky", "dangerous"
        - recommendation: str, strategic advice based on game theory
        - is_optimal: bool, True if in the Nash Equilibrium zone (0.4-0.6)
        
    Game Theory Context:
        - similarity > 0.85: DANGEROUS - You're practically saying the word!
        - similarity > 0.6: RISKY - Imposter can easily deduce the word
        - similarity 0.4-0.6: OPTIMAL - Nash Equilibrium mixed strategy zone
        - similarity < 0.4: SAFE but suspicious - You look like the imposter
    """
    # Run async embedding calculation in sync context
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # If already in async context, create task
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(
                asyncio.run,
                _async_calculate(candidate_clue, secret_word)
            )
            return future.result()
    else:
        return asyncio.run(_async_calculate(candidate_clue, secret_word))


async def _async_calculate(candidate_clue: str, secret_word: str) -> dict:
    """Async implementation of risk calculation"""
    service = get_embedding_service()
    similarity, risk_level = await service.calculate_semantic_distance(
        candidate_clue, 
        secret_word
    )
    
    # Determine if clue is in optimal zone
    is_optimal = 0.4 <= similarity <= 0.6
    
    # Generate strategic recommendation
    if similarity > 0.85:
        recommendation = "REJECT: This clue reveals too much. The imposter will win."
    elif similarity > 0.6:
        recommendation = "CAUTION: High information leakage. Consider a more abstract clue."
    elif similarity >= 0.4:
        recommendation = "OPTIMAL: This clue is in the Nash Equilibrium zone. Good mixed strategy."
    elif similarity >= 0.2:
        recommendation = "ACCEPTABLE: Low risk but might seem suspicious to other civilians."
    else:
        recommendation = "WARNING: Clue too vague. Other civilians might vote you out as imposter."
    
    return {
        "similarity": round(similarity, 3),
        "risk_level": risk_level,
        "recommendation": recommendation,
        "is_optimal": is_optimal,
        "candidate_clue": candidate_clue,
        "secret_word": secret_word,  # Include for context
    }


def evaluate_multiple_clues(
    candidate_clues: list[str],
    secret_word: str
) -> dict:
    """
    Evaluate multiple candidate clues and rank them by optimality.
    
    Used by Civilian agents to select the best clue from generated options.
    Implements the Mixed Strategy selection from Straffin Chapter 3.
    
    Args:
        candidate_clues: List of potential clue words/phrases
        secret_word: The secret word to hint at
        
    Returns:
        dict with:
        - evaluations: list of evaluation results for each clue
        - best_clue: the clue closest to optimal (0.5 similarity)
        - strategy_explanation: why this clue was selected
    """
    evaluations = []
    
    for clue in candidate_clues:
        result = calculate_clue_risk(clue, secret_word)
        evaluations.append(result)
    
    # Sort by distance from optimal (0.5)
    evaluations.sort(key=lambda x: abs(x["similarity"] - 0.5))
    
    best = evaluations[0] if evaluations else None
    
    return {
        "evaluations": evaluations,
        "best_clue": best["candidate_clue"] if best else None,
        "best_similarity": best["similarity"] if best else None,
        "strategy_explanation": (
            f"Selected '{best['candidate_clue']}' with similarity {best['similarity']:.2f}. "
            f"This is {'in' if best['is_optimal'] else 'outside'} the optimal Nash Equilibrium zone (0.4-0.6). "
            f"Game Theory: Mixed strategy balances information hiding vs. signaling."
        ) if best else "No clues to evaluate"
    }
