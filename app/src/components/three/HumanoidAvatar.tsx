import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '@/types';
import { useGameStore } from '@/store/gameStore';

interface HumanoidAvatarProps {
  player: Player;
  position: [number, number, number];
  angle: number;
}

export function HumanoidAvatar({ player, position, angle }: HumanoidAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const { selectedPlayer, setSelectedPlayer } = useGameStore();
  const isSelected = selectedPlayer === player.id;
  const isImposter = player.role === 'imposter';
  const isSpeaking = player.isSpeaking;
  const isAlive = player.isAlive;
  
  // Breathing and idle animation
  useFrame((state) => {
    if (!groupRef.current || !isAlive) return;
    
    const time = state.clock.elapsedTime;
    const offset = player.position * 0.3;
    
    // Gentle breathing - chest expands
    const breathScale = 1 + Math.sin(time * 2 + offset) * 0.02;
    groupRef.current.scale.set(1, breathScale, 1);
    
    // Subtle idle sway
    groupRef.current.rotation.z = Math.sin(time * 0.5 + offset) * 0.02;
    
    // Head slight movement
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(time * 0.3 + offset) * 0.05;
      headRef.current.rotation.x = Math.sin(time * 0.4 + offset) * 0.03;
    }
    
    // Speaking glow pulse
    if (glowRef.current && isSpeaking) {
      const pulse = 1 + Math.sin(time * 10) * 0.2;
      glowRef.current.scale.setScalar(pulse);
    }
  });
  
  const handleClick = () => {
    setSelectedPlayer(isSelected ? null : player.id);
  };
  
  // Ghost/dead appearance
  if (!isAlive) {
    return (
      <group position={position} rotation={[0, -angle + Math.PI / 2, 0]}>
        <group ref={groupRef}>
          {/* Ghost body - translucent */}
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.35, 0.5, 0.25]} />
            <meshBasicMaterial color="#444" transparent opacity={0.3} wireframe />
          </mesh>
          {/* Ghost head */}
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.25, 0.3, 0.25]} />
            <meshBasicMaterial color="#555" transparent opacity={0.2} wireframe />
          </mesh>
          {/* Ghost glow */}
          <mesh position={[0, 1, 0]}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshBasicMaterial color="#666" transparent opacity={0.05} />
          </mesh>
        </group>
      </group>
    );
  }
  
  return (
    <group 
      position={position}
      rotation={[0, -angle + Math.PI / 2, 0]}
      onClick={handleClick}
    >
      <group ref={groupRef}>
        {/* LEGS */}
        {/* Left Leg */}
        <mesh position={[-0.12, 0.35, 0]} castShadow>
          <boxGeometry args={[0.12, 0.7, 0.15]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.7} />
        </mesh>
        {/* Right Leg */}
        <mesh position={[0.12, 0.35, 0]} castShadow>
          <boxGeometry args={[0.12, 0.7, 0.15]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.7} />
        </mesh>
        
        {/* TORSO */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[0.4, 0.55, 0.25]} />
          <meshStandardMaterial 
            color={player.color} 
            roughness={0.4}
            metalness={0.3}
            emissive={isSpeaking ? player.color : '#000000'}
            emissiveIntensity={isSpeaking ? 0.3 : 0}
          />
        </mesh>
        
        {/* Torso detail - shirt pattern */}
        <mesh position={[0, 0.9, 0.13]}>
          <boxGeometry args={[0.25, 0.3, 0.02]} />
          <meshStandardMaterial color="#ffffff" opacity={0.2} transparent />
        </mesh>
        
        {/* ARMS */}
        {/* Left Arm */}
        <mesh position={[-0.28, 0.95, 0]} castShadow>
          <boxGeometry args={[0.1, 0.5, 0.12]} />
          <meshStandardMaterial color={player.color} roughness={0.5} />
        </mesh>
        {/* Left Hand */}
        <mesh position={[-0.28, 0.6, 0]}>
          <boxGeometry args={[0.08, 0.1, 0.1]} />
          <meshStandardMaterial color="#e0c8a0" roughness={0.8} />
        </mesh>
        
        {/* Right Arm */}
        <mesh position={[0.28, 0.95, 0]} castShadow>
          <boxGeometry args={[0.1, 0.5, 0.12]} />
          <meshStandardMaterial color={player.color} roughness={0.5} />
        </mesh>
        {/* Right Hand */}
        <mesh position={[0.28, 0.6, 0]}>
          <boxGeometry args={[0.08, 0.1, 0.1]} />
          <meshStandardMaterial color="#e0c8a0" roughness={0.8} />
        </mesh>
        
        {/* HEAD GROUP */}
        <group ref={headRef} position={[0, 1.5, 0]}>
          {/* Head base */}
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.32, 0.28]} />
            <meshStandardMaterial color="#e0c8a0" roughness={0.6} />
          </mesh>
          
          {/* Eyes - glowing when speaking */}
          <mesh position={[-0.07, 0.02, 0.14]}>
            <boxGeometry args={[0.06, 0.04, 0.02]} />
            <meshStandardMaterial 
              color={isSpeaking ? '#00ff88' : '#1a1a2e'}
              emissive={isSpeaking ? '#00ff88' : '#000000'}
              emissiveIntensity={isSpeaking ? 0.8 : 0}
            />
          </mesh>
          <mesh position={[0.07, 0.02, 0.14]}>
            <boxGeometry args={[0.06, 0.04, 0.02]} />
            <meshStandardMaterial 
              color={isSpeaking ? '#00ff88' : '#1a1a2e'}
              emissive={isSpeaking ? '#00ff88' : '#000000'}
              emissiveIntensity={isSpeaking ? 0.8 : 0}
            />
          </mesh>
          
          {/* Hair/Headgear */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
            <meshStandardMaterial color="#0f0f1a" roughness={0.8} />
          </mesh>
          
          {/* Imposter indicator (subtle red tint on head) */}
          {isImposter && (
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.29, 0.33, 0.29]} />
              <meshBasicMaterial color="#ff4757" transparent opacity={0.1} />
            </mesh>
          )}
        </group>
        
        {/* SPEAKING GLOW RING */}
        {isSpeaking && (
          <mesh ref={glowRef} position={[0, 1.2, 0]}>
            <torusGeometry args={[0.5, 0.03, 8, 32]} />
            <meshBasicMaterial color={player.color} transparent opacity={0.7} />
          </mesh>
        )}
        
        {/* SELECTION RING */}
        {isSelected && (
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 32]} />
            <meshBasicMaterial color="#a885ff" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
        )}
        
        {/* NAME TAG */}
        <group position={[0, 2, 0]}>
          <mesh>
            <planeGeometry args={[1, 0.25]} />
            <meshBasicMaterial color="#0a0a0a" transparent opacity={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
