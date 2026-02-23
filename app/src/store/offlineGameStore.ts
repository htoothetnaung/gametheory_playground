import { create } from 'zustand';

export interface WordEntry {
  word: string;
  hint: string;
  category: string;
}

export type OfflineGamePhase =
  | 'name-entry'
  | 'ready-to-pick'   // Shows whose turn & "I'm ready" button
  | 'card-reveal'     // The card face-down, tap to flip
  | 'card-shown'      // Card is shown, player sees their role
  | 'all-revealed'    // Everyone has picked, summary screen
  ;

export interface OfflinePlayer {
  id: number;
  name: string;
  role: 'civilian' | 'imposter' | null;
  word: string | null;
  hint: string | null;
  hasPicked: boolean;
  emoji: string;
  color: string;
}

interface OfflineGameStore {
  phase: OfflineGamePhase;
  players: OfflinePlayer[];
  pickOrder: number[];          // randomized indices into players[]
  currentPickIndex: number;     // which position in pickOrder we're at
  currentWord: WordEntry | null;
  totalPlayers: number;

  // Actions
  setTotalPlayers: (count: number) => void;
  setPlayerNames: (names: string[]) => void;
  startGame: () => void;
  readyToPick: () => void;       // Player confirms "I'm ready" → show face-down card
  flipCard: () => void;          // Tap to reveal
  confirmAndPass: () => void;    // Hide card, move to next player
  resetGame: () => void;
  backToNameEntry: () => void;
}

const WORD_BANK: WordEntry[] = [
  { word: 'Car', hint: 'Transportation', category: 'Vehicles' },
  { word: 'Pizza', hint: 'Italian food', category: 'Food' },
  { word: 'Guitar', hint: 'Musical instrument', category: 'Music' },
  { word: 'Ocean', hint: 'Large body of water', category: 'Nature' },
  { word: 'Basketball', hint: 'Team sport with a ball', category: 'Sports' },
  { word: 'Laptop', hint: 'Electronic device', category: 'Technology' },
  { word: 'Sunflower', hint: 'A type of plant', category: 'Nature' },
  { word: 'Diamond', hint: 'Precious stone', category: 'Gems' },
  { word: 'Airplane', hint: 'Flies in the sky', category: 'Vehicles' },
  { word: 'Chocolate', hint: 'Sweet treat', category: 'Food' },
  { word: 'Camera', hint: 'Captures moments', category: 'Technology' },
  { word: 'Bicycle', hint: 'Two-wheeled ride', category: 'Vehicles' },
  { word: 'Library', hint: 'Place for reading', category: 'Places' },
  { word: 'Volcano', hint: 'Geological formation', category: 'Nature' },
  { word: 'Sushi', hint: 'Japanese cuisine', category: 'Food' },
  { word: 'Penguin', hint: 'Flightless bird', category: 'Animals' },
  { word: 'Telescope', hint: 'Used for stargazing', category: 'Science' },
  { word: 'Waterfall', hint: 'Flowing water feature', category: 'Nature' },
  { word: 'Skateboard', hint: 'Street activity gear', category: 'Sports' },
  { word: 'Lighthouse', hint: 'Coastal structure', category: 'Places' },
  { word: 'Espresso', hint: 'Hot beverage', category: 'Drinks' },
  { word: 'Helicopter', hint: 'Rotary aircraft', category: 'Vehicles' },
  { word: 'Kangaroo', hint: 'Australian animal', category: 'Animals' },
  { word: 'Pyramid', hint: 'Ancient structure', category: 'Places' },
  { word: 'Violin', hint: 'String instrument', category: 'Music' },
  { word: 'Meteor', hint: 'Space object', category: 'Science' },
  { word: 'Samurai', hint: 'Japanese warrior', category: 'History' },
  { word: 'Cactus', hint: 'Desert plant', category: 'Nature' },
  { word: 'Dolphin', hint: 'Marine mammal', category: 'Animals' },
  { word: 'Fireworks', hint: 'Night sky celebration', category: 'Events' },
];

const PLAYER_EMOJIS = ['🦊', '🐺', '🦁', '🐸', '🦉', '🐙', '🦅', '🐯', '🐨', '🦋', '🐬', '🦖'];
const PLAYER_COLORS = [
  '#FF3366', '#00CCFF', '#FFAA00', '#00FF88', '#AA00FF', '#FF6600',
  '#FF00CC', '#00FFD5', '#FF4444', '#44BBFF', '#AAFF00', '#FF8800',
];

const DEFAULT_TOTAL_PLAYERS = 6;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const useOfflineGameStore = create<OfflineGameStore>((set, get) => ({
  phase: 'name-entry',
  players: [],
  pickOrder: [],
  currentPickIndex: 0,
  currentWord: null,
  totalPlayers: DEFAULT_TOTAL_PLAYERS,

  setTotalPlayers: (count: number) => {
    const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, count));
    set({ totalPlayers: clamped });
  },

  setPlayerNames: (names: string[]) => {
    const players: OfflinePlayer[] = names.map((name, i) => ({
      id: i,
      name,
      role: null,
      word: null,
      hint: null,
      hasPicked: false,
      emoji: PLAYER_EMOJIS[i % PLAYER_EMOJIS.length],
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    }));
    set({ players });
  },

  startGame: () => {
    const { players } = get();
    const wordEntry = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const imposterIdx = Math.floor(Math.random() * players.length);

    // Assign roles
    const assignedPlayers = players.map((p, i) => ({
      ...p,
      role: (i === imposterIdx ? 'imposter' : 'civilian') as 'civilian' | 'imposter',
      word: i === imposterIdx ? null : wordEntry.word,
      hint: i === imposterIdx ? wordEntry.hint : null,
      hasPicked: false,
    }));

    // Random pick order
    const indices = assignedPlayers.map((_, i) => i);
    const pickOrder = shuffleArray(indices);

    set({
      players: assignedPlayers,
      currentWord: wordEntry,
      pickOrder,
      currentPickIndex: 0,
      phase: 'ready-to-pick',
    });
  },

  readyToPick: () => {
    set({ phase: 'card-reveal' });
  },

  flipCard: () => {
    set({ phase: 'card-shown' });
  },

  confirmAndPass: () => {
    const { players, pickOrder, currentPickIndex } = get();
    const playerIdx = pickOrder[currentPickIndex];

    // Mark this player as having picked
    const updated = players.map((p, i) =>
      i === playerIdx ? { ...p, hasPicked: true } : p
    );

    const nextPickIndex = currentPickIndex + 1;
    if (nextPickIndex >= pickOrder.length) {
      // All players have picked
      set({ players: updated, phase: 'all-revealed' });
    } else {
      set({
        players: updated,
        currentPickIndex: nextPickIndex,
        phase: 'ready-to-pick',
      });
    }
  },

  resetGame: () => {
    const { players } = get();
    // Keep names, reset everything else
    const resetPlayers = players.map((p) => ({
      ...p,
      role: null as 'civilian' | 'imposter' | null,
      word: null as string | null,
      hint: null as string | null,
      hasPicked: false,
    }));
    set({
      players: resetPlayers,
      pickOrder: [],
      currentPickIndex: 0,
      currentWord: null,
      phase: 'name-entry',
    });
  },

  backToNameEntry: () => {
    set({
      phase: 'name-entry',
      players: [],
      pickOrder: [],
      currentPickIndex: 0,
      currentWord: null,
      totalPlayers: DEFAULT_TOTAL_PLAYERS,
    });
  },
}));
