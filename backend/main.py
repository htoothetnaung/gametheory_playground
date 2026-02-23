"""
FastAPI Main Server for Semantic Signaling Game.

Provides:
- WebSocket endpoint for real-time game state updates
- REST endpoints for game control and admin dashboard data
- CORS support for frontend connection

Run with: uvicorn main:app --reload --port 8000
"""

import os
import sys
import json
from typing import Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Add paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import GameConfig, GameActionResponse
from game_engine import GameEngineConfig, get_game_engine, reset_game_engine
from tournament import TournamentManager, MatchResult

# Load environment variables
load_dotenv()


# ============ WebSocket Connection Manager ============


class ConnectionManager:
    """Manages WebSocket connections for broadcasting game events"""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.connection_sessions: dict[WebSocket, dict] = {}
        self.secret_word_ui_state = {
            "secretWordVisible": True,
            "secretWordDiscarded": False,
            "secretWordCardCollapsed": False,
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        self.connection_sessions[websocket] = {
            "clientId": f"client-{id(websocket)}",
            "mode": "observer",
            "participantPlayerId": None,
        }
        print(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.connection_sessions.pop(websocket, None)
        print(f"Client disconnected. Total: {len(self.active_connections)}")

    def get_session(self, websocket: WebSocket) -> dict:
        return self.connection_sessions.get(
            websocket,
            {
                "clientId": f"client-{id(websocket)}",
                "mode": "observer",
                "participantPlayerId": None,
            },
        )

    def update_session(self, websocket: WebSocket, **updates):
        session = self.get_session(websocket)
        session.update(updates)
        self.connection_sessions[websocket] = session

    def clear_participant_claims(self):
        for websocket in list(self.connection_sessions.keys()):
            session = self.get_session(websocket)
            session["participantPlayerId"] = None
            if session.get("mode") == "participant":
                session["mode"] = "observer"
            self.connection_sessions[websocket] = session

    def get_secret_word_ui_state(self) -> dict:
        return dict(self.secret_word_ui_state)

    def reset_secret_word_ui_state(self):
        self.secret_word_ui_state = {
            "secretWordVisible": True,
            "secretWordDiscarded": False,
            "secretWordCardCollapsed": False,
        }

    def update_secret_word_ui_state(self, **updates):
        self.secret_word_ui_state.update(updates)

    def is_slot_claimed(
        self, player_id: str, exclude_websocket: WebSocket | None = None
    ) -> bool:
        for websocket, session in self.connection_sessions.items():
            if exclude_websocket is not None and websocket == exclude_websocket:
                continue
            if (
                session.get("mode") == "participant"
                and session.get("participantPlayerId") == player_id
            ):
                return True
        return False

    async def broadcast(self, event_type: str, data: dict):
        """Broadcast event to all connected clients"""
        message = json.dumps({"type": event_type, "data": data})

        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.active_connections.discard(conn)

    async def send_personal(self, websocket: WebSocket, event_type: str, data: dict):
        """Send event to a specific client"""
        message = json.dumps({"type": event_type, "data": data})
        await websocket.send_text(message)


manager = ConnectionManager()


def _build_scoped_state(state: dict, session: dict) -> dict:
    """Return role-scoped state based on observer/participant/admin session mode."""
    mode = session.get("mode", "observer")
    participant_player_id = session.get("participantPlayerId")

    scoped = dict(state)
    players = [dict(player) for player in scoped.get("players", [])]

    participant_player = next(
        (p for p in players if p.get("id") == participant_player_id), None
    )
    participant_role = participant_player.get("role") if participant_player else None

    if mode == "admin":
        return scoped

    # Default redactions
    scoped["imposterId"] = ""
    scoped["secretWord"] = ""

    for player in players:
        if mode == "participant" and player.get("id") == participant_player_id:
            continue
        player["role"] = "civilian"
    scoped["players"] = players

    if (
        mode == "participant"
        and participant_player_id
        and participant_role == "civilian"
    ):
        scoped["secretWord"] = state.get("secretWord", "")

    return scoped


async def _broadcast_scoped_state(engine):
    state = engine.get_state()
    if not state:
        return

    disconnected = set()
    for connection in manager.active_connections:
        try:
            session = manager.get_session(connection)
            scoped_state = _build_scoped_state(state, session)
            await manager.send_personal(connection, "game:state", scoped_state)
            await manager.send_personal(connection, "session:info", session)
        except Exception:
            disconnected.add(connection)

    for connection in disconnected:
        manager.disconnect(connection)


async def _broadcast_admin_panels(engine):
    beliefs = engine.get_imposter_beliefs()
    metrics = engine.get_game_metrics()
    vectors = await engine.get_semantic_vectors()

    for connection in list(manager.active_connections):
        session = manager.get_session(connection)
        if session.get("mode") != "admin":
            continue
        try:
            await manager.send_personal(connection, "admin:beliefs", beliefs)
            await manager.send_personal(connection, "admin:metrics", metrics)
            await manager.send_personal(
                connection, "admin:vectors", {"vectors": vectors}
            )
        except Exception:
            manager.disconnect(connection)


async def _broadcast_secret_word_ui_state():
    await manager.broadcast(
        "admin:secret_word:state", manager.get_secret_word_ui_state()
    )


# ============ FastAPI App Setup ============


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    os.environ.setdefault("OLLAMA_API_BASE", ollama_base_url)

    # Startup
    print("🎮 Semantic Signaling Game Server starting...")
    print(f"   LLM Provider: {os.getenv('LLM_PROVIDER', 'ollama')}")
    print(f"   Embedding Provider: {os.getenv('EMBEDDING_PROVIDER', 'ollama')}")
    print(f"   Ollama Base URL: {ollama_base_url}")
    yield
    # Shutdown
    engine = get_game_engine()
    await engine.stop_game()
    print("🎮 Game Server stopped.")


app = FastAPI(
    title="Semantic Signaling Game API",
    description="Backend for the Game Theory-based Semantic Signaling game",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Game Engine Callbacks ============


async def on_state_change(state: dict):
    """Callback when game state changes - broadcast to all clients"""
    engine = get_game_engine()
    await _broadcast_scoped_state(engine)
    await _broadcast_admin_panels(engine)
    await _broadcast_secret_word_ui_state()


async def on_agent_internal(internal: dict):
    """Callback for agent internal thoughts - broadcast to all clients"""
    await manager.broadcast("agent:internal", internal)


# ============ WebSocket Endpoint ============


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time game updates.

    Events sent TO client:
    - game:state - Full game state update
    - game:init - Initial state on connect
    - agent:internal - Agent thought process
    - clue:new - New clue added
    - error - Error message

    Events received FROM client:
    - game:start - Start new game
    - game:pause - Pause game
    - game:resume - Resume game
    - game:reset - Reset game
    - game:next_turn - Manual next turn
    - game:set_phase - Set game phase
    - game:eliminate - Eliminate player
    """
    await manager.connect(websocket)

    # Get or create game engine
    engine = get_game_engine()
    engine.set_callbacks(
        on_state_change=on_state_change, on_agent_internal=on_agent_internal
    )

    # Send current state if game exists
    current_state = engine.get_state()
    if current_state:
        session = manager.get_session(websocket)
        await manager.send_personal(
            websocket, "game:init", _build_scoped_state(current_state, session)
        )
        await manager.send_personal(websocket, "session:info", session)
    await manager.send_personal(
        websocket, "admin:secret_word:state", manager.get_secret_word_ui_state()
    )

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)

            event_type = message.get("type", "")
            payload = message.get("data", {})

            def require_admin_session():
                session_info = manager.get_session(websocket)
                if session_info.get("mode") != "admin":
                    raise ValueError("Admin mode required for this action")

            try:
                if event_type == "game:start":
                    config = GameConfig(**payload) if payload else None
                    state = await engine.start_game(config)
                    manager.clear_participant_claims()
                    manager.reset_secret_word_ui_state()
                    await _broadcast_scoped_state(engine)
                    await _broadcast_admin_panels(engine)
                    await _broadcast_secret_word_ui_state()

                elif event_type == "session:set_mode":
                    mode = payload.get("mode", "observer")
                    if mode not in {"observer", "participant", "admin"}:
                        raise ValueError(
                            "Invalid mode. Use observer, participant, or admin."
                        )
                    if mode in {"observer", "admin"}:
                        manager.update_session(
                            websocket, mode=mode, participantPlayerId=None
                        )
                    else:
                        manager.update_session(websocket, mode=mode)
                    await manager.send_personal(
                        websocket, "session:info", manager.get_session(websocket)
                    )
                    await _broadcast_scoped_state(engine)
                    await _broadcast_admin_panels(engine)

                elif event_type == "player:claim_slot":
                    player_id = payload.get("playerId")
                    state = engine.get_state()
                    if not state:
                        raise ValueError("No active game")
                    player = next(
                        (
                            p
                            for p in state.get("players", [])
                            if p.get("id") == player_id
                        ),
                        None,
                    )
                    if not player:
                        raise ValueError("Player not found")
                    if not player.get("isAlive", True):
                        raise ValueError("Cannot claim eliminated player slot")
                    if manager.is_slot_claimed(player_id, exclude_websocket=websocket):
                        raise ValueError(
                            "Player slot is already claimed by another participant"
                        )
                    manager.update_session(
                        websocket, mode="participant", participantPlayerId=player_id
                    )
                    await manager.send_personal(
                        websocket, "session:info", manager.get_session(websocket)
                    )
                    await _broadcast_scoped_state(engine)

                elif event_type == "clue:submit":
                    player_id = payload.get("playerId")
                    clue_text = (payload.get("clue") or "").strip()
                    if not player_id or not clue_text:
                        raise ValueError("playerId and clue are required")
                    session = manager.get_session(websocket)
                    if (
                        session.get("mode") != "participant"
                        or session.get("participantPlayerId") != player_id
                    ):
                        raise ValueError(
                            "You can only submit clues for your claimed participant slot"
                        )
                    clue = await engine.submit_human_clue(
                        player_id=player_id, clue_text=clue_text
                    )
                    await _broadcast_scoped_state(engine)
                    await _broadcast_admin_panels(engine)
                    if clue:
                        await manager.broadcast("clue:new", clue)

                elif event_type == "vote:submit":
                    voter_id = payload.get("voterId")
                    target_id = payload.get("targetId")
                    reason = payload.get("reason")
                    if not voter_id or not target_id:
                        raise ValueError("voterId and targetId are required")
                    session = manager.get_session(websocket)
                    if (
                        session.get("mode") != "participant"
                        or session.get("participantPlayerId") != voter_id
                    ):
                        raise ValueError(
                            "You can only vote for your claimed participant slot"
                        )
                    vote = await engine.submit_human_vote(
                        voter_id=voter_id, target_id=target_id, reason=reason
                    )
                    await _broadcast_scoped_state(engine)
                    await _broadcast_admin_panels(engine)
                    if vote:
                        await manager.broadcast("vote:new", vote)

                elif event_type == "game:pause":
                    require_admin_session()
                    await engine.pause()

                elif event_type == "game:resume":
                    require_admin_session()
                    await engine.resume()

                elif event_type == "game:reset":
                    require_admin_session()
                    if payload and "num_players" in payload:
                        config = GameConfig(**payload)
                    else:
                        current_state = engine.get_state() or {}
                        current_count = (
                            len(current_state.get("players", []))
                            or GameConfig().num_players
                        )
                        config = GameConfig(num_players=current_count)
                    state = await engine.reset(config)
                    manager.clear_participant_claims()
                    manager.reset_secret_word_ui_state()
                    await _broadcast_scoped_state(engine)
                    await _broadcast_admin_panels(engine)
                    await _broadcast_secret_word_ui_state()

                elif event_type == "admin:secret_word:set_visible":
                    require_admin_session()
                    visible = bool(payload.get("visible", True))
                    manager.update_secret_word_ui_state(secretWordVisible=visible)
                    await _broadcast_secret_word_ui_state()

                elif event_type == "admin:secret_word:discard":
                    require_admin_session()
                    manager.update_secret_word_ui_state(
                        secretWordDiscarded=True, secretWordVisible=False
                    )
                    await _broadcast_secret_word_ui_state()

                elif event_type == "admin:secret_word:set_collapsed":
                    require_admin_session()
                    collapsed = bool(payload.get("collapsed", False))
                    manager.update_secret_word_ui_state(
                        secretWordCardCollapsed=collapsed
                    )
                    await _broadcast_secret_word_ui_state()

                elif event_type == "game:next_turn":
                    require_admin_session()
                    clue = await engine.next_turn()
                    await _broadcast_scoped_state(engine)
                    await _broadcast_admin_panels(engine)
                    if clue:
                        await manager.broadcast("clue:new", clue)

                elif event_type == "game:set_phase":
                    require_admin_session()
                    phase = payload.get("phase")
                    if phase:
                        await engine.set_phase(phase)

                elif event_type == "game:eliminate":
                    require_admin_session()
                    player_id = payload.get("playerId")
                    if player_id:
                        await engine.eliminate_player(player_id)

                else:
                    await manager.send_personal(
                        websocket,
                        "error",
                        {"message": f"Unknown event type: {event_type}"},
                    )

            except Exception as e:
                await manager.send_personal(websocket, "error", {"message": str(e)})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await _broadcast_scoped_state(engine)


# ============ REST API Endpoints ============


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "game": "Semantic Signaling", "version": "1.0.0"}


@app.get("/api/state")
async def get_game_state():
    """Get current game state"""
    engine = get_game_engine()
    state = engine.get_state()
    if state:
        return state
    raise HTTPException(status_code=404, detail="No active game")


@app.post("/api/game/start")
async def start_game(config: GameConfig = None):
    """Start a new game via REST"""
    engine = get_game_engine()
    engine.set_callbacks(
        on_state_change=on_state_change, on_agent_internal=on_agent_internal
    )
    state = await engine.start_game(config)
    manager.reset_secret_word_ui_state()
    return GameActionResponse(success=True, message="Game started", state=state)


@app.post("/api/game/pause")
async def pause_game():
    """Pause the game"""
    engine = get_game_engine()
    await engine.pause()
    return GameActionResponse(success=True, message="Game paused")


@app.post("/api/game/resume")
async def resume_game():
    """Resume the game"""
    engine = get_game_engine()
    await engine.resume()
    return GameActionResponse(success=True, message="Game resumed")


@app.post("/api/game/reset")
async def reset_game(config: GameConfig = None):
    """Reset and start a new game"""
    engine = get_game_engine()
    if config is None:
        current_state = engine.get_state() or {}
        current_count = (
            len(current_state.get("players", [])) or GameConfig().num_players
        )
        config = GameConfig(num_players=current_count)
    state = await engine.reset(config)
    manager.reset_secret_word_ui_state()
    return GameActionResponse(success=True, message="Game reset", state=state)


# ============ Admin Dashboard Endpoints ============


@app.get("/api/admin/semantic-vectors")
async def get_semantic_vectors():
    """
    Get semantic vector positions for admin dashboard visualization.

    Returns 2D positions for:
    - Secret word (red dot at origin)
    - Civilian clues (blue dots)
    - Imposter clues (yellow dots)

    Game Theory: Visualizes information leakage (clues too close to secret)
    vs coordination failure (clues too far).
    """
    engine = get_game_engine()
    vectors = await engine.get_semantic_vectors()
    return {"vectors": vectors}


@app.get("/api/admin/imposter-beliefs")
async def get_imposter_beliefs():
    """
    Get imposter's Bayesian belief distribution.

    Returns:
    - candidateWords: Top 5 words with probabilities
    - confidence: Overall confidence level (0-1)
    - topGuess: Current best guess
    - thoughtProcess: Last reasoning chain

    Game Theory (Straffin Ch.10): Shows Bayesian updating in action.
    """
    engine = get_game_engine()
    beliefs = engine.get_imposter_beliefs()
    return beliefs


@app.get("/api/admin/game-metrics")
async def get_game_metrics():
    """
    Get game theory metrics for analysis.

    Returns metrics like:
    - Average civilian clue similarity (information leakage)
    - Imposter confidence over time
    - Nash Equilibrium zone adherence
    """
    engine = get_game_engine()
    return {"metrics": engine.get_game_metrics()}


@app.get("/api/admin/secret-word-state")
async def get_secret_word_state():
    """Get shared secret-word UI state for admin/theater controls."""
    return manager.get_secret_word_ui_state()


@app.get("/api/analytics/player-stats")
async def get_player_stats():
    """Historical player analytics from persisted sessions."""
    engine = get_game_engine()
    players = engine.get_persistent_player_stats()
    civilian_total = sum(p.get("civilianWins", 0) for p in players)
    imposter_total = sum(p.get("imposterWins", 0) for p in players)
    role_total = max(civilian_total + imposter_total, 1)

    return {
        "players": players,
        "averageBeliefConvergenceRate": engine.get_belief_convergence_rate(),
        "strategyEffectiveness": engine.get_strategy_effectiveness(),
        "roleWinRates": {
            "civilian": round(civilian_total / role_total, 3),
            "imposter": round(imposter_total / role_total, 3),
        },
    }


class TournamentPayload(BaseModel):
    players: list[str]
    results: list[dict] = []


@app.post("/api/tournament/simulate")
async def simulate_tournament(payload: TournamentPayload):
    manager = TournamentManager()
    schedule = manager.round_robin_schedule(payload.players)

    parsed_results = [
        MatchResult(
            player_a=item.get("playerA", ""),
            player_b=item.get("playerB", ""),
            score_a=float(item.get("scoreA", 0.5)),
            score_b=float(item.get("scoreB", 0.5)),
        )
        for item in payload.results
    ]
    ratings = manager.simulate_ratings(payload.players, parsed_results)

    return {
        "schedule": [{"a": a, "b": b} for a, b in schedule],
        "ratings": ratings,
    }


# ============ Configuration Endpoint ============


class EngineConfigUpdate(BaseModel):
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.0-flash"
    turn_delay_seconds: float = 2.0
    auto_run: bool = True
    max_rounds: int = 2
    noisy_channel_mode: bool = False
    noisy_channel_probability: float = 0.0
    delayed_information_turns: int = 0


@app.post("/api/config")
async def update_config(config: EngineConfigUpdate):
    """Update game engine configuration (requires game restart)"""
    engine_config = GameEngineConfig(
        llm_provider=config.llm_provider,
        llm_model=config.llm_model,
        turn_delay_seconds=config.turn_delay_seconds,
        auto_run=config.auto_run,
        max_rounds=config.max_rounds,
        noisy_channel_mode=config.noisy_channel_mode,
        noisy_channel_probability=config.noisy_channel_probability,
        delayed_information_turns=config.delayed_information_turns,
    )
    reset_game_engine(engine_config)
    return {"success": True, "config": config.model_dump()}


@app.get("/api/config")
async def get_config():
    """Get current engine configuration"""
    engine = get_game_engine()
    return {
        "llm_provider": engine.config.llm_provider,
        "llm_model": engine.config.llm_model,
        "turn_delay_seconds": engine.config.turn_delay_seconds,
        "auto_run": engine.config.auto_run,
        "max_rounds": engine.config.max_rounds,
        "noisy_channel_mode": engine.config.noisy_channel_mode,
        "noisy_channel_probability": engine.config.noisy_channel_probability,
        "delayed_information_turns": engine.config.delayed_information_turns,
        "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    }


# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
