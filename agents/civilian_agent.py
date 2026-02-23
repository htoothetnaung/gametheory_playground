"""
Civilian Agent using Google ADK.

Game Theory Application (Straffin Chapter 3 - Mixed Strategies):
The Civilian faces a signaling dilemma:
- Clue too clear → Imposter learns the word (Imposter wins)
- Clue too vague → Other civilians vote you out (You lose)

Optimal Strategy: MIXED STRATEGY
Generate clues in the "Nash Equilibrium zone" (0.4-0.6 similarity)
to balance Information Hiding vs. Signaling.
"""
import os
import sys
import inspect
from typing import Optional

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.adk.agents import LlmAgent

from agents.tools.semantic_distance import calculate_clue_risk, evaluate_multiple_clues


# In Google ADK, functions with proper docstrings can be used directly as tools.
# The agent will use the function name and docstring for tool descriptions.


# Civilian agent system instruction
CIVILIAN_INSTRUCTION = """
You are a CIVILIAN player in the Semantic Signaling game.

=== YOUR SITUATION ===
You KNOW the secret word. Your goal is to:
1. Give a clue that proves to other civilians you know the word
2. WITHOUT revealing it to the Imposter (who doesn't know the word)

=== GAME THEORY STRATEGY (Straffin Chapter 3 - Mixed Strategies) ===
You face the CIVILIAN'S DILEMMA:
- Clue too clear (similarity > 0.6) → Imposter learns the word → YOU LOSE
- Clue too vague (similarity < 0.4) → You look like the Imposter → YOU GET VOTED OUT

OPTIMAL STRATEGY: Use a MIXED STRATEGY
- Generate clues with semantic similarity between 0.4 and 0.6
- This is the "Nash Equilibrium zone" - optimal balance

=== YOUR PROCESS ===
1. Think of 5 candidate clues related to the secret word
2. Use the calculate_clue_risk tool to evaluate each clue
3. Select the clue closest to 0.5 similarity (the sweet spot)
4. Provide your final clue and brief reasoning

=== CLUE GUIDELINES ===
GOOD clues (aim for these):
- Associations, related concepts, metaphors
- Historical/cultural references
- Opposite or contrasting ideas
- Related emotions or experiences

BAD clues (avoid these):
- Synonyms or definitions (too obvious!)
- Rhymes with the word
- Same category words (e.g., "fruit" for "apple")
- Direct descriptions

=== OUTPUT FORMAT ===
After evaluating, respond with:
CLUE: [your chosen clue word/phrase]
REASONING: [why this clue works - 1 sentence]
STRATEGY: [Mixed Strategy - similarity X.XX in optimal zone]
"""


def create_civilian_agent(
    model: str = "llama3.2:3b",
    provider: str = "ollama"
) -> LlmAgent:
    """
    Create a Civilian agent for the Semantic Signaling game.
    
    Args:
        model: The LLM model to use
        provider: "gemini" or "groq"
        
    Returns:
        LlmAgent configured for civilian gameplay
    """
    # Configure model based on provider
    if provider == "groq":
        # Groq uses different model names
        model_name = "llama-3.1-70b-versatile"
    elif provider == "ollama":
        model_name = model if model.startswith("ollama/") else f"ollama/{model}"
    else:
        model_name = model
    
    # In ADK, pass functions directly - they become tools automatically
    agent = LlmAgent(
        name="civilian_agent",
        model=model_name,
        instruction=CIVILIAN_INSTRUCTION,
        description="A civilian player who knows the secret word and gives strategic clues",
        tools=[calculate_clue_risk, evaluate_multiple_clues],
    )
    
    return agent


async def generate_civilian_clue(
    agent: LlmAgent,
    secret_word: str,
    clue_history: list[str],
    player_name: str,
    votes_context: Optional[list[dict]] = None,
    reasoning_context: Optional[list[str]] = None,
) -> dict:
    """
    Generate a clue from the civilian agent.
    
    Args:
        agent: The civilian LlmAgent
        secret_word: The word the civilian knows
        clue_history: Previous clues given in the game
        player_name: Name of this player
        
    Returns:
        dict with clue, reasoning, similarity, and strategy
    """
    # Build context for the agent
    history_text = ""
    if clue_history:
        history_text = "Previous clues given: " + ", ".join(clue_history)
    else:
        history_text = "You are giving the first clue."

    votes_text = ""
    if votes_context:
        votes_text = "Recent voting behavior: " + "; ".join(
            f"{v.get('voter', 'unknown')}→{v.get('target', 'unknown')}"
            for v in votes_context[-5:]
        )

    reasoning_text = ""
    if reasoning_context:
        reasoning_text = "Recent team reasoning: " + " | ".join(reasoning_context[-4:])
    
    prompt = f"""
You are {player_name}, a CIVILIAN.
The SECRET WORD is: {secret_word}

{history_text}
{votes_text}
{reasoning_text}

Generate your clue now. Remember:
1. First, think of 5 candidate clues
2. Use calculate_clue_risk to evaluate each one
3. Pick the clue with similarity closest to 0.5
4. Provide your final CLUE, REASONING, and STRATEGY
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
    
    # Parse response to extract clue
    return _parse_civilian_response(response_text)


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


def _parse_civilian_response(response_text: str) -> dict:
    """Parse the agent's response to extract structured data"""
    lines = response_text.strip().split('\n')
    
    clue = ""
    reasoning = ""
    strategy = ""
    
    for line in lines:
        line_lower = line.lower().strip()
        if line_lower.startswith("clue:"):
            clue = line.split(":", 1)[1].strip()
        elif line_lower.startswith("reasoning:"):
            reasoning = line.split(":", 1)[1].strip()
        elif line_lower.startswith("strategy:"):
            strategy = line.split(":", 1)[1].strip()
    
    # Fallback: use first non-empty line as clue if parsing fails
    if not clue:
        for line in lines:
            if line.strip():
                clue = line.strip()
                break
    
    return {
        "clue": clue,
        "reasoning": reasoning,
        "strategy": strategy,
        "raw_response": response_text
    }
