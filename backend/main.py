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
import asyncio
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
from game_engine import GameEngine, GameEngineConfig, get_game_engine, reset_game_engine

# Load environment variables
load_dotenv()


# ============ WebSocket Connection Manager ============

class ConnectionManager:
    """Manages WebSocket connections for broadcasting game events"""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        print(f"Client disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, event_type: str, data: dict):
        """Broadcast event to all connected clients"""
        message = json.dumps({
            "type": event_type,
            "data": data
        })
        
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
        message = json.dumps({
            "type": event_type,
            "data": data
        })
        await websocket.send_text(message)


manager = ConnectionManager()


# ============ FastAPI App Setup ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🎮 Semantic Signaling Game Server starting...")
    print(f"   LLM Provider: {os.getenv('LLM_PROVIDER', 'gemini')}")
    print(f"   Embedding Provider: {os.getenv('EMBEDDING_PROVIDER', 'ollama')}")
    yield
    # Shutdown
    engine = get_game_engine()
    await engine.stop_game()
    print("🎮 Game Server stopped.")


app = FastAPI(
    title="Semantic Signaling Game API",
    description="Backend for the Game Theory-based Semantic Signaling game",
    version="1.0.0",
    lifespan=lifespan
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
    await manager.broadcast("game:state", state)


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
        on_state_change=on_state_change,
        on_agent_internal=on_agent_internal
    )
    
    # Send current state if game exists
    current_state = engine.get_state()
    if current_state:
        await manager.send_personal(websocket, "game:init", current_state)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            event_type = message.get("type", "")
            payload = message.get("data", {})
            
            try:
                if event_type == "game:start":
                    config = GameConfig(**payload) if payload else None
                    state = await engine.start_game(config)
                    await manager.send_personal(websocket, "game:init", state)
                    
                elif event_type == "game:pause":
                    await engine.pause()
                    
                elif event_type == "game:resume":
                    await engine.resume()
                    
                elif event_type == "game:reset":
                    config = GameConfig(**payload) if payload else None
                    state = await engine.reset(config)
                    await manager.send_personal(websocket, "game:init", state)
                    
                elif event_type == "game:next_turn":
                    clue = await engine.next_turn()
                    if clue:
                        await manager.broadcast("clue:new", clue)
                        
                elif event_type == "game:set_phase":
                    phase = payload.get("phase")
                    if phase:
                        await engine.set_phase(phase)
                        
                elif event_type == "game:eliminate":
                    player_id = payload.get("playerId")
                    if player_id:
                        await engine.eliminate_player(player_id)
                        
                else:
                    await manager.send_personal(
                        websocket, 
                        "error", 
                        {"message": f"Unknown event type: {event_type}"}
                    )
                    
            except Exception as e:
                await manager.send_personal(
                    websocket,
                    "error",
                    {"message": str(e)}
                )
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ============ REST API Endpoints ============

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "game": "Semantic Signaling",
        "version": "1.0.0"
    }


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
        on_state_change=on_state_change,
        on_agent_internal=on_agent_internal
    )
    state = await engine.start_game(config)
    return GameActionResponse(
        success=True,
        message="Game started",
        state=state
    )


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
    state = await engine.reset(config)
    return GameActionResponse(
        success=True,
        message="Game reset",
        state=state
    )


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
    vectors = engine.get_semantic_vectors()
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
    state = engine.get_state()
    
    if not state:
        return {"metrics": {}}
    
    clues = state.get("clues", [])
    
    # Calculate metrics
    civilian_similarities = [
        c["semanticDistance"] for c in clues
        if c.get("playerId") != state.get("imposterId")
    ]
    
    avg_similarity = (
        sum(civilian_similarities) / len(civilian_similarities)
        if civilian_similarities else 0
    )
    
    # Count clues in Nash Equilibrium zone (0.4-0.6)
    optimal_clues = sum(
        1 for s in civilian_similarities
        if 0.4 <= s <= 0.6
    )
    
    return {
        "metrics": {
            "averageCivilianSimilarity": round(avg_similarity, 3),
            "totalClues": len(clues),
            "optimalCluesCount": optimal_clues,
            "optimalCluesRatio": (
                round(optimal_clues / len(civilian_similarities), 2)
                if civilian_similarities else 0
            ),
            "informationLeakage": avg_similarity > 0.7,
            "coordinationFailure": avg_similarity < 0.2,
            "imposterConfidence": engine.get_imposter_beliefs().get("confidence", 0)
        }
    }


# ============ Configuration Endpoint ============

class EngineConfigUpdate(BaseModel):
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.0-flash"
    turn_delay_seconds: float = 2.0
    auto_run: bool = True
    max_rounds: int = 3


@app.post("/api/config")
async def update_config(config: EngineConfigUpdate):
    """Update game engine configuration (requires game restart)"""
    engine_config = GameEngineConfig(
        llm_provider=config.llm_provider,
        llm_model=config.llm_model,
        turn_delay_seconds=config.turn_delay_seconds,
        auto_run=config.auto_run,
        max_rounds=config.max_rounds
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
        "max_rounds": engine.config.max_rounds
    }


# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
