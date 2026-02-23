import { create } from 'zustand';
import type { Player, Clue, GameState, GamePhase, ViewMode, Vote, AgentInternal, ImposterKnowledge, SemanticVector, GameMetrics, SessionInfo, UserMode, ThemeMode } from '@/types';

interface GameStore {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  userMode: UserMode;
  setUserMode: (mode: UserMode) => void;
  participantPlayerId: string | null;
  setParticipantPlayerId: (playerId: string | null) => void;
  sessionInfo: SessionInfo | null;
  setSessionInfo: (session: SessionInfo | null) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  secretWordVisible: boolean;
  setSecretWordVisible: (visible: boolean) => void;
  toggleSecretWordVisible: () => void;
  secretWordDiscarded: boolean;
  setSecretWordDiscarded: (discarded: boolean) => void;
  discardSecretWord: () => void;
  secretWordCardCollapsed: boolean;
  setSecretWordCardCollapsed: (collapsed: boolean) => void;
  toggleSecretWordCardCollapsed: () => void;

  gameState: GameState;
  setGameState: (state: GameState) => void;
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

  semanticVectors: SemanticVector[];
  setSemanticVectors: (vectors: SemanticVector[]) => void;

  gameMetrics: GameMetrics;
  setGameMetrics: (metrics: Partial<GameMetrics>) => void;

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

const NUM_DEFAULT_PLAYERS = 6;

const generatePlayers = (imposterIndices: number[]): Player[] => {
  return PLAYER_NAMES.slice(0, NUM_DEFAULT_PLAYERS).map((name, i) => ({
    id: `player-${i}`,
    name: `Agent ${name}`,
    role: imposterIndices.includes(i) ? 'imposter' : 'civilian',
    isAlive: true,
    isSpeaking: false,
    position: i,
    color: PLAYER_COLORS[i],
    avatarSeed: name,
  }));
};

const createInitialGameState = (): GameState => {
  // Pick 2 random imposter indices
  const indices: number[] = [];
  while (indices.length < 2) {
    const idx = Math.floor(Math.random() * NUM_DEFAULT_PLAYERS);
    if (!indices.includes(idx)) indices.push(idx);
  }
  const secretWord = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];

  return {
    secretWord,
    imposterId: `player-${indices[0]}`,
    imposterIds: indices.map(i => `player-${i}`),
    phase: 'clue_giving',
    round: 1,
    currentPlayerIndex: 0,
    players: generatePlayers(indices),
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

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const saved = window.localStorage.getItem('themeMode');
  return saved === 'light' ? 'light' : 'dark';
};

export const useGameStore = create<GameStore>((set) => ({
  viewMode: 'theater',
  setViewMode: (mode) => set({ viewMode: mode }),

  userMode: 'observer',
  setUserMode: (mode) => set({ userMode: mode }),
  participantPlayerId: null,
  setParticipantPlayerId: (playerId) => set({ participantPlayerId: playerId }),
  sessionInfo: null,
  setSessionInfo: (session) => set({ sessionInfo: session }),

  themeMode: getInitialThemeMode(),
  setThemeMode: (mode) => set({ themeMode: mode }),

  secretWordVisible: true,
  setSecretWordVisible: (visible) => set({ secretWordVisible: visible }),
  toggleSecretWordVisible: () => set((state) => ({ secretWordVisible: !state.secretWordVisible })),
  secretWordDiscarded: false,
  setSecretWordDiscarded: (discarded) => set({ secretWordDiscarded: discarded }),
  discardSecretWord: () => set({ secretWordDiscarded: true, secretWordVisible: false }),
  secretWordCardCollapsed: false,
  setSecretWordCardCollapsed: (collapsed) => set({ secretWordCardCollapsed: collapsed }),
  toggleSecretWordCardCollapsed: () => set((state) => ({ secretWordCardCollapsed: !state.secretWordCardCollapsed })),

  gameState: createInitialGameState(),
  setGameState: (state) => set({ gameState: state }),
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
  resetGame: () => set({
    gameState: createInitialGameState(),
    agentInternals: [],
    semanticVectors: [],
    participantPlayerId: null,
    secretWordVisible: true,
    secretWordDiscarded: false,
    secretWordCardCollapsed: false,
    gameMetrics: {
      averageCivilianSimilarity: 0,
      totalClues: 0,
      optimalCluesCount: 0,
      optimalCluesRatio: 0,
      informationLeakage: false,
      coordinationFailure: false,
      imposterConfidence: 0,
      playerLeakage: {},
      strategyWinRate: {
        safe: 0,
        risky: 0,
      },
      entropyHistory: [],
    },
  }),

  isPaused: false,
  setPaused: (paused) => set({ isPaused: paused }),
  selectedPlayer: null,
  setSelectedPlayer: (playerId) => set({ selectedPlayer: playerId }),

  agentInternals: [],
  addAgentInternal: (internal) => set((state) => ({
    agentInternals: [...state.agentInternals.slice(-99), internal]
  })),

  semanticVectors: [],
  setSemanticVectors: (vectors) => set({ semanticVectors: vectors }),

  gameMetrics: {
    averageCivilianSimilarity: 0,
    totalClues: 0,
    optimalCluesCount: 0,
    optimalCluesRatio: 0,
    informationLeakage: false,
    coordinationFailure: false,
    imposterConfidence: 0,
    playerLeakage: {},
    strategyWinRate: {
      safe: 0,
      risky: 0,
    },
    entropyHistory: [],
  },
  setGameMetrics: (metrics) => set((state) => ({
    gameMetrics: { ...state.gameMetrics, ...metrics }
  })),

  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}));
