"""SQLAlchemy persistence layer for game sessions, clues, and player analytics."""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)


class Base(DeclarativeBase):
    pass


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    winner: Mapped[str | None] = mapped_column(String(32), nullable=True)
    secret_word: Mapped[str] = mapped_column(String(128))
    imposter_id: Mapped[str] = mapped_column(String(128))
    num_players: Mapped[int] = mapped_column(Integer, default=0)

    clues: Mapped[list[ClueHistory]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )


class PlayerPerformance(Base):
    __tablename__ = "player_performance"

    player_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    games_won: Mapped[int] = mapped_column(Integer, default=0)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    avg_clue_quality: Mapped[float] = mapped_column(Float, default=0.0)
    role_preferences: Mapped[str] = mapped_column(String(32), default="mixed")
    civilian_wins: Mapped[int] = mapped_column(Integer, default=0)
    imposter_wins: Mapped[int] = mapped_column(Integer, default=0)


class ClueHistory(Base):
    __tablename__ = "clue_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clue_text: Mapped[str] = mapped_column(Text)
    semantic_distance: Mapped[float] = mapped_column(Float, default=0.0)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    game_id: Mapped[int] = mapped_column(ForeignKey("game_sessions.id"), index=True)
    player_id: Mapped[str] = mapped_column(String(128), index=True)
    player_name: Mapped[str] = mapped_column(String(128))
    risk_level: Mapped[str] = mapped_column(String(32), default="safe")
    round_number: Mapped[int] = mapped_column(Integer, default=1)

    game: Mapped[GameSession] = relationship(back_populates="clues")


class PhaseSnapshot(Base):
    __tablename__ = "phase_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("game_sessions.id"), index=True)
    phase: Mapped[str] = mapped_column(String(32), index=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DatabaseManager:
    def __init__(self):
        database_url = os.getenv("DATABASE_URL", "sqlite:///./semantic_signaling.db")
        connect_args = (
            {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        )
        self.engine = create_engine(
            database_url, future=True, pool_pre_ping=True, connect_args=connect_args
        )
        self.session_factory = sessionmaker(
            bind=self.engine, class_=Session, expire_on_commit=False
        )

    def init_db(self):
        Base.metadata.create_all(self.engine)

    def start_game_session(
        self, secret_word: str, imposter_id: str, num_players: int
    ) -> int:
        with self.session_factory() as session:
            row = GameSession(
                secret_word=secret_word,
                imposter_id=imposter_id,
                num_players=num_players,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return row.id

    def record_clue(
        self,
        game_id: int,
        player_id: str,
        player_name: str,
        clue_text: str,
        semantic_distance: float,
        risk_level: str,
        round_number: int,
    ):
        with self.session_factory() as session:
            session.add(
                ClueHistory(
                    game_id=game_id,
                    player_id=player_id,
                    player_name=player_name,
                    clue_text=clue_text,
                    semantic_distance=semantic_distance,
                    risk_level=risk_level,
                    round_number=round_number,
                )
            )
            session.commit()

    def record_phase_snapshot(
        self, game_id: int, phase: str, round_number: int, payload: dict[str, Any]
    ):
        with self.session_factory() as session:
            session.add(
                PhaseSnapshot(
                    game_id=game_id,
                    phase=phase,
                    round_number=round_number,
                    payload_json=json.dumps(payload),
                )
            )
            session.commit()

    def end_game_session(self, game_id: int, winner: str | None):
        with self.session_factory() as session:
            row = session.get(GameSession, game_id)
            if not row:
                return
            row.end_time = datetime.utcnow()
            row.winner = winner
            session.commit()

    def update_player_performance(
        self,
        players: list[dict[str, Any]],
        winner: str | None,
        clues: list[dict[str, Any]],
        imposter_id: str,
    ):
        # imposter_id may be comma-separated for multiple imposters
        imposter_id_set = set(imposter_id.split(",")) if imposter_id else set()

        with self.session_factory() as session:
            per_player_clues: dict[str, list[float]] = {}
            for clue in clues:
                per_player_clues.setdefault(clue.get("playerId", ""), []).append(
                    float(clue.get("semanticDistance", 0.0))
                )

            for player in players:
                pid = player.get("id", "")
                role = player.get("role", "civilian")
                perf = session.get(PlayerPerformance, pid)
                if perf is None:
                    perf = PlayerPerformance(player_id=pid)
                    session.add(perf)

                perf.games_played += 1

                is_imposter = pid in imposter_id_set
                won = (winner == "imposter" and is_imposter) or (
                    winner == "civilians" and not is_imposter
                )
                if won:
                    perf.games_won += 1
                    if role == "imposter":
                        perf.imposter_wins += 1
                    else:
                        perf.civilian_wins += 1

                clue_vals = per_player_clues.get(pid, [])
                if clue_vals:
                    player_avg = sum(clue_vals) / len(clue_vals)
                    if perf.avg_clue_quality <= 0:
                        perf.avg_clue_quality = player_avg
                    else:
                        perf.avg_clue_quality = (perf.avg_clue_quality * 0.7) + (
                            player_avg * 0.3
                        )

                perf.role_preferences = role

            session.commit()

    def get_player_stats(self) -> list[dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(PlayerPerformance)
                .order_by(PlayerPerformance.games_won.desc())
                .all()
            )
            stats = []
            for row in rows:
                win_rate = (
                    (row.games_won / row.games_played) if row.games_played else 0.0
                )
                stats.append(
                    {
                        "playerId": row.player_id,
                        "gamesWon": row.games_won,
                        "gamesPlayed": row.games_played,
                        "winRate": round(win_rate, 3),
                        "avgClueQuality": round(row.avg_clue_quality, 3),
                        "rolePreferences": row.role_preferences,
                        "civilianWins": row.civilian_wins,
                        "imposterWins": row.imposter_wins,
                    }
                )
            return stats

    def get_belief_convergence_rate(self) -> float:
        with self.session_factory() as session:
            rows = session.query(ClueHistory.semantic_distance).all()
            if len(rows) < 2:
                return 0.0
            values = [r[0] for r in rows]
            drift = sum(abs(values[i] - values[i - 1]) for i in range(1, len(values)))
            normalized = drift / max(len(values) - 1, 1)
            return round(max(0.0, 1.0 - normalized), 3)

    def get_strategy_effectiveness(self) -> dict[str, float]:
        with self.session_factory() as session:
            risky = (
                session.query(func.count(ClueHistory.id))
                .filter(ClueHistory.semantic_distance > 0.6)
                .scalar()
                or 0
            )
            safe = (
                session.query(func.count(ClueHistory.id))
                .filter(ClueHistory.semantic_distance <= 0.6)
                .scalar()
                or 0
            )
            total = max(risky + safe, 1)
            return {
                "safe": round(safe / total, 3),
                "risky": round(risky / total, 3),
            }


_db_manager: DatabaseManager | None = None


def get_database_manager() -> DatabaseManager:
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
        _db_manager.init_db()
    return _db_manager
