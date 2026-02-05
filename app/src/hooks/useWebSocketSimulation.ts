import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { Clue, AgentInternal, ImposterKnowledge } from '@/types';

// Word database for semantic clues
const WORD_DATABASE: Record<string, string[]> = {
  'COFFEE': ['caffeine', 'morning', 'bean', 'brew', 'aroma', 'espresso', 'roast', 'mug', 'starbucks', 'dark'],
  'OCEAN': ['wave', 'blue', 'deep', 'salt', 'beach', 'tide', 'marine', 'aquatic', 'sea', 'pacific'],
  'MOUNTAIN': ['peak', 'high', 'climb', 'snow', 'rock', 'summit', 'alpine', 'everest', 'hike', 'valley'],
  'GUITAR': ['string', 'music', 'play', 'rock', 'acoustic', 'fender', 'chord', 'band', 'solo', 'instrument'],
  'RAINBOW': ['color', 'sky', 'arc', 'prism', 'spectrum', 'weather', 'gold', 'iris', 'vivid', 'bridge'],
  'BUTTERFLY': ['wing', 'insect', 'flower', 'metamorphosis', 'caterpillar', 'colorful', 'flutter', 'garden', 'moth', 'delicate'],
  'TELESCOPE': ['star', 'space', 'observe', 'lens', 'astronomy', 'galaxy', 'planet', 'hubble', 'night', 'distant'],
  'PIZZA': ['cheese', 'italian', 'slice', 'pepperoni', 'dough', 'oven', 'crust', 'tomato', 'delivery', 'round'],
  'BICYCLE': ['wheel', 'pedal', 'ride', 'chain', 'helmet', 'exercise', 'transport', 'two', 'cycling', 'road'],
  'LIBRARY': ['book', 'quiet', 'read', 'shelf', 'knowledge', 'librarian', 'study', 'borrow', 'archive', 'building'],
  'THUNDER': ['storm', 'lightning', 'loud', 'rain', 'cloud', 'boom', 'electric', 'weather', 'sound', 'sky'],
  'DIAMOND': ['gem', 'ring', 'sparkle', 'hard', 'jewel', 'carat', 'wedding', 'crystal', 'expensive', 'forever'],
  'AIRPLANE': ['fly', 'wing', 'pilot', 'travel', 'sky', 'jet', 'airport', 'flight', 'engine', 'cloud'],
  'CHOCOLATE': ['sweet', 'cocoa', 'candy', 'dark', 'milk', 'dessert', 'belgian', 'bar', 'melting', 'treat'],
  'PYRAMID': ['egypt', 'triangle', 'pharaoh', 'ancient', 'tomb', 'giza', 'structure', 'sand', 'mummy', 'geometry'],
};

// Imposter thought patterns
const IMPOSTER_THOUGHTS = [
  "Analyzing semantic patterns in clues...",
  "Detecting common themes across statements",
  "Calculating word association probabilities",
  "Looking for semantic clustering",
  "Evaluating context coherence",
  "Building Bayesian probability model",
  "Cross-referencing with known word embeddings",
  "Identifying outlier clues for bluffing",
];

const IMPOSTER_STRATEGIES = [
  "Semantic Mimicry",
  "Contextual Bluffing",
  "Probability Maximization",
  "Topic Consistency",
  "Vague Association",
  "Pattern Matching",
  "Entropy Reduction",
  "Bayesian Updating",
];

// Calculate semantic distance (simulated cosine similarity)
function calculateSemanticDistance(clue: string, secretWord: string): number {
  const relatedWords = WORD_DATABASE[secretWord] || [];
  const clueLower = clue.toLowerCase();
  
  // Check for exact match or very close
  if (clueLower === secretWord.toLowerCase()) return 1;
  if (clueLower.includes(secretWord.toLowerCase())) return 0.95;
  
  // Check related words
  let maxSimilarity = 0;
  for (const word of relatedWords) {
    if (clueLower.includes(word)) {
      maxSimilarity = Math.max(maxSimilarity, 0.7 + Math.random() * 0.2);
    }
    // Word similarity based on length overlap
    const commonChars = [...clueLower].filter(c => word.includes(c)).length;
    const similarity = commonChars / Math.max(clueLower.length, word.length);
    if (similarity > 0.5) {
      maxSimilarity = Math.max(maxSimilarity, similarity * 0.5);
    }
  }
  
  // Add some randomness for realism
  return Math.min(1, maxSimilarity + Math.random() * 0.15);
}

function getRiskLevel(distance: number): 'safe' | 'moderate' | 'risky' | 'dangerous' {
  if (distance >= 0.85) return 'dangerous';
  if (distance >= 0.6) return 'risky';
  if (distance >= 0.35) return 'moderate';
  return 'safe';
}

function generateCivilianClue(secretWord: string): string {
  const relatedWords = WORD_DATABASE[secretWord] || [];
  // Pick a related word that's not too obvious
  const safeWords = relatedWords.filter((_, i) => i % 2 === 0);
  if (safeWords.length > 0) {
    return safeWords[Math.floor(Math.random() * safeWords.length)];
  }
  return relatedWords[0] || 'something';
}

function generateImposterClue(clues: Clue[]): string {
  if (clues.length === 0) {
    // First clue - very vague
    const vagueWords = ['thing', 'object', 'concept', 'idea', 'item'];
    return vagueWords[Math.floor(Math.random() * vagueWords.length)];
  }
  
  // Analyze previous clues for patterns
  const themes: Record<string, number> = {};
  clues.forEach(clue => {
    const words = clue.clue.toLowerCase().split(' ');
    words.forEach(word => {
      themes[word] = (themes[word] || 0) + 1;
    });
  });
  
  // Pick a common theme or go vague
  const sortedThemes = Object.entries(themes).sort((a, b) => b[1] - a[1]);
  if (sortedThemes.length > 0 && Math.random() > 0.3) {
    return sortedThemes[0][0];
  }
  
  // Vague association
  const vagueAssociations = ['related', 'similar', 'connected', 'associated'];
  return vagueAssociations[Math.floor(Math.random() * vagueAssociations.length)];
}

export function useWebSocketSimulation() {
  const {
    gameState,
    addClue,
    addAgentInternal,
    updateImposterKnowledge,
    setPlayerSpeaking,
    setConnected,
    isPaused,
  } = useGameStore();
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const simulateClue = useCallback(() => {
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    if (alivePlayers.length === 0) return;
    
    const currentPlayer = alivePlayers[gameState.currentPlayerIndex % alivePlayers.length];
    const isImposter = currentPlayer.role === 'imposter';
    
    // Set player as speaking
    setPlayerSpeaking(currentPlayer.id, true);
    
    setTimeout(() => {
      let clueText: string;
      
      if (isImposter) {
        clueText = generateImposterClue(gameState.clues);
      } else {
        clueText = generateCivilianClue(gameState.secretWord);
      }
      
      const semanticDistance = calculateSemanticDistance(clueText, gameState.secretWord);
      
      const clue: Clue = {
        id: `clue-${Date.now()}`,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        clue: clueText,
        timestamp: Date.now(),
        semanticDistance,
        riskLevel: getRiskLevel(semanticDistance),
      };
      
      addClue(clue);
      
      // Stop speaking
      setTimeout(() => {
        setPlayerSpeaking(currentPlayer.id, false);
      }, 1500);
      
      // If imposter gave clue, update their knowledge
      if (isImposter) {
        const thought = IMPOSTER_THOUGHTS[Math.floor(Math.random() * IMPOSTER_THOUGHTS.length)];
        const strategy = IMPOSTER_STRATEGIES[Math.floor(Math.random() * IMPOSTER_STRATEGIES.length)];
        
        const internal: AgentInternal = {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          role: 'imposter',
          thought: `${thought} Previous clues suggest the word might be related to "${clueText}". My bluff: "${clueText}" should fit the pattern.`,
          strategy,
          timestamp: Date.now(),
        };
        
        addAgentInternal(internal);
        
        // Update imposter knowledge
        const candidateWords = Object.keys(WORD_DATABASE)
          .map(word => ({
            word,
            probability: Math.random() * 0.5 + (word === gameState.secretWord ? 0.3 : 0),
          }))
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 5);
        
        const knowledge: ImposterKnowledge = {
          candidateWords,
          confidence: Math.min(1, gameState.clues.length * 0.1 + Math.random() * 0.2),
          topGuess: candidateWords[0]?.word || 'UNKNOWN',
          thoughtProcess: `Based on ${gameState.clues.length} clues, I'm ${(gameState.clues.length * 10).toFixed(0)}% confident the word is "${candidateWords[0]?.word}". The semantic clustering suggests...`,
        };
        
        updateImposterKnowledge(knowledge);
      } else {
        // Civilian internal thought
        const internal: AgentInternal = {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          role: 'civilian',
          thought: `The word is "${gameState.secretWord}". I'll say "${clueText}" - it's semantically related but won't give it away. Distance: ${(semanticDistance * 100).toFixed(0)}%`,
          strategy: semanticDistance > 0.6 ? 'Risky Signaling' : 'Safe Separation',
          timestamp: Date.now(),
        };
        
        addAgentInternal(internal);
      }
    }, 800);
  }, [gameState, addClue, addAgentInternal, updateImposterKnowledge, setPlayerSpeaking]);
  
  useEffect(() => {
    setConnected(true);
    
    intervalRef.current = setInterval(() => {
      if (isPaused) return;
      if (gameState.phase !== 'clue_giving') return;
      
      simulateClue();
    }, 4000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, gameState.phase, simulateClue, setConnected]);
  
  return { isConnected: true };
}
