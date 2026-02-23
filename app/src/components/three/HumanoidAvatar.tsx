import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Player } from '@/types';
import { useGameStore } from '@/store/gameStore';

interface HumanoidAvatarProps {
  player: Player;
  position: [number, number, number];
  angle: number;
  clueText?: string;
  thoughtText?: string;
  cueText?: string;
}

export function HumanoidAvatar({ player, position, angle, clueText, thoughtText, cueText }: HumanoidAvatarProps) {
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
      <group position={position} rotation={[0, -angle + Math.PI / 2 + Math.PI, 0]}>
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
      rotation={[0, -angle + Math.PI / 2 + Math.PI, 0]}
      onClick={handleClick}
    >
      <group ref={groupRef}>
        {/* LEGS */}
        {/* Left Leg */}
        <mesh position={[-0.12, 0.35, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.68, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.65} />
        </mesh>
        {/* Right Leg */}
        <mesh position={[0.12, 0.35, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.68, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.65} />
        </mesh>

        {/* Feet */}
        <mesh position={[-0.12, 0.02, 0.06]}>
          <boxGeometry args={[0.13, 0.06, 0.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        <mesh position={[0.12, 0.02, 0.06]}>
          <boxGeometry args={[0.13, 0.06, 0.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        
        {/* TORSO */}
        <mesh position={[0, 0.9, 0]}>
          <capsuleGeometry args={[0.19, 0.32, 8, 16]} />
          <meshStandardMaterial 
            color={player.color} 
            roughness={0.4}
            metalness={0.3}
            emissive={player.color}
            emissiveIntensity={isSpeaking ? 0.5 : 0.2}
          />
        </mesh>
        
        {/* Torso detail - shirt pattern */}
        <mesh position={[0, 0.9, 0.13]}>
          <boxGeometry args={[0.25, 0.3, 0.02]} />
          <meshStandardMaterial color="#ffffff" opacity={0.2} transparent />
        </mesh>
        
        {/* ARMS */}
        {/* Left Arm */}
        <mesh position={[-0.28, 0.95, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.48, 14]} />
          <meshStandardMaterial color={player.color} roughness={0.5} emissive={player.color} emissiveIntensity={0.12} />
        </mesh>
        {/* Left Hand */}
        <mesh position={[-0.28, 0.6, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#e0c8a0" roughness={0.8} />
        </mesh>
        
        {/* Right Arm */}
        <mesh position={[0.28, 0.95, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.48, 14]} />
          <meshStandardMaterial color={player.color} roughness={0.5} emissive={player.color} emissiveIntensity={0.12} />
        </mesh>
        {/* Right Hand */}
        <mesh position={[0.28, 0.6, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#e0c8a0" roughness={0.8} />
        </mesh>
        
        {/* HEAD GROUP */}
        <group ref={headRef} position={[0, 1.5, 0]}>
          {/* Head base */}
          <mesh>
            <sphereGeometry args={[0.17, 20, 20]} />
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
              <sphereGeometry args={[0.19, 16, 16]} />
              <meshBasicMaterial color="#ff4757" transparent opacity={0.12} />
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
        <Html position={[0, 2.2, 0]} center distanceFactor={8} sprite>
          <div
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap border text-white bg-black/85 ${
              isSelected
                ? 'border-neon-purple shadow-[0_0_12px_rgba(168,133,255,0.85)]'
                : 'border-white/25 shadow-[0_0_6px_rgba(0,0,0,0.35)]'
            }`}
          >
            {player.name}
          </div>
        </Html>

        {clueText && (
          <Html position={[0, 2.85, 0]} center distanceFactor={8} sprite>
            <div className="max-w-[180px] px-2.5 py-1 rounded-lg border border-cyan-400/40 bg-slate-900/85 text-cyan-100 text-[11px] leading-tight shadow-[0_0_14px_rgba(34,211,238,0.25)]">
              <span className="text-cyan-300/80 text-[10px] uppercase tracking-wide mr-1">clue</span>
              <span>&quot;{clueText}&quot;</span>
            </div>
          </Html>
        )}

        {!clueText && cueText && (
          <Html position={[0, 2.85, 0]} center distanceFactor={8} sprite>
            <div className="max-w-[200px] px-2.5 py-1 rounded-lg border border-emerald-400/35 bg-emerald-950/50 text-emerald-100 text-[10px] leading-tight shadow-[0_0_12px_rgba(16,185,129,0.22)] animate-pulse">
              <span className="text-emerald-300/80 text-[9px] uppercase tracking-wide mr-1">turn</span>
              <span>{cueText}</span>
            </div>
          </Html>
        )}

        {thoughtText && (
          <Html position={[0, 3.4, 0]} center distanceFactor={8} sprite>
            <div className="max-w-[210px] px-2.5 py-1 rounded-lg border border-violet-400/35 bg-violet-950/55 text-violet-100 text-[10px] leading-tight shadow-[0_0_12px_rgba(168,133,255,0.25)]">
              <span className="text-violet-300/80 text-[9px] uppercase tracking-wide mr-1">thinking</span>
              <span>{thoughtText}</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
