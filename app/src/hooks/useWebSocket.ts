import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { Clue, AgentInternal, ImposterKnowledge, GameState, Player } from '@/types';

/**
 * WebSocket hook for connecting to the backend game server.
 * 
 * Replaces the simulation hook with real WebSocket connection.
 * Maintains the same interface so components don't need changes.
 */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

type WSMessage = {
  type: string;
  data: unknown;
};

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnectedState] = useState(false);
  
  const {
    setConnected,
    setPhase,
    setCurrentPlayer,
    setPlayerSpeaking,
    addClue,
    addVote,
    eliminatePlayer,
    updateImposterKnowledge,
    setWinner,
    resetGame,
    addAgentInternal,
  } = useGameStore();
  
  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      const { type, data } = message;
      
      switch (type) {
        case 'game:init':
        case 'game:state': {
          // Full state update
          const state = data as GameState;
          
          // Update phase
          if (state.phase) {
            setPhase(state.phase);
          }
          
          // Update current player
          if (typeof state.currentPlayerIndex === 'number') {
            setCurrentPlayer(state.currentPlayerIndex);
          }
          
          // Update imposter knowledge
          if (state.imposterKnowledge) {
            updateImposterKnowledge(state.imposterKnowledge);
          }
          
          // Update winner
          if (state.winner) {
            setWinner(state.winner);
          }
          
          // Update player speaking states
          state.players?.forEach((player: Player) => {
            setPlayerSpeaking(player.id, player.isSpeaking);
          });
          
          // Sync clues - add any new ones
          const store = useGameStore.getState();
          const existingClueIds = new Set(store.gameState.clues.map(c => c.id));
          state.clues?.forEach((clue: Clue) => {
            if (!existingClueIds.has(clue.id)) {
              addClue(clue);
            }
          });
          
          break;
        }
        
        case 'clue:new': {
          // Single new clue
          const clue = data as Clue;
          addClue(clue);
          break;
        }
        
        case 'agent:internal': {
          // Agent internal thoughts
          const internal = data as AgentInternal;
          addAgentInternal(internal);
          break;
        }
        
        case 'vote:new': {
          // New vote cast
          const vote = data as { voterId: string; targetId: string; reason?: string };
          addVote(vote);
          break;
        }
        
        case 'player:eliminated': {
          // Player eliminated
          const { playerId } = data as { playerId: string };
          eliminatePlayer(playerId);
          break;
        }
        
        case 'player:speaking': {
          // Player speaking state change
          const { playerId, isSpeaking } = data as { playerId: string; isSpeaking: boolean };
          setPlayerSpeaking(playerId, isSpeaking);
          break;
        }
        
        case 'game:ended': {
          // Game ended
          const { winner } = data as { winner: 'civilians' | 'imposter' };
          setWinner(winner);
          break;
        }
        
        case 'error': {
          // Error from server
          console.error('Server error:', (data as { message: string }).message);
          break;
        }
        
        default:
          console.log('Unknown message type:', type, data);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, [
    setPhase,
    setCurrentPlayer,
    setPlayerSpeaking,
    addClue,
    addVote,
    eliminatePlayer,
    updateImposterKnowledge,
    setWinner,
    addAgentInternal,
  ]);
  
  // Send message to server
  const send = useCallback((type: string, data: unknown = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket not connected, cannot send:', type);
    }
  }, []);
  
  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    console.log('Connecting to WebSocket:', WS_URL);
    
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setIsConnectedState(true);
      };
      
      ws.onmessage = handleMessage;
      
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setIsConnectedState(false);
        
        // Attempt reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting reconnect...');
          connect();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [handleMessage, setConnected]);
  
  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
    setIsConnectedState(false);
  }, [setConnected]);
  
  // Game control methods
  const startGame = useCallback((numPlayers?: number) => {
    send('game:start', numPlayers ? { num_players: numPlayers } : {});
  }, [send]);
  
  const pauseGame = useCallback(() => {
    send('game:pause');
  }, [send]);
  
  const resumeGame = useCallback(() => {
    send('game:resume');
  }, [send]);
  
  const resetGameAction = useCallback((numPlayers?: number) => {
    resetGame();
    send('game:reset', numPlayers ? { num_players: numPlayers } : {});
  }, [send, resetGame]);
  
  const nextTurn = useCallback(() => {
    send('game:next_turn');
  }, [send]);
  
  const setGamePhase = useCallback((phase: string) => {
    send('game:set_phase', { phase });
  }, [send]);
  
  const eliminatePlayerAction = useCallback((playerId: string) => {
    send('game:eliminate', { playerId });
  }, [send]);
  
  // Connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    isConnected,
    send,
    connect,
    disconnect,
    startGame,
    pauseGame,
    resumeGame,
    resetGame: resetGameAction,
    nextTurn,
    setGamePhase,
    eliminatePlayer: eliminatePlayerAction,
  };
}

// Export alias for backwards compatibility
export { useWebSocket as useWebSocketSimulation };
