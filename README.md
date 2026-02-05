# Semantic Signaling Game: AI-Powered Imposter Detection

A multiplayer social deduction game powered by AI agents implementing advanced game theory concepts from Straffin's _Game Theory and Strategy_. Players give semantic clues to identify an imposter while AI agents use Bayesian reasoning and mixed strategies.

---

## 🎮 Game Theory Concepts

This project implements four core concepts from Straffin's textbook:

| Concept | Chapter | Implementation |
|---------|---------|----------------|
| **Mixed Strategies** | Ch. 3 | Civilians balance clue clarity (0.4-0.6 similarity = Nash Equilibrium zone) |
| **Information Sets** | Ch. 7 | Imposter has high entropy (all words possible), Civilians have low entropy (know secret word) |
| **Bayesian Games** | Ch. 10 | Imposter updates beliefs via P(word\|clue) ∝ P(clue\|word) × P(word) |
| **N-Person Coalitions** | Ch. 19/23 | Civilians form "Grand Coalition" to vote out imposter |

**Semantic Distance**: Uses cosine similarity between embeddings to quantify information leakage. Too high (>0.6) = imposter wins, too low (<0.4) = get voted out as suspicious.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                     │
│  • Theater Mode: 3D immersive view with Three.js            │
│  • God Mode: Admin dashboard with analytics                 │
│  • WebSocket client for real-time game state                │
└─────────────────────┬───────────────────────────────────────┘
                      │ ws://localhost:8000/ws
┌─────────────────────▼───────────────────────────────────────┐
│                 FastAPI Backend (Python)                     │
│  • WebSocket server for bidirectional communication         │
│  • REST API for game control and admin queries              │
│  • Game engine with phase transitions                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ Function calls
┌─────────────────────▼───────────────────────────────────────┐
│              Google ADK Multi-Agent System                   │
│  • Civilian Agent: Mixed-strategy clue generation           │
│  • Imposter Agent: Bayesian belief tracking + bluffing      │
│  • Orchestrator: Turn coordination and state management     │
│  • Tools: Semantic distance, Bayesian updater               │
└─────────────────────┬───────────────────────────────────────┘
                      │ Embeddings API
┌─────────────────────▼───────────────────────────────────────┐
│                  Embedding Services                          │
│  Primary: Ollama (nomic-embed-text) - Local, free           │
│  Fallback: OpenRouter (gte-base) - Cloud, free tier         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **Ollama** (for local embeddings): [Download here](https://ollama.ai)
- **API Keys** (choose one):
  - Google Gemini API (free tier): [Get key](https://ai.google.dev)
  - Groq API (free tier): [Get key](https://console.groq.com)


### Installation

#### 1️⃣ Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and add your GOOGLE_API_KEY or GROQ_API_KEY
```

#### 2️⃣ Frontend Setup
```bash
cd app

# Install dependencies
npm install

# Configure WebSocket URL (already set to ws://localhost:8000/ws)
```

#### 3️⃣ Start Ollama (Embeddings Service)
```bash
# Terminal 1: Start Ollama server
ollama serve

# Terminal 2: Pull embedding model
ollama pull nomic-embed-text
```

### Running the Game

Open **4 terminals**:

```bash
# Terminal 1: Ollama server
ollama serve

# Terminal 2: Backend server
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 3: Frontend dev server
cd app
npm run dev

# Terminal 4: Test backend (optional)
cd backend
python test_server.py
```

**Access the game**: http://localhost:5173

---

## 🎯 How to Play

1. **Enter the Game**: Click "Enter the Game" on the landing page
2. **Start Game**: Enter number of players (3-10), click "Initialize Game"
3. **Theater Mode**: Immersive 3D view as a player
4. **God Mode**: Admin view showing all agents' thoughts and beliefs
5. **Phases**:
   - **Clue Giving**: Players take turns giving semantic clues (AI agents auto-generate)
   - **Voting**: Vote to eliminate suspicious player
   - **Imposter Guess**: If imposter survives, they guess the secret word
   - **Game End**: Civilians win (imposter eliminated) or Imposter wins (guesses word or ≤2 players remain)

---

## 🔧 Configuration

Edit `backend/.env`:

```bash
# LLM Provider (choose one)
LLM_PROVIDER=gemini          # or "groq"
GOOGLE_API_KEY=your_key_here # if using gemini
GROQ_API_KEY=your_key_here   # if using groq

# Embedding Provider
EMBEDDING_PROVIDER=ollama     # or "openrouter"
OLLAMA_BASE_URL=http://localhost:11434
OPENROUTER_API_KEY=your_key  # if using openrouter
```

**LLM Models**:
- Gemini: `gemini-2.0-flash-exp` (default, fast, good reasoning)
- Groq: `llama-3.1-70b-versatile` (fast inference, strong performance)

**Embedding Models**:
- Ollama: `nomic-embed-text` (768d, local, fast)
- OpenRouter: `thenlper/gte-base` (free tier, cloud)

---

## 📊 API Endpoints

### WebSocket (`ws://localhost:8000/ws`)
**Events TO Client**:
- `game:init` - Initial game state
- `game:state` - State updates
- `clue:new` - New clue generated
- `agent:internal` - Agent thoughts (God mode)

**Events FROM Client**:
- `game:start` - Initialize game
- `game:pause` / `game:resume` - Control game flow
- `game:next_turn` - Advance to next player

### REST API
- `GET /` - Health check
- `GET /api/state` - Current game state
- `POST /api/game/start` - Start new game
- `GET /api/admin/imposter-beliefs` - Bayesian belief distribution
- `GET /api/admin/semantic-vectors` - 2D vector positions
- `GET /api/admin/game-metrics` - Nash equilibrium adherence

---

## 👥 Team Development Roadmap

Your team has **4 members** who can work on these parallel tracks:

### **Phase 2: Enhanced Agent Intelligence** (Teammate 1-2)
**Goal**: Make agents smarter with memory and strategic voting

**Tasks**:
1. **Conversation Memory**:
   - Implement context window in `agents/orchestrator.py`
   - Pass previous clues + votes to agent prompts
   - Track agent reasoning patterns over time
   
2. **Coalition Voting Logic** (Straffin Ch.19):
   - Create `agents/voter_agent.py` with tools:
     - `assess_clue_quality(clue, semantic_distance) → suspicion_score`
     - `player_suspicion_score(player_id, all_clues) → coalition_recommendation`
   - Replace random voting in `orchestrator.run_voting_phase()` with Shapley value calculations
   
3. **Adaptive Imposter Strategy**:
   - Implement entropy-based bluffing in `imposter_agent.py`
   - High entropy (early game) → safer clues
   - Low entropy (late game) → risky clues to deceive

**Game Theory**: Voting coalitions, Shapley values, information asymmetry dynamics

---

### **Phase 3: Observability & Analytics** (Teammate 3)
**Goal**: Visualize game theory concepts in real-time

**Tasks**:
1. **Semantic Vector Space Visualization**:
   - Connect `orchestrator.get_semantic_vectors()` to frontend
   - Implement PCA/t-SNE dimensionality reduction in `backend/embeddings.py`
   - Update `SemanticVectorSpace.tsx` to render scatter plot:
     - Red dot = secret word
     - Blue dots = civilian clues
     - Yellow dots = imposter clues
     - Show clustering patterns
   
2. **Bayesian Belief Dashboard**:
   - Create real-time belief distribution chart in `ImposterMonologue.tsx`
   - Show probability bars for top 5 candidate words
   - Animate entropy reduction after each clue
   
3. **Nash Equilibrium Metrics**:
   - Calculate % of clues in optimal zone (0.4-0.6 similarity)
   - Track information leakage per player
   - Display win rate by strategy (safe vs risky clues)

**Game Theory**: Nash equilibrium visualization, information theory (entropy), belief space geometry

---

### **Phase 4: Tournament Mode & Persistence** (Teammate 4)
**Goal**: Enable multi-game tournaments and historical analysis

**Tasks**:
1. **Database Integration**:
   - Add SQLAlchemy to `backend/requirements.txt`
   - Create `backend/database.py` with models:
     - `GameSession` (id, start_time, end_time, winner, secret_word)
     - `PlayerPerformance` (player_id, games_won, avg_clue_quality, role_preferences)
     - `ClueHistory` (clue_text, semantic_distance, timestamp, game_id)
   - Store game state after each phase
   
2. **Tournament System**:
   - Implement ELO rating system in `backend/tournament.py`
   - Round-robin scheduling for N players
   - Track win rates by role (civilian vs imposter)
   
3. **Historical Analytics**:
   - Add `/api/analytics/player-stats` endpoint
   - Calculate average belief convergence rate
   - Identify optimal clue strategies from past games

**Game Theory**: Repeated games, evolutionary stability, strategy learning

---

### **Phase 5: Advanced Research Features** (All team members)
**Goal**: Push game theory boundaries with novel mechanics

**Potential Research Directions**:

1. **Partial Observability Variants**:
   - Implement "Noisy Channel" mode (clues get distorted)
   - Add "Delayed Information" (clues revealed after 2 turns)
   - Test how noise affects Nash equilibrium convergence
   
2. **Multi-Imposter Scenarios**:
   - Extend to 2 imposters with different secret words
   - Study coalition formation dynamics (Straffin Ch.23)
   - Implement backstabbing detection
   
3. **LLM Strategy Comparison**:
   - Run A/B tests with different LLMs (GPT-4, Claude, Llama)
   - Measure which models find Nash equilibria faster
   - Analyze reasoning patterns in Bayesian updates
   
4. **Mechanism Design**:
   - Create incentive structures to prevent lying
   - Implement reputation systems
   - Test auction-based clue revealing

**Game Theory**: Mechanism design, auction theory, computational game theory, multi-agent learning

---

## 🐛 Troubleshooting

**Backend won't start**:
- Check Python version: `python --version` (need 3.11+)
- Activate venv: `venv\Scripts\activate`
- Install deps: `pip install -r requirements.txt`

**Ollama connection errors**:
- Verify Ollama running: http://localhost:11434
- Pull model: `ollama pull nomic-embed-text`
- Check logs: `ollama serve` should show "Listening on 127.0.0.1:11434"

**Frontend not connecting**:
- Check WebSocket URL in `app/.env`: `VITE_WS_URL=ws://localhost:8000/ws`
- Verify backend running: http://localhost:8000 should return `{"status":"ok"}`
- Check browser console for WebSocket errors

**Agent errors**:
- Verify API key in `backend/.env`
- Check quota limits on Google AI Studio / Groq console
- Try switching LLM_PROVIDER between `gemini` and `groq`

---

## 📚 Project Structure

```
├── backend/                  # Python FastAPI server
│   ├── main.py              # WebSocket + REST endpoints
│   ├── game_engine.py       # Core game loop
│   ├── models.py            # Pydantic data models
│   ├── embeddings.py        # Semantic distance service
│   ├── agents/              # Google ADK agents
│   │   ├── orchestrator.py  # Multi-agent coordinator
│   │   ├── civilian_agent.py # Mixed-strategy clue gen
│   │   ├── imposter_agent.py # Bayesian belief tracking
│   │   └── tools/           # ADK function tools
│   └── test_server.py       # Backend verification
│
├── app/                      # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx          # Main app with mode toggle
│   │   ├── components/      
│   │   │   ├── three/       # Three.js 3D components
│   │   │   ├── ui/          # shadcn/ui library
│   │   │   └── ui-custom/   # Game-specific UI
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts # Real-time connection
│   │   ├── store/
│   │   │   └── gameStore.ts # Zustand state management
│   │   └── types/
│   │       └── index.ts     # TypeScript definitions
│   └── package.json
│
└── README.md                 # You are here
```

---

## 🎓 Academic Context

This project was developed for **SEM8 Knowledge Engineering** as a practical implementation of game theory concepts. It demonstrates:
- **Mixed Strategy Nash Equilibria** in continuous action spaces (semantic similarity)
- **Bayesian Updating** in imperfect information games
- **Multi-agent Systems** with LLM-powered reasoning
- **Information Theory** applied to strategic communication

**Key Innovation**: Using embedding-based semantic similarity as a quantifiable measure of information leakage, creating a game where optimal play requires balancing clarity and deception in a mathematically precise way.

---

## 📄 License

MIT License - Free for academic and commercial use

---

## 🙏 Acknowledgments

- **Straffin, Philip D.** - _Game Theory and Strategy_ (theoretical foundation)
- **Google ADK Team** - Multi-agent orchestration framework
- **Ollama** - Local embedding models
- **shadcn/ui** - React component library

---

**Built with ❤️ for Game Theory & AI Research**

*For questions or collaboration, open an issue on GitHub*

