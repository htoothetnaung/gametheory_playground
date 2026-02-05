export type PlayerRole = 'civilian' | 'imposter';
export type GamePhase = 'clue_giving' | 'voting' | 'imposter_guess' | 'ended';
export type ViewMode = 'theater' | 'god';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  isAlive: boolean;
  isSpeaking: boolean;
  position: number;
  color: string;
  avatarSeed: string;
}

export interface Clue {
  id: string;
  playerId: string;
  playerName: string;
  clue: string;
  timestamp: number;
  semanticDistance: number;
  riskLevel: 'safe' | 'moderate' | 'risky' | 'dangerous';
}

export interface Vote {
  voterId: string;
  targetId: string;
  reason?: string;
}

export interface ImposterKnowledge {
  candidateWords: { word: string; probability: number }[];
  confidence: number;
  topGuess: string;
  thoughtProcess: string;
}

export interface GameState {
  secretWord: string;
  imposterId: string;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: Player[];
  clues: Clue[];
  votes: Vote[];
  imposterKnowledge: ImposterKnowledge;
  winner: 'civilians' | 'imposter' | null;
}

export interface SemanticVector {
  x: number;
  y: number;
  label: string;
  type: 'secret' | 'civilian_clue' | 'imposter_clue';
  distance?: number;
}

export interface AgentInternal {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  thought: string;
  strategy: string;
  timestamp: number;
}
