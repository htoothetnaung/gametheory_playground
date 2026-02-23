"""
Coalition Voting Tools for Semantic Signaling.

Implements suspicion scoring and Shapley-value-based coalition targeting
for the voting phase.
"""
from __future__ import annotations

import math
from itertools import combinations


def assess_clue_quality(clue: str, semantic_distance: float) -> float:
    """
    Convert a clue quality signal into suspicion score in [0, 1].

    Suspicion is low near the Nash zone center (0.5) and higher at extremes.
    """
    clue_len_penalty = 0.0
    stripped = clue.strip()
    if len(stripped) < 3:
        clue_len_penalty = 0.15
    elif len(stripped.split()) > 4:
        clue_len_penalty = 0.08

    zone_deviation = abs(semantic_distance - 0.5)
    suspicion = min(1.0, zone_deviation * 2.0 + clue_len_penalty)
    return round(max(0.0, suspicion), 4)


def player_suspicion_score(player_id: str, all_clues: list[dict]) -> dict:
    """
    Aggregate clue-level suspicion into player-level coalition recommendation.

    all_clues entries should include:
      - player_id (str)
      - clue (str)
      - semantic_distance (float)
      - risk_level (optional str)
    """
    player_clues = [c for c in all_clues if c.get("player_id") == player_id]
    if not player_clues:
        return {
            "player_id": player_id,
            "suspicion_score": 0.0,
            "coalition_recommendation": "insufficient_data",
            "samples": 0,
        }

    weighted_scores = []
    for clue in player_clues:
        base = assess_clue_quality(clue.get("clue", ""), float(clue.get("semantic_distance", 0.0)))
        risk = (clue.get("risk_level") or "").lower()
        if risk == "dangerous":
            base = min(1.0, base + 0.12)
        elif risk == "risky":
            base = min(1.0, base + 0.06)
        weighted_scores.append(base)

    suspicion = sum(weighted_scores) / len(weighted_scores)

    if suspicion >= 0.62:
        coalition = "strong_target"
    elif suspicion >= 0.45:
        coalition = "watchlist"
    else:
        coalition = "low_priority"

    return {
        "player_id": player_id,
        "suspicion_score": round(suspicion, 4),
        "coalition_recommendation": coalition,
        "samples": len(weighted_scores),
    }


def calculate_shapley_values(suspicion_scores: dict[str, float]) -> dict[str, float]:
    """
    Compute exact Shapley values from an n-person coalition value function.

    Value function:
      v(S) = sum_{i in S} s_i + alpha * |S| * mean(s_i)
    where alpha introduces coalition interaction.
    """
    players = list(suspicion_scores.keys())
    n = len(players)
    if n == 0:
        return {}
    if n == 1:
        return {players[0]: 1.0}

    alpha = 0.18
    factorial = math.factorial

    def coalition_value(subset: set[str]) -> float:
        if not subset:
            return 0.0
        score_sum = sum(suspicion_scores[p] for p in subset)
        mean_score = score_sum / len(subset)
        return score_sum + alpha * len(subset) * mean_score

    shapley = {p: 0.0 for p in players}
    player_set = set(players)

    for player in players:
        others = list(player_set - {player})
        for r in range(len(others) + 1):
            for subset_tuple in combinations(others, r):
                subset = set(subset_tuple)
                weight = (factorial(len(subset)) * factorial(n - len(subset) - 1)) / factorial(n)
                marginal = coalition_value(subset | {player}) - coalition_value(subset)
                shapley[player] += weight * marginal

    total = sum(shapley.values())
    if total <= 0:
        return {p: round(1.0 / n, 4) for p in players}

    return {p: round(max(0.0, v / total), 4) for p, v in shapley.items()}


def choose_vote_target(
    voter_id: str,
    alive_player_ids: list[str],
    shapley_values: dict[str, float],
    suspicion_scores: dict[str, float],
) -> str | None:
    """Deterministically select vote target using Shapley, then suspicion tie-break."""
    candidates = [p for p in alive_player_ids if p != voter_id]
    if not candidates:
        return None

    candidates.sort(
        key=lambda pid: (
            shapley_values.get(pid, 0.0),
            suspicion_scores.get(pid, 0.0),
            pid,
        ),
        reverse=True,
    )
    return candidates[0]
