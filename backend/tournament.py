"""Tournament utilities: ELO rating, round-robin scheduling, and role win stats."""
from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import Any


@dataclass
class MatchResult:
    player_a: str
    player_b: str
    score_a: float
    score_b: float


class EloSystem:
    def __init__(self, k_factor: float = 32.0, base_rating: float = 1200.0):
        self.k_factor = k_factor
        self.base_rating = base_rating

    def expected_score(self, rating_a: float, rating_b: float) -> float:
        return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400))

    def update_ratings(self, rating_a: float, rating_b: float, score_a: float) -> tuple[float, float]:
        exp_a = self.expected_score(rating_a, rating_b)
        exp_b = self.expected_score(rating_b, rating_a)
        score_b = 1.0 - score_a

        new_a = rating_a + self.k_factor * (score_a - exp_a)
        new_b = rating_b + self.k_factor * (score_b - exp_b)
        return round(new_a, 2), round(new_b, 2)


class TournamentManager:
    def __init__(self):
        self.elo = EloSystem()

    def round_robin_schedule(self, players: list[str]) -> list[tuple[str, str]]:
        return [(a, b) for a, b in combinations(players, 2)]

    def simulate_ratings(self, players: list[str], match_results: list[MatchResult]) -> dict[str, float]:
        ratings = {player: self.elo.base_rating for player in players}
        for result in match_results:
            ra = ratings.get(result.player_a, self.elo.base_rating)
            rb = ratings.get(result.player_b, self.elo.base_rating)

            total = result.score_a + result.score_b
            score_a = (result.score_a / total) if total > 0 else 0.5
            new_a, new_b = self.elo.update_ratings(ra, rb, score_a)
            ratings[result.player_a] = new_a
            ratings[result.player_b] = new_b
        return ratings

    def role_win_rates(self, games: list[dict[str, Any]]) -> dict[str, float]:
        if not games:
            return {"civilian": 0.0, "imposter": 0.0}

        civilian_wins = sum(1 for g in games if g.get("winner") == "civilians")
        imposter_wins = sum(1 for g in games if g.get("winner") == "imposter")
        total = max(civilian_wins + imposter_wins, 1)
        return {
            "civilian": round(civilian_wins / total, 3),
            "imposter": round(imposter_wins / total, 3),
        }
