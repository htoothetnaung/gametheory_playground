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
import { Brain, Wifi, WifiOff, Target, Users } from 'lucide-react';
import './App.css';

const HERO_PARTICLE_CLASSES = [
  'hero-particle-0', 'hero-particle-1', 'hero-particle-2', 'hero-particle-3', 'hero-particle-4',
  'hero-particle-5', 'hero-particle-6', 'hero-particle-7', 'hero-particle-8', 'hero-particle-9',
  'hero-particle-10', 'hero-particle-11', 'hero-particle-12', 'hero-particle-13', 'hero-particle-14',
  'hero-particle-15', 'hero-particle-16', 'hero-particle-17', 'hero-particle-18', 'hero-particle-19',
];

const PLAYER_DOT_CLASSES = [
  'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
  'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
  'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]',
  'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]',
  'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]',
  'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]',
  'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]',
  'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]',
  'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]',
];

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
            className={`absolute w-1 h-1 bg-neon-purple rounded-full animate-particle-float ${HERO_PARTICLE_CLASSES[i]}`}
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
  const {
    isConnected,
    setSecretWordVisibility,
    discardSecretWord,
    setSecretWordCardCollapse,
  } = useWebSocket();
  const { gameState, selectedPlayer, themeMode } = useGameStore();
  const { players } = gameState;
  const hasLiveClues = gameState.clues.length > 0;
  const isGameLikelyRunning = hasLiveClues || players.some((player) => player.isSpeaking) || gameState.round > 1;

  const phaseNarration =
    gameState.phase === 'clue_giving'
      ? 'Agents are giving one-word clues to help civilians identify the imposter.'
      : gameState.phase === 'voting'
        ? 'Agents discuss and vote to eliminate the most suspicious player.'
        : gameState.phase === 'imposter_guess'
          ? 'The imposter gets one final chance to guess the secret word.'
          : 'Round finished. Watch for the winner and strategy patterns.';

  return (
    <div className="relative h-screen overflow-hidden">
      {/* 3D Scene */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 7, 14], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={[themeMode === 'dark' ? '#0a0a0f' : '#dbeafe']} />
            <fog attach="fog" args={[themeMode === 'dark' ? '#0a0a0f' : '#dbeafe', 10, 40]} />
            <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
            <GameTable themeMode={themeMode} />
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
            <div className={`glass-panel border rounded-xl px-3 py-2 ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/80'}`}>
              <div className={`text-xs font-semibold ${isGameLikelyRunning ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isGameLikelyRunning ? 'LIVE ROUND IN PROGRESS' : 'WAITING FOR ROUND START'}
              </div>
              <div className={`text-[11px] mt-0.5 ${themeMode === 'dark' ? 'text-white/55' : 'text-slate-600'}`}>
                {isGameLikelyRunning
                  ? 'Watch clue bubbles above agents and follow the stream.'
                  : 'Switch to God Mode, set Admin, then press Reset Game to start a fresh round.'}
              </div>
            </div>
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
          <WordCard
            onSetSecretWordVisible={setSecretWordVisibility}
            onDiscardSecretWord={discardSecretWord}
            onSetSecretWordCardCollapsed={setSecretWordCardCollapse}
          />
        </div>

        {/* Bottom Left - Clue Stream */}
        <div className="absolute bottom-24 left-4 pointer-events-auto">
          <ClueStream />
        </div>

        {/* Bottom Right - Player Status */}
        <div className="absolute bottom-24 right-4 pointer-events-auto">
          <div className={`glass-panel-strong border rounded-xl p-4 w-48 ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-neon-purple" />
              <span className={`text-sm ${themeMode === 'dark' ? 'text-white/80' : 'text-slate-800'}`}>Players</span>
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
                    className={`w-2.5 h-2.5 rounded-full ${PLAYER_DOT_CLASSES[player.position % PLAYER_DOT_CLASSES.length]}`}
                  />
                  <span className={`text-xs flex-1 ${themeMode === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>{player.name}</span>
                  {(gameState.imposterIds || []).includes(player.id) && (
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
          <div className={`glass-panel border rounded-xl px-6 py-3 text-center ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
            <div className={`text-sm ${themeMode === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
              Current Turn:{' '}
              <span className={themeMode === 'dark' ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>
                {players[gameState.currentPlayerIndex]?.name || '...'}
              </span>
            </div>
            <div className={`text-xs mt-1 max-w-[420px] ${themeMode === 'dark' ? 'text-white/45' : 'text-slate-600'}`}>{phaseNarration}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GodMode() {
  const {
    isConnected,
    setSessionMode,
    claimPlayerSlot,
    submitClue,
    submitVote,
    pauseGame,
    resumeGame,
    resetGame,
    nextTurn,
    cycleGamePhase,
    eliminatePlayer,
    setSecretWordVisibility,
    discardSecretWord,
    setSecretWordCardCollapse,
  } = useWebSocket();
  const { gameState, themeMode, secretWordVisible, secretWordDiscarded, secretWordCardCollapsed } = useGameStore();

  return (
    <div className={`min-h-screen noise-overlay ${themeMode === 'dark' ? 'bg-void' : 'bg-slate-100 text-slate-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 glass-panel-strong border-b ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/90'}`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-neon-purple/20">
              <Brain className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <h1 className={`font-display text-lg ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>God Mode</h1>
              <p className={`text-xs ${themeMode === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>Semantic Analysis Dashboard</p>
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
            <ControlPanel
              setSessionMode={setSessionMode}
              claimPlayerSlot={claimPlayerSlot}
              submitClue={submitClue}
              submitVote={submitVote}
              pauseGame={pauseGame}
              resumeGame={resumeGame}
              resetGameAction={() => resetGame()}
              nextTurn={nextTurn}
              cycleGamePhase={cycleGamePhase}
              eliminatePlayerAction={eliminatePlayer}
              setSecretWordVisibility={setSecretWordVisibility}
              discardSecretWordAction={discardSecretWord}
              setSecretWordCardCollapse={setSecretWordCardCollapse}
            />

            {/* Secret Word Reveal */}
            {!secretWordCardCollapsed ? (
              <div className={`glass-panel-strong border rounded-xl p-4 ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
                <div className={`flex items-center gap-2 pb-3 border-b ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80'}`}>
                  <Target className="w-4 h-4 text-red-400" />
                  <span className={`font-display text-sm ${themeMode === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>True Word</span>
                  <button
                    onClick={() => setSecretWordCardCollapse(true)}
                    className={`ml-auto text-xs px-2 py-0.5 rounded border ${themeMode === 'dark' ? 'text-white/60 border-white/20 hover:bg-white/10' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}`}
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-3xl font-display font-bold text-red-400 tracking-wider">
                    {secretWordDiscarded
                      ? 'DISCARDED'
                      : secretWordVisible
                        ? gameState.secretWord
                        : 'HIDDEN'}
                  </p>
                  <p className={`text-xs mt-2 ${themeMode === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                    {gameState.players.filter(p => (gameState.imposterIds || []).includes(p.id)).map(p => p.name).join(' & ')} {(gameState.imposterIds || []).length > 1 ? 'are the imposters' : 'is the imposter'}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSecretWordCardCollapse(false)}
                className={`w-full rounded-xl border p-3 text-sm ${themeMode === 'dark' ? 'glass-panel border-white/20 text-white/70' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                Open True Word Panel
              </button>
            )}

            {/* Game Stats */}
            <div className={`glass-panel-strong border rounded-xl p-4 ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={themeMode === 'dark' ? 'text-white/50' : 'text-slate-600'}>Round</span>
                  <span className={themeMode === 'dark' ? 'text-white font-mono' : 'text-slate-900 font-mono'}>{gameState.round}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={themeMode === 'dark' ? 'text-white/50' : 'text-slate-600'}>Clues Given</span>
                  <span className={themeMode === 'dark' ? 'text-white font-mono' : 'text-slate-900 font-mono'}>{gameState.clues.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={themeMode === 'dark' ? 'text-white/50' : 'text-slate-600'}>Players Alive</span>
                  <span className={themeMode === 'dark' ? 'text-white font-mono' : 'text-slate-900 font-mono'}>
                    {gameState.players.filter(p => p.isAlive).length}/{gameState.players.length}
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
          <div className={`h-72 rounded-xl overflow-hidden glass-panel-strong border ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
            <div className={`p-3 border-b flex justify-between items-center ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/80'}`}>
              <span className={`text-sm ${themeMode === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>Live Game View</span>
              <span className={`text-xs ${themeMode === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Auto-rotate</span>
            </div>
            <div className="h-full -mt-10">
              <Canvas
                camera={{ position: [0, 12, 18], fov: 60 }}
                gl={{ antialias: true, alpha: true }}
              >
                <Suspense fallback={null}>
                  <color attach="background" args={[themeMode === 'dark' ? '#0a0a0f' : '#dbeafe']} />
                  <GameTable themeMode={themeMode} />
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
  const { viewMode, themeMode } = useGameStore();

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
      localStorage.setItem('themeMode', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('themeMode', 'light');
    }
  }, [themeMode]);

  useEffect(() => {
    const timer = setTimeout(() => { }, 1000);
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
