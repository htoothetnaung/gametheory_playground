import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { GameTable } from '@/components/three/GameTable';
import { PhaseIndicator } from '@/components/ui-custom/PhaseIndicator';
import { WordCard } from '@/components/ui-custom/WordCard';
import { ClueStream } from '@/components/ui-custom/ClueStream';
import { ViewToggle } from '@/components/ui-custom/ViewToggle';
import { ControlPanel } from '@/components/ui-custom/ControlPanel';
import { SemanticVectorSpace } from '@/components/ui-custom/SemanticVectorSpace';
import { ImposterMonologue } from '@/components/ui-custom/ImposterMonologue';
import { useGameStore } from '@/store/gameStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Brain, Wifi, WifiOff, Target, Users, AlertCircle } from 'lucide-react';
import './App.css';

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-16 h-16 border-2 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neon-purple font-display">Initializing Semantic Engine...</p>
      </div>
    </div>
  );
}

function HeroSection({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-radial from-neon-purple/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-30" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-neon-purple rounded-full animate-particle-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${8 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
      
      {/* Content */}
      <div className="relative z-10 text-center px-4">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-neon-purple/30">
          <Brain className="w-4 h-4 text-neon-purple" />
          <span className="text-sm text-white/70">Game Theory + Semantic AI</span>
        </div>
        
        <h1 className="font-display text-5xl md:text-7xl font-bold mb-4">
          <span className="gradient-text">Semantic</span>
          <br />
          <span className="text-white">Signaling</span>
        </h1>
        
        <p className="text-xl text-white/50 mb-2 max-w-2xl mx-auto font-light">
          A Zero-Sum Game of Imperfect Information
        </p>
        
        <p className="text-lg text-white/40 mb-8 max-w-xl mx-auto">
          Watch AI agents navigate the delicate balance between 
          signaling and secrecy in a game of semantic deception.
        </p>
        
        <button onClick={onEnter} className="btn-cyber text-lg px-10 py-4">
          <Target className="w-5 h-5 inline mr-2" />
          Enter the Game
        </button>
        
        {/* Game theory concepts */}
        <div className="flex justify-center gap-6 mt-12">
          {[
            { label: 'Pooling Equilibrium', icon: Users },
            { label: 'Separating Equilibrium', icon: Target },
            { label: 'Bayesian Updating', icon: Brain },
          ].map((concept) => (
            <div key={concept.label} className="flex items-center gap-2 text-white/40">
              <concept.icon className="w-4 h-4" />
              <span className="text-xs font-mono">{concept.label}</span>
            </div>
          ))}
        </div>
        
        {/* Tech stack */}
        <div className="flex justify-center gap-4 mt-8">
          {['Google ADK', 'Groq LLaMA-3', 'FastAPI', 'Three.js'].map((tech) => (
            <span 
              key={tech}
              className="px-3 py-1 text-xs font-mono text-white/30 border border-white/10 rounded"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
      
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

function TheaterMode() {
  const { isConnected, startGame } = useWebSocket();
  const { gameState, selectedPlayer } = useGameStore();
  const { players } = gameState;
  
  return (
    <div className="relative h-screen overflow-hidden">
      {/* 3D Scene */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 7, 14], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={['#0a0a0f']} />
            <fog attach="fog" args={['#0a0a0f', 10, 40]} />
            <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
            <GameTable />
            <OrbitControls 
              enablePan={false}
              enableZoom={true}
              minDistance={10}
              maxDistance={22}
              maxPolarAngle={Math.PI / 2.5}
              minPolarAngle={Math.PI / 8}
            />
          </Suspense>
        </Canvas>
      </div>
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-auto">
          <div className="flex items-center gap-4">
            <PhaseIndicator />
          </div>
          
          <div className="flex items-center gap-4">
            <ViewToggle />
            <div className={`
              flex items-center gap-2 px-3 py-2 rounded-lg glass-panel
              ${isConnected ? 'border-green-500/30' : 'border-red-500/30'}
            `}>
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Center Word Card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <WordCard />
        </div>
        
        {/* Bottom Left - Clue Stream */}
        <div className="absolute bottom-24 left-4 pointer-events-auto">
          <ClueStream />
        </div>
        
        {/* Bottom Right - Player Status */}
        <div className="absolute bottom-24 right-4 pointer-events-auto">
          <div className="glass-panel-strong border border-white/10 rounded-xl p-4 w-48">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-neon-purple" />
              <span className="text-sm text-white/80">Players</span>
            </div>
            <div className="space-y-2">
              {players.map((player) => (
                <div 
                  key={player.id}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg transition-all
                    ${selectedPlayer === player.id ? 'bg-white/10' : 'hover:bg-white/5'}
                    ${!player.isAlive ? 'opacity-40' : ''}
                  `}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-xs text-white/70 flex-1">{player.name}</span>
                  {player.id === gameState.imposterId && (
                    <span className="text-xs text-red-400 font-mono">IMPOSTER</span>
                  )}
                  {player.isSpeaking && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Bottom - Current Turn Indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="glass-panel border border-white/10 rounded-full px-6 py-2">
            <span className="text-sm text-white/60">
              Current Turn: {' '}
              <span className="text-white font-semibold">
                {players[gameState.currentPlayerIndex]?.name || '...'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GodMode() {
  const { isConnected, startGame } = useWebSocket();
  const { gameState } = useGameStore();
  
  return (
    <div className="min-h-screen bg-void noise-overlay">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel-strong border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-neon-purple/20">
              <Brain className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <h1 className="font-display text-lg text-white">God Mode</h1>
              <p className="text-xs text-white/50">Semantic Analysis Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <PhaseIndicator />
            <ViewToggle />
            <div className={`
              flex items-center gap-2 px-3 py-2 rounded-lg glass-panel
              ${isConnected ? 'border-green-500/30' : 'border-red-500/30'}
            `}>
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Controls & Word Info */}
          <div className="col-span-3 space-y-6">
            <ControlPanel />
            
            {/* Secret Word Reveal */}
            <div className="glass-panel-strong border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                <Target className="w-4 h-4 text-red-400" />
                <span className="font-display text-sm text-white/80">True Word</span>
              </div>
              <div className="mt-4 text-center">
                <p className="text-3xl font-display font-bold text-red-400 tracking-wider">
                  {gameState.secretWord}
                </p>
                <p className="text-xs text-white/40 mt-2">
                  {gameState.players.find(p => p.id === gameState.imposterId)?.name} is the imposter
                </p>
              </div>
            </div>
            
            {/* Game Stats */}
            <div className="glass-panel-strong border border-white/10 rounded-xl p-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Round</span>
                  <span className="text-white font-mono">{gameState.round}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Clues Given</span>
                  <span className="text-white font-mono">{gameState.clues.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Players Alive</span>
                  <span className="text-white font-mono">
                    {gameState.players.filter(p => p.isAlive).length}/10
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Center - Semantic Vector Space */}
          <div className="col-span-5">
            <SemanticVectorSpace />
          </div>
          
          {/* Right - Imposter Monologue */}
          <div className="col-span-4">
            <ImposterMonologue />
          </div>
        </div>
        
        {/* Bottom Row - Clue History & Mini 3D */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <ClueStream />
          
          {/* Mini 3D View */}
          <div className="h-72 rounded-xl overflow-hidden glass-panel-strong border border-white/10">
            <div className="p-3 border-b border-white/10 flex justify-between items-center">
              <span className="text-sm text-white/70">Live Game View</span>
              <span className="text-xs text-white/40">Auto-rotate</span>
            </div>
            <div className="h-full -mt-10">
              <Canvas
                camera={{ position: [0, 12, 18], fov: 60 }}
                gl={{ antialias: true, alpha: true }}
              >
                <Suspense fallback={null}>
                  <color attach="background" args={['#0a0a0f']} />
                  <GameTable />
                  <OrbitControls 
                    enablePan={false}
                    enableZoom={false}
                    autoRotate
                    autoRotateSpeed={0.3}
                  />
                </Suspense>
              </Canvas>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const { viewMode } = useGameStore();
  
  useEffect(() => {
    const timer = setTimeout(() => {}, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!hasEntered) {
    return <HeroSection onEnter={() => setHasEntered(true)} />;
  }
  
  return (
    <Suspense fallback={<LoadingScreen />}>
      {viewMode === 'theater' ? <TheaterMode /> : <GodMode />}
    </Suspense>
  );
}

export default App;
