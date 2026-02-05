import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Pause, 
  SkipForward, 
  MessageSquare, 
  Vote, 
  Brain,
  RotateCcw,
  UserX
} from 'lucide-react';

export function ControlPanel() {
  const { 
    gameState, 
    setPhase, 
    isPaused, 
    setPaused, 
    eliminatePlayer,
    resetGame,
    setCurrentPlayer,
  } = useGameStore();
  
  const { phase, players, currentPlayerIndex } = gameState;
  
  const handlePhaseChange = () => {
    const phases: typeof phase[] = ['clue_giving', 'voting', 'imposter_guess'];
    const currentIdx = phases.indexOf(phase);
    const nextPhase = phases[(currentIdx + 1) % phases.length];
    setPhase(nextPhase);
  };
  
  const handleEliminateRandom = () => {
    const alivePlayers = players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
      const random = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      eliminatePlayer(random.id);
    }
  };
  
  const handleNextPlayer = () => {
    const alivePlayers = players.filter(p => p.isAlive);
    setCurrentPlayer((currentPlayerIndex + 1) % alivePlayers.length);
  };
  
  const getPhaseIcon = () => {
    switch (phase) {
      case 'clue_giving': return <Vote className="w-4 h-4" />;
      case 'voting': return <Brain className="w-4 h-4" />;
      case 'imposter_guess': return <MessageSquare className="w-4 h-4" />;
      default: return <RotateCcw className="w-4 h-4" />;
    }
  };
  
  const getNextPhaseLabel = () => {
    switch (phase) {
      case 'clue_giving': return 'Start Voting';
      case 'voting': return 'Imposter Guess';
      case 'imposter_guess': return 'New Round';
      default: return 'Next Phase';
    }
  };
  
  return (
    <div className="glass-panel-strong border border-white/10 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <div className="p-1.5 rounded-lg bg-neon-purple/20">
          <RotateCcw className="w-4 h-4 text-neon-purple" />
        </div>
        <span className="font-display text-sm text-white/80">Game Controls</span>
      </div>
      
      <div className="space-y-2">
        {/* Pause/Play */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-neon-purple/50"
          onClick={() => setPaused(!isPaused)}
        >
          {isPaused ? <Play className="w-4 h-4 text-green-500" /> : <Pause className="w-4 h-4 text-yellow-500" />}
          <span>{isPaused ? 'Resume Game' : 'Pause Game'}</span>
        </Button>
        
        {/* Phase Change */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-neon-purple/50"
          onClick={handlePhaseChange}
        >
          {getPhaseIcon()}
          <span>{getNextPhaseLabel()}</span>
        </Button>
        
        {/* Next Player */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-neon-purple/50"
          onClick={handleNextPlayer}
        >
          <SkipForward className="w-4 h-4" />
          <span>Next Player</span>
        </Button>
        
        {/* Force Eliminate */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-red-500/50"
          onClick={handleEliminateRandom}
        >
          <UserX className="w-4 h-4 text-red-500" />
          <span className="text-red-400">Eliminate Random</span>
        </Button>
        
        {/* Reset Game */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-orange-500/50"
          onClick={resetGame}
        >
          <RotateCcw className="w-4 h-4 text-orange-500" />
          <span className="text-orange-400">Reset Game</span>
        </Button>
      </div>
      
      {/* Status */}
      <div className="pt-3 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">Game Status</span>
          <span className={isPaused ? 'text-yellow-500' : 'text-green-500'}>
            {isPaused ? 'PAUSED' : 'RUNNING'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-white/50">Current Phase</span>
          <span className="text-white/70 uppercase">{phase.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
