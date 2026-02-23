/**
 * Offline simulation engine for Semantic Signaling game.
 *
 * Generates clues, votes, and advances game state locally when
 * the backend WebSocket server is not available.
 */

import type { GameState, Clue, Vote, Player, AgentInternal } from '@/types';

// ── Word association pools for realistic offline clues ──────────────────

const WORD_ASSOCIATIONS: Record<string, string[]> = {
  COFFEE:    ['brew', 'beans', 'morning', 'espresso', 'caffeine', 'mug', 'roast', 'latte', 'aroma', 'grind'],
  OCEAN:     ['waves', 'salt', 'deep', 'blue', 'tide', 'coral', 'shore', 'current', 'marine', 'vast'],
  MOUNTAIN:  ['peak', 'climb', 'snow', 'summit', 'trail', 'rocky', 'altitude', 'ridge', 'steep', 'valley'],
  GUITAR:    ['strings', 'chord', 'acoustic', 'strum', 'fret', 'melody', 'pick', 'solo', 'amp', 'tune'],
  RAINBOW:   ['colors', 'arc', 'spectrum', 'rain', 'prism', 'vivid', 'sky', 'bright', 'band', 'hue'],
  BUTTERFLY: ['wings', 'flutter', 'nectar', 'cocoon', 'monarch', 'garden', 'delicate', 'pattern', 'spring', 'chrysalis'],
  TELESCOPE: ['stars', 'lens', 'observe', 'galaxy', 'zoom', 'night', 'optics', 'distant', 'scope', 'cosmos'],
  PIZZA:     ['cheese', 'crust', 'slice', 'oven', 'dough', 'topping', 'sauce', 'bake', 'hot', 'round'],
  BICYCLE:   ['pedal', 'wheel', 'ride', 'chain', 'gear', 'balance', 'spoke', 'frame', 'brake', 'cycle'],
  LIBRARY:   ['books', 'shelf', 'quiet', 'read', 'novel', 'catalog', 'study', 'pages', 'fiction', 'borrow'],
  THUNDER:   ['storm', 'bolt', 'rumble', 'loud', 'flash', 'crack', 'cloud', 'rain', 'boom', 'strike'],
  DIAMOND:   ['gem', 'sparkle', 'facet', 'ring', 'clarity', 'carat', 'precious', 'cut', 'brilliant', 'carbon'],
  AIRPLANE:  ['flight', 'wings', 'pilot', 'runway', 'altitude', 'jet', 'cockpit', 'travel', 'engine', 'soar'],
  CHOCOLATE: ['cocoa', 'sweet', 'dark', 'milk', 'truffle', 'rich', 'candy', 'melt', 'flavor', 'brown'],
  PYRAMID:   ['ancient', 'egypt', 'stone', 'pharaoh', 'tomb', 'desert', 'triangle', 'sphinx', 'sand', 'monument'],
};

// Generic fallback words for imposters or unknown secret words
const GENERIC_CLUES = [
  'familiar', 'common', 'everyday', 'classic', 'popular', 'regular',
  'typical', 'standard', 'normal', 'routine', 'usual', 'general',
  'nature', 'simple', 'basic', 'known', 'shared', 'traditional',
];

// ── Clue generation ────────────────────────────────────────────────────

/**
 * Generate a realistic offline clue for a player.
 */
export function generateOfflineClue(
  player: Player,
  secretWord: string,
  round: number,
  existingClues: Clue[],
): { clue: string; semanticDistance: number } {
  const isImposter = player.role === 'imposter';
  const usedWords = new Set(existingClues.map(c => c.clue.toLowerCase()));

  if (isImposter) {
    return generateImposterClue(existingClues, usedWords, round);
  }
  return generateCivilianClue(secretWord, usedWords, round);
}

function generateCivilianClue(
  secretWord: string,
  usedWords: Set<string>,
  _round: number,
): { clue: string; semanticDistance: number } {
  const pool = WORD_ASSOCIATIONS[secretWord.toUpperCase()] ?? [];
  const available = pool.filter(w => !usedWords.has(w.toLowerCase()));

  if (available.length > 0) {
    const word = available[Math.floor(Math.random() * Math.min(5, available.length))];
    // Simulate semantic distance in Nash equilibrium zone (0.4–0.6)
    const distance = 0.4 + Math.random() * 0.2;
    return { clue: word, semanticDistance: distance };
  }

  // Fallback: generic but slightly related
  const fallback = GENERIC_CLUES[Math.floor(Math.random() * GENERIC_CLUES.length)];
  return { clue: fallback, semanticDistance: 0.25 + Math.random() * 0.15 };
}

function generateImposterClue(
  _existingClues: Clue[],
  usedWords: Set<string>,
  _round: number,
): { clue: string; semanticDistance: number } {
  // Imposter tries to mimic the pattern of existing clues
  // In early rounds, use generic words. In later rounds, try to blend.
  const available = GENERIC_CLUES.filter(w => !usedWords.has(w.toLowerCase()));
  const word = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : 'thing';

  // Imposter clues tend to have more variable distances
  const distance = 0.2 + Math.random() * 0.5;
  return { clue: word, semanticDistance: distance };
}

// ── Risk classification ────────────────────────────────────────────────

function classifyRisk(distance: number): 'safe' | 'moderate' | 'risky' | 'dangerous' {
  if (distance >= 0.7) return 'dangerous';
  if (distance >= 0.6) return 'risky';
  if (distance >= 0.4) return 'moderate';
  return 'safe';
}

// ── Full turn simulation ───────────────────────────────────────────────

/**
 * Simulate one complete turn in the game.
 * Returns the updated game state, new clue, and optional agent internal thought.
 */
export function simulateOfflineTurn(state: GameState): {
  newState: GameState;
  clue: Clue | null;
  internal: AgentInternal | null;
} {
  if (state.phase !== 'clue_giving' || state.winner) {
    return { newState: state, clue: null, internal: null };
  }

  const alivePlayers = state.players.filter(p => p.isAlive);
  if (alivePlayers.length === 0) {
    return { newState: state, clue: null, internal: null };
  }

  const playerIndex = state.currentPlayerIndex % alivePlayers.length;
  const currentPlayer = alivePlayers[playerIndex];

  // Generate clue
  const { clue: clueWord, semanticDistance } = generateOfflineClue(
    currentPlayer,
    state.secretWord,
    state.round,
    state.clues,
  );

  const newClue: Clue = {
    id: `clue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    playerId: currentPlayer.id,
    playerName: currentPlayer.name,
    clue: clueWord,
    timestamp: Date.now(),
    semanticDistance,
    riskLevel: classifyRisk(semanticDistance),
  };

  // Agent internal thought
  const isImposter = (state.imposterIds || []).includes(currentPlayer.id);
  const internal: AgentInternal = {
    playerId: currentPlayer.id,
    playerName: currentPlayer.name,
    role: currentPlayer.role,
    thought: isImposter
      ? `Analyzing clues... guessing the word might be related to "${state.clues.slice(-1)[0]?.clue || 'unknown'}". Playing it safe with "${clueWord}".`
      : `The secret word is "${state.secretWord}". Giving clue "${clueWord}" with moderate specificity to stay in the Nash zone.`,
    strategy: isImposter ? 'bluffing' : 'signaling',
    timestamp: Date.now(),
  };

  // Advance state
  const nextIndex = (playerIndex + 1) % alivePlayers.length;
  const roundComplete = nextIndex === 0;

  const newState: GameState = {
    ...state,
    clues: [...state.clues, newClue],
    currentPlayerIndex: nextIndex,
    round: roundComplete ? state.round + 1 : state.round,
    players: state.players.map(p =>
      p.id === currentPlayer.id
        ? { ...p, isSpeaking: true }
        : { ...p, isSpeaking: false }
    ),
  };

  return { newState, clue: newClue, internal };
}

// ── Vote generation ────────────────────────────────────────────────────

/**
 * Generate offline votes for all alive players.
 * Returns votes and the ID of the player to eliminate.
 */
export function generateOfflineVotes(state: GameState): {
  votes: Vote[];
  eliminateId: string;
} {
  const alivePlayers = state.players.filter(p => p.isAlive);
  const imposterIds = new Set(state.imposterIds || []);
  const votes: Vote[] = [];
  const voteCounts: Record<string, number> = {};

  for (const voter of alivePlayers) {
    // Simple heuristic: civilians tend to vote for players with
    // outlier clue distances; imposters vote for random civilians
    const targets = alivePlayers.filter(p => p.id !== voter.id);
    let target: Player;

    if (imposterIds.has(voter.id)) {
      // Imposter votes for a random civilian
      const civilians = targets.filter(t => !imposterIds.has(t.id));
      target = civilians.length > 0
        ? civilians[Math.floor(Math.random() * civilians.length)]
        : targets[Math.floor(Math.random() * targets.length)];
    } else {
      // Civilian: calculate suspicion from clue distances
      const suspicion: { player: Player; score: number }[] = targets.map(t => {
        const playerClues = state.clues.filter(c => c.playerId === t.id);
        if (playerClues.length === 0) return { player: t, score: 0.5 };
        const avgDist = playerClues.reduce((s, c) => s + c.semanticDistance, 0) / playerClues.length;
        const deviation = Math.abs(avgDist - 0.5);
        return { player: t, score: deviation };
      });
      suspicion.sort((a, b) => b.score - a.score);
      // Pick the most suspicious with some randomness
      const topIdx = Math.min(Math.floor(Math.random() * 2), suspicion.length - 1);
      target = suspicion[topIdx].player;
    }

    votes.push({
      voterId: voter.id,
      targetId: target.id,
      reason: imposterIds.has(voter.id)
        ? 'Their clues seem suspicious to me.'
        : 'Clue pattern deviates from the expected Nash zone.',
    });
    voteCounts[target.id] = (voteCounts[target.id] || 0) + 1;
  }

  // Find player with most votes
  let maxVotes = 0;
  let eliminateId = alivePlayers[0]?.id || '';
  for (const [pid, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminateId = pid;
    }
  }

  return { votes, eliminateId };
}

// ── Win condition check ────────────────────────────────────────────────

/**
 * Check if the game has ended. Returns the updated state with winner set if applicable.
 */
export function checkWinConditions(state: GameState): GameState {
  const imposterIds = new Set(state.imposterIds || []);
  const aliveImposters = state.players.filter(p => p.isAlive && imposterIds.has(p.id));
  const aliveCivilians = state.players.filter(p => p.isAlive && !imposterIds.has(p.id));

  if (aliveImposters.length === 0) {
    return { ...state, winner: 'civilians', phase: 'ended' };
  }
  if (aliveCivilians.length <= aliveImposters.length) {
    return { ...state, winner: 'imposter', phase: 'ended' };
  }
  return state;
}

// ── Metrics computation ────────────────────────────────────────────────

/**
 * Compute game metrics from current state for the dashboard.
 */
export function computeOfflineMetrics(state: GameState) {
  const imposterIds = new Set(state.imposterIds || []);
  const civilianClues = state.clues.filter(c => !imposterIds.has(c.playerId));
  const avgSim = civilianClues.length > 0
    ? civilianClues.reduce((s, c) => s + c.semanticDistance, 0) / civilianClues.length
    : 0;
  const optimalClues = civilianClues.filter(c => c.semanticDistance >= 0.4 && c.semanticDistance <= 0.6);

  return {
    averageCivilianSimilarity: avgSim,
    totalClues: state.clues.length,
    optimalCluesCount: optimalClues.length,
    optimalCluesRatio: civilianClues.length > 0 ? optimalClues.length / civilianClues.length : 0,
    informationLeakage: avgSim > 0.6,
    coordinationFailure: avgSim < 0.4 && civilianClues.length > 0,
    imposterConfidence: state.imposterKnowledge.confidence,
    playerLeakage: {} as Record<string, number>,
    strategyWinRate: { safe: 0, risky: 0 },
    entropyHistory: [] as number[],
  };
}
