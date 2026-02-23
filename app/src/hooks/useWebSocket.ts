import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { AgentInternal, ImposterKnowledge, GameState, SemanticVector, GameMetrics, SessionInfo, UserMode, GamePhase } from '@/types';
import {
  simulateOfflineTurn,
  generateOfflineVotes,
  checkWinConditions,
  computeOfflineMetrics,
} from './offlineSimulation';

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
    setGameState,
    updateImposterKnowledge,
    addAgentInternal,
    setSemanticVectors,
    setGameMetrics,
    setSessionInfo,
    setUserMode,
    setParticipantPlayerId,
    setSecretWordVisible,
    setSecretWordDiscarded,
    setSecretWordCardCollapsed,
  } = useGameStore();

  const connectRef = useRef<() => void>(() => undefined);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      const { type, data } = message;

      switch (type) {
        case 'game:init':
        case 'game:state': {
          const state = data as GameState;
          setGameState(state);
          break;
        }

        case 'clue:new': {
          // Snapshot-first flow: game:state is authoritative for clue/vote state.
          break;
        }

        case 'agent:internal': {
          // Agent internal thoughts
          const internal = data as AgentInternal;
          addAgentInternal(internal);
          break;
        }

        case 'admin:vectors': {
          const payload = data as { vectors?: SemanticVector[] };
          setSemanticVectors(payload.vectors ?? []);
          break;
        }

        case 'admin:beliefs': {
          const beliefs = data as ImposterKnowledge;
          updateImposterKnowledge(beliefs);
          break;
        }

        case 'admin:metrics': {
          const metrics = data as GameMetrics;
          setGameMetrics(metrics);
          break;
        }

        case 'session:info': {
          const session = data as SessionInfo;
          setSessionInfo(session);
          setUserMode(session.mode);
          setParticipantPlayerId(session.participantPlayerId ?? null);
          break;
        }

        case 'admin:secret_word:state': {
          const wordState = data as {
            secretWordVisible?: boolean;
            secretWordDiscarded?: boolean;
            secretWordCardCollapsed?: boolean;
          };
          setSecretWordVisible(Boolean(wordState.secretWordVisible));
          setSecretWordDiscarded(Boolean(wordState.secretWordDiscarded));
          setSecretWordCardCollapsed(Boolean(wordState.secretWordCardCollapsed));
          break;
        }

        case 'vote:new': {
          // Snapshot-first flow: game:state is authoritative for clue/vote state.
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
    setGameState,
    updateImposterKnowledge,
    addAgentInternal,
    setSemanticVectors,
    setGameMetrics,
    setSessionInfo,
    setUserMode,
    setParticipantPlayerId,
    setSecretWordVisible,
    setSecretWordDiscarded,
    setSecretWordCardCollapsed,
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
          connectRef.current();
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

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('game:pause');
    }
    useGameStore.getState().setPaused(true);
  }, [send]);

  const resumeGame = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('game:resume');
    }
    useGameStore.getState().setPaused(false);
  }, [send]);

  const resetGameAction = useCallback((numPlayers?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fallbackPlayers = useGameStore.getState().gameState.players.length;
      const playersToUse = numPlayers ?? fallbackPlayers;
      send('game:reset', { num_players: playersToUse });
      useGameStore.getState().setViewMode('theater');
    } else {
      // Offline: reset locally
      useGameStore.getState().resetGame();
    }
  }, [send]);

  const nextTurn = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('game:next_turn');
    } else {
      // Offline: simulate locally
      const store = useGameStore.getState();
      const currentState = store.gameState;

      if (currentState.phase === 'clue_giving') {
        const { newState, internal } = simulateOfflineTurn(currentState);
        store.setGameState(newState);
        if (internal) store.addAgentInternal(internal);
        store.setGameMetrics(computeOfflineMetrics(newState));
      } else if (currentState.phase === 'voting') {
        const { votes, eliminateId } = generateOfflineVotes(currentState);
        let updated: GameState = {
          ...currentState,
          votes: [...currentState.votes, ...votes],
          players: currentState.players.map(p =>
            p.id === eliminateId ? { ...p, isAlive: false } : p
          ),
        };
        updated = checkWinConditions(updated);
        if (!updated.winner) {
          updated = { ...updated, phase: 'clue_giving', currentPlayerIndex: 0 };
        }
        store.setGameState(updated);
        store.setGameMetrics(computeOfflineMetrics(updated));
      }
    }
  }, [send]);

  const setGamePhase = useCallback((phase: string) => {
    send('game:set_phase', { phase });
  }, [send]);

  const cycleGamePhase = useCallback((currentPhase: GamePhase) => {
    const phases: GamePhase[] = ['clue_giving', 'voting', 'imposter_guess'];
    const currentIdx = phases.indexOf(currentPhase);
    const nextPhase = phases[(currentIdx + 1) % phases.length];
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('game:set_phase', { phase: nextPhase });
    } else {
      useGameStore.getState().setPhase(nextPhase);
    }
  }, [send]);

  const eliminatePlayerAction = useCallback((playerId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('game:eliminate', { playerId });
    } else {
      const store = useGameStore.getState();
      store.eliminatePlayer(playerId);
      const updated = checkWinConditions(store.gameState);
      if (updated.winner) {
        store.setGameState(updated);
      }
    }
  }, [send]);

  const setSessionMode = useCallback((mode: UserMode) => {
    // Always update local store so mode switches work offline
    useGameStore.getState().setUserMode(mode);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('session:set_mode', { mode });
    }
  }, [send]);

  const claimPlayerSlot = useCallback((playerId: string) => {
    useGameStore.getState().setParticipantPlayerId(playerId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('player:claim_slot', { playerId });
    }
  }, [send]);

  const submitClue = useCallback((playerId: string, clue: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('clue:submit', { playerId, clue });
    } else {
      // Offline: add clue locally with estimated distance
      const store = useGameStore.getState();
      const player = store.gameState.players.find(p => p.id === playerId);
      if (!player) return;
      const distance = 0.3 + Math.random() * 0.4;
      store.addClue({
        id: `clue-${Date.now()}`,
        playerId,
        playerName: player.name,
        clue,
        timestamp: Date.now(),
        semanticDistance: distance,
        riskLevel: distance > 0.6 ? 'risky' : distance > 0.4 ? 'moderate' : 'safe',
      });
    }
  }, [send]);

  const submitVote = useCallback((voterId: string, targetId: string, reason?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('vote:submit', { voterId, targetId, reason });
    } else {
      useGameStore.getState().addVote({ voterId, targetId, reason });
    }
  }, [send]);

  const setSecretWordVisibility = useCallback((visible: boolean) => {
    setSecretWordVisible(visible);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('admin:secret_word:set_visible', { visible });
    }
  }, [send, setSecretWordVisible]);

  const discardSecretWord = useCallback(() => {
    setSecretWordDiscarded(true);
    setSecretWordVisible(false);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('admin:secret_word:discard', {});
    }
  }, [send, setSecretWordDiscarded, setSecretWordVisible]);

  const setSecretWordCardCollapse = useCallback((collapsed: boolean) => {
    setSecretWordCardCollapsed(collapsed);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send('admin:secret_word:set_collapsed', { collapsed });
    }
  }, [send, setSecretWordCardCollapsed]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // REST fallback polling when WS is disconnected
  useEffect(() => {
    if (isConnected) {
      return;
    }

    const baseUrl = (WS_URL.startsWith('ws://')
      ? WS_URL.replace('ws://', 'http://')
      : WS_URL.replace('wss://', 'https://')).replace('/ws', '');

    const poll = async () => {
      try {
        // Skip /api/state in fallback polling – it returns 404 when no game
        // is active (e.g. during reset) and WebSocket game:state is the
        // authoritative source for game state anyway.
        const [vectorsRes, beliefsRes, metricsRes, wordStateRes] = await Promise.all([
          fetch(`${baseUrl}/api/admin/semantic-vectors`),
          fetch(`${baseUrl}/api/admin/imposter-beliefs`),
          fetch(`${baseUrl}/api/admin/game-metrics`),
          fetch(`${baseUrl}/api/admin/secret-word-state`),
        ]);
        if (vectorsRes.ok) {
          const payload = await vectorsRes.json();
          setSemanticVectors(payload.vectors || []);
        }
        if (beliefsRes.ok) {
          const beliefs = await beliefsRes.json();
          updateImposterKnowledge(beliefs);
        }
        if (metricsRes.ok) {
          const payload = await metricsRes.json();
          setGameMetrics(payload.metrics || {});
        }
        if (wordStateRes.ok) {
          const wordState = await wordStateRes.json();
          setSecretWordVisible(Boolean(wordState.secretWordVisible));
          setSecretWordDiscarded(Boolean(wordState.secretWordDiscarded));
          setSecretWordCardCollapsed(Boolean(wordState.secretWordCardCollapsed));
        }
      } catch {
        // no-op during fallback polling
      }
    };

    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [
    isConnected,
    setSemanticVectors,
    updateImposterKnowledge,
    setGameMetrics,
    setSecretWordVisible,
    setSecretWordDiscarded,
    setSecretWordCardCollapsed,
  ]);

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
    cycleGamePhase,
    eliminatePlayer: eliminatePlayerAction,
    setSessionMode,
    claimPlayerSlot,
    submitClue,
    submitVote,
    setSecretWordVisibility,
    discardSecretWord,
    setSecretWordCardCollapse,
  };
}

// Export alias for backwards compatibility
export { useWebSocket as useWebSocketSimulation };
