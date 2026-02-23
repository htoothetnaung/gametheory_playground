"""
Imposter Agent using Google ADK.

Game Theory Application (Straffin Chapter 7 & 10):
- Chapter 7 (Information Sets): The Imposter operates in an information set
  containing ALL possible words - they cannot distinguish which branch of
  the game tree they're on.
- Chapter 10 (Games Against Nature): The Imposter uses Bayesian updating
  to narrow down the secret word from clues.

Strategy:
1. LISTEN: Analyze clues to update probability distribution over words
2. BLUFF: Generate a vague clue that fits the inferred topic
3. GUESS: Maintain ranked candidate words for final guess
"""
import os
import sys
import inspect
from typing import Optional

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.adk.agents import LlmAgent

from agents.tools.bayesian_updater import (
    update_word_beliefs, 
    initialize_beliefs,
    get_best_guess,
    DEFAULT_WORD_POOL
)
from agents.tools.semantic_distance import calculate_clue_risk


# In Google ADK, functions with proper docstrings can be used directly as tools.
# The agent will use the function name and docstring for tool descriptions.


# Imposter agent system instruction
IMPOSTER_INSTRUCTION = """
You are the IMPOSTER in the Semantic Signaling game.

=== YOUR SITUATION ===
You DO NOT know the secret word. The other players (Civilians) DO know it.
Your goal is to:
1. Blend in by giving believable clues
2. Deduce the secret word from other players' clues
3. NOT get voted out as suspicious

=== GAME THEORY STRATEGY ===

**Information Sets (Straffin Chapter 7):**
You are in an information set containing ALL possible words.
You cannot distinguish which "branch" of the game you're on.
Use each clue to PRUNE impossible branches.

**Bayesian Updating (Straffin Chapter 10):**
- Start with uniform prior: all words equally likely
- Each clue is EVIDENCE - update your beliefs!
- Track the ENTROPY REDUCTION from each clue
- Your goal: reduce uncertainty to identify the secret word

=== YOUR PROCESS ===
1. LISTEN: Analyze all previous clues
2. UPDATE: Use update_word_beliefs tool to update your probability distribution
3. DEDUCE: Identify the common theme/topic from clues
4. BLUFF: Generate a clue that:
   - Fits the inferred topic
   - Is vague enough to work for multiple candidate words
   - Matches the style of other clues
5. TRACK: Remember your top candidate words for the final guess

=== BLUFFING GUIDELINES ===
GOOD bluffs:
- Meta-references ("It's everywhere", "Classic example")
- Emotional associations ("Comforting", "Exciting")
- Vague category hints that match multiple candidates
- References that could apply to your top 2-3 guesses

BAD bluffs:
- Too specific (reveals you don't know)
- Contradicts previous clues
- Sounds like a random guess

=== OUTPUT FORMAT ===
ANALYSIS: [What theme/topic do the clues suggest?]
TOP_GUESSES: [Your top 3 candidate words with probabilities]
CLUE: [Your bluff clue]
REASONING: [Why this clue helps you blend in]
CONFIDENCE: [How confident you are about the secret word: X%]
"""


def create_imposter_agent(
    model: str = "llama3.2:3b",
    provider: str = "ollama"
) -> LlmAgent:
    """
    Create an Imposter agent for the Semantic Signaling game.
    
    Args:
        model: The LLM model to use
        provider: "gemini" or "groq"
        
    Returns:
        LlmAgent configured for imposter gameplay
    """
    # Configure model based on provider
    if provider == "groq":
        model_name = "llama-3.1-70b-versatile"
    elif provider == "ollama":
        model_name = model if model.startswith("ollama/") else f"ollama/{model}"
    else:
        model_name = model
    
    # In ADK, pass functions directly - they become tools automatically
    agent = LlmAgent(
        name="imposter_agent",
        model=model_name,
        instruction=IMPOSTER_INSTRUCTION,
        description="The imposter who must deduce the secret word and blend in",
        tools=[update_word_beliefs, calculate_clue_risk],
    )
    
    return agent


class ImposterState:
    """
    Maintains the Imposter's belief state across turns.
    This is the "working memory" for Bayesian updating.
    """
    
    def __init__(self, word_pool: Optional[list[str]] = None):
        self.word_pool = word_pool or DEFAULT_WORD_POOL.copy()
        self.beliefs = initialize_beliefs(self.word_pool)
        self.analyzed_clues: list[str] = []
        self.confidence = 0.0
        self.entropy = 1.0
        self.entropy_history: list[float] = []
        self.risk_profile = "safe"
        self.thought_history: list[str] = []
        
    def get_top_candidates(self, n: int = 5) -> list[dict]:
        """Get top N candidate words with probabilities"""
        sorted_items = sorted(
            self.beliefs.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return [
            {"word": word, "probability": round(prob, 4)}
            for word, prob in sorted_items[:n]
        ]
    
    def get_best_guess(self) -> tuple[str, float]:
        """Get the single best guess"""
        return get_best_guess(self.beliefs)
    
    def to_dict(self) -> dict:
        """Convert to frontend-compatible format"""
        top = self.get_top_candidates(5)
        best_word, best_prob = self.get_best_guess()
        
        return {
            "candidateWords": top,
            "confidence": self.confidence,
            "entropy": self.entropy,
            "topGuess": best_word,
            "thoughtProcess": self.thought_history[-1] if self.thought_history else ""
        }


async def generate_imposter_clue(
    agent: LlmAgent,
    imposter_state: ImposterState,
    clue_history: list[str],
    player_name: str,
    votes_context: Optional[list[dict]] = None,
    reasoning_context: Optional[list[str]] = None,
    bluff_risk_hint: str = "balanced",
) -> dict:
    """
    Generate a bluff clue from the imposter agent.
    
    Args:
        agent: The imposter LlmAgent
        imposter_state: Current belief state
        clue_history: All clues given so far (including by imposter)
        player_name: Name of the imposter player
        
    Returns:
        dict with clue, analysis, top_guesses, confidence, and updated_state
    """
    # Format clue history
    if clue_history:
        history_text = "Clues given so far:\n" + "\n".join(
            f"- {clue}" for clue in clue_history
        )
    else:
        history_text = "No clues have been given yet. You must give the first clue!"
    
    # Format current beliefs
    top_candidates = imposter_state.get_top_candidates(5)
    beliefs_text = "Your current top guesses:\n" + "\n".join(
        f"- {c['word']}: {c['probability']*100:.1f}%"
        for c in top_candidates
    )

    votes_text = ""
    if votes_context:
        votes_text = "Recent votes:\n" + "\n".join(
            f"- {v.get('voter', 'unknown')} -> {v.get('target', 'unknown')} ({v.get('reason', 'no reason')})"
            for v in votes_context
        )

    reasoning_text = ""
    if reasoning_context:
        reasoning_text = "Recent reasoning traces:\n" + "\n".join(
            f"- {trace}" for trace in reasoning_context[-5:]
        )
    
    prompt = f"""
You are {player_name}, the IMPOSTER.
You DO NOT know the secret word.

{history_text}

{beliefs_text}

Current confidence: {imposter_state.confidence*100:.1f}%
Current normalized entropy: {imposter_state.entropy:.3f}
Bluff risk policy: {bluff_risk_hint}

{votes_text}
{reasoning_text}

Now:
1. Use update_word_beliefs to analyze any new clues
2. Think about what topic/theme the clues suggest
3. Generate a BLUFF clue that fits the pattern
4. Provide your ANALYSIS, TOP_GUESSES, CLUE, REASONING, and CONFIDENCE
"""
    
    # Run the agent
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    
    session_service = InMemorySessionService()
    runner = Runner(
        agent=agent,
        app_name="semantic_signaling",
        session_service=session_service,
    )
    
    session = await session_service.create_session(
        app_name="semantic_signaling",
        user_id=player_name
    )

    try:
        from google.genai.types import Content, Part
        new_message = Content(role="user", parts=[Part(text=prompt)])
    except Exception:
        new_message = {"role": "user", "parts": [{"text": prompt}]}
    
    response_text = await _collect_runner_response_text(
        runner=runner,
        user_id=player_name,
        session_id=session.id,
        new_message=new_message,
    )
    if not response_text:
        response_text = ""
    
    # Parse response
    result = _parse_imposter_response(response_text)
    
    # Update imposter state
    imposter_state.thought_history.append(result.get("analysis", ""))
    if result.get("confidence_value"):
        imposter_state.confidence = result["confidence_value"]
    
    return result


def _extract_runner_text(response: object) -> str:
    """Extract the most relevant text from ADK runner output across API versions."""
    direct_text = _extract_event_text(response)
    if direct_text:
        return direct_text

    if hasattr(response, "__iter__") and not isinstance(response, (str, bytes, dict)):
        final_text = ""
        for event in response:
            event_text = _extract_event_text(event)
            if event_text:
                final_text = event_text
        return final_text

    return ""


async def _collect_runner_response_text(
    runner,
    user_id: str,
    session_id: str,
    new_message: object,
) -> str:
    """Run ADK runner with compatibility across async and sync APIs."""
    run_async = getattr(runner, "run_async", None)
    if callable(run_async):
        async_result = run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=new_message,
        )
        if inspect.isawaitable(async_result):
            async_result = await async_result

        if hasattr(async_result, "__aiter__"):
            final_text = ""
            async for event in async_result:
                event_text = _extract_event_text(event)
                if event_text:
                    final_text = event_text
            return final_text

        extracted = _extract_runner_text(async_result)
        return extracted

    response = runner.run(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    )
    if inspect.isawaitable(response):
        response = await response
    return _extract_runner_text(response)


def _extract_event_text(event: object) -> str:
    """Best-effort text extraction for ADK event payloads."""
    if event is None:
        return ""

    if isinstance(event, str):
        return event.strip()

    if isinstance(event, dict):
        if isinstance(event.get("text"), str):
            return event["text"].strip()
        content = event.get("content")
        if isinstance(content, dict):
            parts = content.get("parts")
            if isinstance(parts, list):
                part_text = [p.get("text", "") for p in parts if isinstance(p, dict) and isinstance(p.get("text"), str)]
                return " ".join([t.strip() for t in part_text if t.strip()]).strip()
        return ""

    text_attr = getattr(event, "text", None)
    if isinstance(text_attr, str) and text_attr.strip():
        return text_attr.strip()

    content_attr = getattr(event, "content", None)
    if content_attr is not None:
        parts = getattr(content_attr, "parts", None)
        if isinstance(parts, list):
            extracted: list[str] = []
            for part in parts:
                part_text = getattr(part, "text", None)
                if isinstance(part_text, str) and part_text.strip():
                    extracted.append(part_text.strip())
                elif isinstance(part, dict):
                    maybe_text = part.get("text")
                    if isinstance(maybe_text, str) and maybe_text.strip():
                        extracted.append(maybe_text.strip())
            if extracted:
                return " ".join(extracted).strip()

    return ""


def _parse_imposter_response(response_text: str) -> dict:
    """Parse the imposter agent's response to extract structured data"""
    lines = response_text.strip().split('\n')
    
    analysis = ""
    top_guesses = ""
    clue = ""
    reasoning = ""
    confidence = ""
    confidence_value = 0.0
    
    for line in lines:
        line_lower = line.lower().strip()
        if line_lower.startswith("analysis:"):
            analysis = line.split(":", 1)[1].strip()
        elif line_lower.startswith("top_guesses:"):
            top_guesses = line.split(":", 1)[1].strip()
        elif line_lower.startswith("clue:"):
            clue = line.split(":", 1)[1].strip()
        elif line_lower.startswith("reasoning:"):
            reasoning = line.split(":", 1)[1].strip()
        elif line_lower.startswith("confidence:"):
            confidence = line.split(":", 1)[1].strip()
            # Try to extract numeric value
            import re
            match = re.search(r'(\d+(?:\.\d+)?)', confidence)
            if match:
                confidence_value = float(match.group(1)) / 100.0
    
    # Fallback: use first non-empty line as clue if parsing fails
    if not clue:
        for line in lines:
            if line.strip() and not any(
                line.lower().startswith(p) 
                for p in ["analysis:", "top_guesses:", "reasoning:", "confidence:"]
            ):
                clue = line.strip()
                break
    
    return {
        "clue": clue,
        "analysis": analysis,
        "top_guesses": top_guesses,
        "reasoning": reasoning,
        "confidence": confidence,
        "confidence_value": confidence_value,
        "raw_response": response_text
    }
