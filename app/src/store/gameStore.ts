import { create } from 'zustand';
import type { Player, Clue, GameState, GamePhase, ViewMode, Vote, AgentInternal, ImposterKnowledge } from '@/types';

interface GameStore {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  gameState: GameState;
  setPhase: (phase: GamePhase) => void;
  setCurrentPlayer: (index: number) => void;
  setPlayerSpeaking: (playerId: string, isSpeaking: boolean) => void;
  addClue: (clue: Clue) => void;
  addVote: (vote: Vote) => void;
  eliminatePlayer: (playerId: string) => void;
  updateImposterKnowledge: (knowledge: ImposterKnowledge) => void;
  setWinner: (winner: 'civilians' | 'imposter' | null) => void;
  resetGame: () => void;
  
  isPaused: boolean;
  setPaused: (paused: boolean) => void;
  selectedPlayer: string | null;
  setSelectedPlayer: (playerId: string | null) => void;
  
  agentInternals: AgentInternal[];
  addAgentInternal: (internal: AgentInternal) => void;
  
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
}

const SECRET_WORDS = [
  'COFFEE', 'OCEAN', 'MOUNTAIN', 'GUITAR', 'RAINBOW',
  'BUTTERFLY', 'TELESCOPE', 'PIZZA', 'BICYCLE', 'LIBRARY',
  'THUNDER', 'DIAMOND', 'AIRPLANE', 'CHOCOLATE', 'PYRAMID'
];

const PLAYER_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
// Vibrant, saturated colors for better visibility in Theater mode
const PLAYER_COLORS = [
  '#FF3366', // Hot Pink
  '#00FF88', // Neon Green  
  '#FFAA00', // Bright Orange
  '#00CCFF', // Cyan
  '#FF6600', // Orange
  '#AA00FF', // Purple
  '#FFFF00', // Yellow
  '#00FFCC', // Teal
  '#FF0066', // Magenta
  '#66FF00', // Lime
];

const generatePlayers = (imposterIndex: number): Player[] => {
  return PLAYER_NAMES.map((name, i) => ({
    id: `player-${i}`,
    name: `Agent ${name}`,
    role: i === imposterIndex ? 'imposter' : 'civilian',
    isAlive: true,
    isSpeaking: false,
    position: i,
    color: PLAYER_COLORS[i],
    avatarSeed: name,
  }));
};

const createInitialGameState = (): GameState => {
  const imposterIndex = Math.floor(Math.random() * 10);
  const secretWord = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];
  
  return {
    secretWord,
    imposterId: `player-${imposterIndex}`,
    phase: 'clue_giving',
    round: 1,
    currentPlayerIndex: 0,
    players: generatePlayers(imposterIndex),
    clues: [],
    votes: [],
    imposterKnowledge: {
      candidateWords: [],
      confidence: 0,
      topGuess: '',
      thoughtProcess: 'Analyzing the first clues...',
    },
    winner: null,
  };
};

export const useGameStore = create<GameStore>((set) => ({
  viewMode: 'theater',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  gameState: createInitialGameState(),
  setPhase: (phase) => set((state) => ({
    gameState: { ...state.gameState, phase }
  })),
  setCurrentPlayer: (index) => set((state) => ({
    gameState: { ...state.gameState, currentPlayerIndex: index }
  })),
  setPlayerSpeaking: (playerId, isSpeaking) => set((state) => ({
    gameState: {
      ...state.gameState,
      players: state.gameState.players.map(p => 
        p.id === playerId ? { ...p, isSpeaking } : { ...p, isSpeaking: false }
      )
    }
  })),
  addClue: (clue) => set((state) => ({
    gameState: {
      ...state.gameState,
      clues: [...state.gameState.clues, clue],
      currentPlayerIndex: (state.gameState.currentPlayerIndex + 1) % state.gameState.players.filter(p => p.isAlive).length,
    }
  })),
  addVote: (vote) => set((state) => ({
    gameState: {
      ...state.gameState,
      votes: [...state.gameState.votes, vote]
    }
  })),
  eliminatePlayer: (playerId) => set((state) => ({
    gameState: {
      ...state.gameState,
      players: state.gameState.players.map(p => 
        p.id === playerId ? { ...p, isAlive: false } : p
      )
    }
  })),
  updateImposterKnowledge: (knowledge) => set((state) => ({
    gameState: { ...state.gameState, imposterKnowledge: knowledge }
  })),
  setWinner: (winner) => set((state) => ({
    gameState: { ...state.gameState, winner }
  })),
  resetGame: () => set({ gameState: createInitialGameState() }),
  
  isPaused: false,
  setPaused: (paused) => set({ isPaused: paused }),
  selectedPlayer: null,
  setSelectedPlayer: (playerId) => set({ selectedPlayer: playerId }),
  
  agentInternals: [],
  addAgentInternal: (internal) => set((state) => ({
    agentInternals: [...state.agentInternals.slice(-99), internal]
  })),
  
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}));
