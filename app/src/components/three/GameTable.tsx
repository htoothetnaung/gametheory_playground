import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HumanoidAvatar } from './HumanoidAvatar';
import { Particles } from './Particles';
import { useGameStore } from '@/store/gameStore';

export function GameTable() {
  const tableRef = useRef<THREE.Group>(null);
  const spotlightRef = useRef<THREE.SpotLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const { gameState } = useGameStore();
  const { mouse } = useThree();
  
  // Calculate avatar positions around the table
  const avatarPositions = useMemo(() => {
    const radius = 4.5;
    return gameState.players.map((player, i) => {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      return {
        player,
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        angle,
      };
    });
  }, [gameState.players]);
  
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
      <ambientLight ref={ambientLightRef} intensity={0.2} color="#a885ff" />
      
      {/* Main spotlight from above */}
      <spotLight
        position={[0, 12, 0]}
        angle={0.5}
        penumbra={0.4}
        intensity={0.7}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
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
      <pointLight position={[-8, 4, -8]} intensity={0.4} color="#2e86de" />
      <pointLight position={[8, 4, 8]} intensity={0.4} color="#ff4757" />
      
      {/* THE TABLE */}
      <group position={[0, -0.3, 0]}>
        {/* Table surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <cylinderGeometry args={[5.5, 5.5, 0.15, 64]} />
          <meshStandardMaterial 
            color="#0f0f1a"
            roughness={0.15}
            metalness={0.9}
          />
        </mesh>
        
        {/* Table edge glow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <torusGeometry args={[5.5, 0.06, 16, 100]} />
          <meshStandardMaterial 
            color={tensionLevel > 0.6 ? '#ff4757' : '#a885ff'}
            emissive={tensionLevel > 0.6 ? '#ff4757' : '#a885ff'}
            emissiveIntensity={1 + tensionLevel}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>
        
        {/* Inner holographic ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2, 5.3, 64]} />
          <meshBasicMaterial 
            color="#a885ff"
            transparent
            opacity={0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* Table legs */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh 
              key={i}
              position={[Math.cos(angle) * 4, -2, Math.sin(angle) * 4]}
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
      
      {/* CENTER WORD CARD DISPLAY */}
      <group position={[0, 1.5, 0]}>
        {/* Floating card base */}
        <mesh>
          <boxGeometry args={[2, 1.2, 0.1]} />
          <meshStandardMaterial 
            color="#0a0a0f"
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
        
        {/* Card glow border */}
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[2.1, 1.3]} />
          <meshBasicMaterial 
            color="#a885ff"
            transparent
            opacity={0.3}
          />
        </mesh>
        
        {/* Card inner */}
        <mesh position={[0, 0, 0.07]}>
          <planeGeometry args={[1.9, 1.1]} />
          <meshBasicMaterial color="#0f0f1a" />
        </mesh>
      </group>
      
      {/* AVATARS */}
      {avatarPositions.map(({ player, position, angle }) => (
        <HumanoidAvatar 
          key={player.id}
          player={player}
          position={position}
          angle={angle}
        />
      ))}
      
      {/* Floating particles */}
      <Particles count={100} />
      
      {/* Fog */}
      <fog attach="fog" args={['#0a0a0f', 8, 35]} />
    </group>
  );
}
