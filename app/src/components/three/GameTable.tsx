import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HumanoidAvatar } from './HumanoidAvatar';
import { Particles } from './Particles';
import { useGameStore } from '@/store/gameStore';
import type { ThemeMode } from '@/types';

type GameTableProps = {
  themeMode?: ThemeMode;
};

export function GameTable({ themeMode = 'dark' }: GameTableProps) {
  const tableRef = useRef<THREE.Group>(null);
  const spotlightRef = useRef<THREE.SpotLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const { gameState, agentInternals } = useGameStore();
  const { mouse } = useThree();

  const latestClueByPlayer = useMemo(() => {
    const latestMap: Record<string, string> = {};
    for (let index = gameState.clues.length - 1; index >= 0; index -= 1) {
      const clue = gameState.clues[index];
      if (!latestMap[clue.playerId]) {
        latestMap[clue.playerId] = clue.clue;
      }
    }
    return latestMap;
  }, [gameState.clues]);

  const latestThoughtByPlayer = useMemo(() => {
    const latestMap: Record<string, string> = {};
    const nowSeconds = Date.now() / 1000;
    const recencyWindowSeconds = 90;

    for (let index = agentInternals.length - 1; index >= 0; index -= 1) {
      const internal = agentInternals[index];
      if (latestMap[internal.playerId]) {
        continue;
      }
      if (nowSeconds - internal.timestamp > recencyWindowSeconds) {
        continue;
      }
      const compactThought = internal.thought
        .replace(/\s+/g, ' ')
        .trim();
      const summarizedThought = compactThought.length > 96
        ? `${compactThought.slice(0, 93)}...`
        : compactThought;
      latestMap[internal.playerId] = summarizedThought;
    }

    return latestMap;
  }, [agentInternals]);

  const cueTextByPlayer = useMemo(() => {
    const cues: Record<string, string> = {};
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (!currentPlayer) {
      return cues;
    }

    if (gameState.phase === 'clue_giving') {
      cues[currentPlayer.id] = 'Thinking of a clue...';
    } else if (gameState.phase === 'voting') {
      cues[currentPlayer.id] = 'Considering who to vote...';
    } else if (gameState.phase === 'imposter_guess') {
      cues[currentPlayer.id] = 'Making a final guess...';
    } else {
      cues[currentPlayer.id] = 'Waiting for next round...';
    }

    return cues;
  }, [gameState.currentPlayerIndex, gameState.phase, gameState.players]);

  // Dynamic table dimensions based on player count
  const tableDimensions = useMemo(() => {
    const playerCount = Math.max(gameState.players.length, 1);
    // Scale radius: min 2.5 for ≤3 players, grows ~0.55 per additional player
    const avatarRadius = Math.max(2.5, 1.0 + playerCount * 0.55);
    const tableOuterRadius = avatarRadius + 1.0;
    const tableInnerRadius = Math.max(1.0, tableOuterRadius * 0.39);
    const legRadius = (tableInnerRadius + tableOuterRadius) / 2;
    return { avatarRadius, tableOuterRadius, tableInnerRadius, legRadius };
  }, [gameState.players.length]);

  // Calculate avatar positions around the table
  const avatarPositions = useMemo(() => {
    const { avatarRadius } = tableDimensions;
    const playerCount = gameState.players.length;
    return gameState.players.map((player, i) => {
      const angle = (i / playerCount) * Math.PI * 2 - Math.PI / 2;
      return {
        player,
        position: [Math.cos(angle) * avatarRadius, 0, Math.sin(angle) * avatarRadius] as [number, number, number],
        angle,
      };
    });
  }, [gameState.players, tableDimensions]);

  // Find speaking player for spotlight
  const speakingPlayer = useMemo(() => {
    return gameState.players.find(p => p.isSpeaking);
  }, [gameState.players]);

  // Calculate tension level based on recent clue risk
  const tensionLevel = useMemo(() => {
    if (gameState.clues.length === 0) return 0;
    const lastClue = gameState.clues[gameState.clues.length - 1];
    if (lastClue.riskLevel === 'dangerous') return 1;
    if (lastClue.riskLevel === 'risky') return 0.7;
    if (lastClue.riskLevel === 'moderate') return 0.4;
    return 0.2;
  }, [gameState.clues]);

  // Camera parallax and lighting based on tension
  useFrame((_, delta) => {
    if (!tableRef.current) return;

    // Subtle table rotation based on mouse
    const targetRotationX = mouse.y * 0.03;
    const targetRotationY = mouse.x * 0.03;

    tableRef.current.rotation.x = THREE.MathUtils.lerp(
      tableRef.current.rotation.x,
      targetRotationX,
      delta * 2
    );
    tableRef.current.rotation.y = THREE.MathUtils.lerp(
      tableRef.current.rotation.y,
      targetRotationY,
      delta * 2
    );

    // Spotlight follows speaking player
    if (spotlightRef.current && speakingPlayer) {
      const playerPos = avatarPositions.find(p => p.player.id === speakingPlayer.id);
      if (playerPos) {
        spotlightRef.current.target.position.set(
          playerPos.position[0],
          1.5,
          playerPos.position[2]
        );
        spotlightRef.current.target.updateMatrixWorld();
      }
    }

    // Tension lighting - turn red when risky clues are given
    if (ambientLightRef.current) {
      const targetColor = tensionLevel > 0.6
        ? new THREE.Color('#ff4757').multiplyScalar(tensionLevel * 0.3)
        : new THREE.Color('#a885ff').multiplyScalar(0.1);
      ambientLightRef.current.color.lerp(targetColor, delta * 2);
    }
  });

  return (
    <group ref={tableRef}>
      {/* Ambient lighting - changes with tension */}
      <ambientLight ref={ambientLightRef} intensity={0.55} color="#a885ff" />

      <hemisphereLight
        intensity={themeMode === 'dark' ? 0.55 : 0.7}
        groundColor={themeMode === 'dark' ? '#1e293b' : '#dbeafe'}
        color={themeMode === 'dark' ? '#c4b5fd' : '#ffffff'}
      />

      {themeMode === 'light' && (
        <hemisphereLight intensity={0.45} groundColor="#dbeafe" color="#ffffff" />
      )}

      {/* Main spotlight from above */}
      <spotLight
        position={[0, 12, 0]}
        angle={0.5}
        penumbra={0.4}
        intensity={0.95}
        color="#ffffff"
      />

      {/* Dynamic spotlight for speaking player */}
      <spotLight
        ref={spotlightRef}
        position={[0, 8, 0]}
        angle={0.25}
        penumbra={0.3}
        intensity={speakingPlayer ? 1.5 : 0}
        color={tensionLevel > 0.6 ? '#ff4757' : '#a885ff'}
        distance={15}
        decay={2}
      />

      {/* Rim lights */}
      <pointLight position={[-8, 4, -8]} intensity={0.75} color="#2e86de" />
      <pointLight position={[8, 4, 8]} intensity={0.75} color="#ff4757" />

      {/* THE TABLE */}
      <group position={[0, -0.3, 0]}>
        {/* Table surface (annular ring to keep center open) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[tableDimensions.tableInnerRadius, tableDimensions.tableOuterRadius, 96]} />
          <meshStandardMaterial
            color={themeMode === 'dark' ? '#0f0f1a' : '#e2e8f0'}
            roughness={0.15}
            metalness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Table edge glow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[tableDimensions.tableOuterRadius, 0.06, 16, 100]} />
          <meshStandardMaterial
            color={tensionLevel > 0.6 ? '#ff4757' : '#a885ff'}
            emissive={tensionLevel > 0.6 ? '#ff4757' : '#a885ff'}
            emissiveIntensity={1 + tensionLevel}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>

        {/* Inner holographic ring intentionally removed to avoid center dark disk effect */}

        {/* Table legs */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * tableDimensions.legRadius, -2, Math.sin(angle) * tableDimensions.legRadius]}
            >
              <cylinderGeometry args={[0.12, 0.08, 4, 8]} />
              <meshStandardMaterial
                color="#0a0a0f"
                roughness={0.5}
                metalness={0.7}
              />
            </mesh>
          );
        })}
      </group>

      {/* AVATARS */}
      {avatarPositions.map(({ player, position, angle }) => (
        <HumanoidAvatar
          key={player.id}
          player={player}
          position={position}
          angle={angle}
          clueText={latestClueByPlayer[player.id]}
          thoughtText={latestThoughtByPlayer[player.id]}
          cueText={cueTextByPlayer[player.id]}
        />
      ))}

      {/* Floating particles */}
      <Particles count={100} />

      {/* Fog */}
      <fog attach="fog" args={[themeMode === 'dark' ? '#0a0a0f' : '#e2e8f0', 8, 35]} />
    </group>
  );
}
