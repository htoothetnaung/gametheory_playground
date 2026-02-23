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
  UserX,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Trash2,
  User,
  Telescope,
  PenSquare,
  CheckCircle2,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GamePhase, UserMode } from '@/types';

type ControlPanelProps = {
  setSessionMode: (mode: UserMode) => void;
  claimPlayerSlot: (playerId: string) => void;
  submitClue: (playerId: string, clue: string) => void;
  submitVote: (voterId: string, targetId: string, reason?: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGameAction: () => void;
  nextTurn: () => void;
  cycleGamePhase: (currentPhase: GamePhase) => void;
  eliminatePlayerAction: (playerId: string) => void;
  setSecretWordVisibility?: (visible: boolean) => void;
  discardSecretWordAction?: () => void;
  setSecretWordCardCollapse?: (collapsed: boolean) => void;
};

export function ControlPanel({
  setSessionMode,
  claimPlayerSlot,
  submitClue,
  submitVote,
  pauseGame,
  resumeGame,
  resetGameAction,
  nextTurn,
  cycleGamePhase,
  eliminatePlayerAction,
  setSecretWordVisibility,
  discardSecretWordAction,
  setSecretWordCardCollapse,
}: ControlPanelProps) {
  const { 
    gameState, 
    isPaused, 
    setPaused, 
    userMode,
    participantPlayerId,
    themeMode,
    setThemeMode,
    secretWordVisible,
    toggleSecretWordVisible,
    secretWordDiscarded,
    discardSecretWord,
    secretWordCardCollapsed,
    toggleSecretWordCardCollapsed,
  } = useGameStore();

  const [manualClue, setManualClue] = useState('');
  const [voteTargetId, setVoteTargetId] = useState<string>('');
  const [voteReason, setVoteReason] = useState('');
  
  const { phase, players } = gameState;

  const alivePlayers = useMemo(() => players.filter(p => p.isAlive), [players]);
  const participantPlayer = useMemo(
    () => players.find((p) => p.id === participantPlayerId) || null,
    [players, participantPlayerId],
  );

  const isAdmin = userMode === 'admin';
  
  const handlePhaseChange = () => {
    cycleGamePhase(phase);
  };
  
  const handleEliminateRandom = () => {
    if (alivePlayers.length > 0) {
      const random = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      eliminatePlayerAction(random.id);
    }
  };
  
  const handleNextPlayer = () => {
    if (alivePlayers.length > 0) {
      nextTurn();
    }
  };

  const handleSubmitManualClue = () => {
    if (!participantPlayerId || !manualClue.trim()) {
      return;
    }
    submitClue(participantPlayerId, manualClue.trim());
    setManualClue('');
  };

  const handleSubmitManualVote = () => {
    if (!participantPlayerId || !voteTargetId) {
      return;
    }
    submitVote(participantPlayerId, voteTargetId, voteReason.trim() || undefined);
    setVoteReason('');
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
    <div className={`glass-panel-strong border rounded-xl p-4 space-y-4 ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/70'}`}>
      <div className={`flex items-center gap-2 pb-3 border-b ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/70'}`}>
        <div className="p-1.5 rounded-lg bg-neon-purple/20">
          <RotateCcw className="w-4 h-4 text-neon-purple" />
        </div>
        <span className={`font-display text-sm ${themeMode === 'dark' ? 'text-white/80' : 'text-slate-800'}`}>Game Controls</span>
      </div>
      
      <div className="space-y-2">
        {/* User Mode */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className={`justify-start gap-2 border-white/10 hover:bg-white/5 ${userMode === 'observer' ? 'border-cyan-500/50 text-cyan-300' : ''}`}
            onClick={() => setSessionMode('observer')}
          >
            <Telescope className="w-4 h-4" />
            Observe
          </Button>
          <Button
            variant="outline"
            className={`justify-start gap-2 border-white/10 hover:bg-white/5 ${userMode === 'participant' ? 'border-emerald-500/50 text-emerald-300' : ''}`}
            onClick={() => setSessionMode('participant')}
          >
            <User className="w-4 h-4" />
            Participate
          </Button>
          <Button
            variant="outline"
            className={`justify-start gap-2 border-white/10 hover:bg-white/5 ${isAdmin ? 'border-violet-500/50 text-violet-300' : ''}`}
            onClick={() => setSessionMode('admin')}
          >
            <Brain className="w-4 h-4" />
            Admin
          </Button>
        </div>

        {/* Theme Toggle */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5"
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
        >
          {themeMode === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          {themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </Button>

        {/* Secret Word Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="justify-start gap-2 border-white/10 hover:bg-white/5"
            onClick={() => {
              const nextVisible = !secretWordVisible;
              if (setSecretWordVisibility) {
                setSecretWordVisibility(nextVisible);
                return;
              }
              toggleSecretWordVisible();
            }}
            disabled={!isAdmin}
          >
            {secretWordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {secretWordVisible ? 'Hide Word' : 'Show Word'}
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-orange-500/50"
            onClick={() => {
              if (discardSecretWordAction) {
                discardSecretWordAction();
                return;
              }
              discardSecretWord();
            }}
            disabled={!isAdmin || secretWordDiscarded}
          >
            <Trash2 className="w-4 h-4 text-orange-400" />
            {secretWordDiscarded ? 'Discarded' : 'Discard'}
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2 border-white/10 hover:bg-white/5"
            onClick={() => {
              const nextCollapsed = !secretWordCardCollapsed;
              if (setSecretWordCardCollapse) {
                setSecretWordCardCollapse(nextCollapsed);
                return;
              }
              toggleSecretWordCardCollapsed();
            }}
            disabled={!isAdmin}
          >
            {secretWordCardCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            {secretWordCardCollapsed ? 'Open Box' : 'Close Box'}
          </Button>
        </div>

        {/* Participant controls */}
        {userMode === 'participant' && (
          <div className="space-y-2 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <div className="text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" />
              {participantPlayer ? `Controlling: ${participantPlayer.name}` : 'Claim a player slot'}
            </div>
            <select
              title="Choose participant player slot"
              aria-label="Choose participant player slot"
              className={`w-full border rounded px-2 py-1 text-xs ${themeMode === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              value={participantPlayerId ?? ''}
              onChange={(event) => claimPlayerSlot(event.target.value)}
            >
              <option value="" disabled>Select player slot</option>
              {alivePlayers.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>

            {phase === 'clue_giving' && (
              <>
                <input
                  value={manualClue}
                  onChange={(event) => setManualClue(event.target.value)}
                  placeholder="Type your clue"
                  className={`w-full border rounded px-2 py-1 text-xs ${themeMode === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-white/10 hover:bg-white/5"
                  onClick={handleSubmitManualClue}
                  disabled={!participantPlayerId || !manualClue.trim()}
                >
                  <PenSquare className="w-4 h-4" />
                  Submit Clue
                </Button>
              </>
            )}

            {phase === 'voting' && (
              <>
                <select
                  title="Choose vote target"
                  aria-label="Choose vote target"
                  className={`w-full border rounded px-2 py-1 text-xs ${themeMode === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  value={voteTargetId}
                  onChange={(event) => setVoteTargetId(event.target.value)}
                >
                  <option value="" disabled>Select vote target</option>
                  {alivePlayers
                    .filter((player) => player.id !== participantPlayerId)
                    .map((player) => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                </select>
                <input
                  value={voteReason}
                  onChange={(event) => setVoteReason(event.target.value)}
                  placeholder="Vote reason (optional)"
                  className={`w-full border rounded px-2 py-1 text-xs ${themeMode === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-white/10 hover:bg-white/5"
                  onClick={handleSubmitManualVote}
                  disabled={!participantPlayerId || !voteTargetId}
                >
                  <Vote className="w-4 h-4" />
                  Submit Vote
                </Button>
              </>
            )}
          </div>
        )}

        {/* Pause/Play */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-neon-purple/50"
          onClick={() => {
            if (isPaused) {
              resumeGame();
              setPaused(false);
            } else {
              pauseGame();
              setPaused(true);
            }
          }}
          disabled={!isAdmin}
        >
          {isPaused ? <Play className="w-4 h-4 text-green-500" /> : <Pause className="w-4 h-4 text-yellow-500" />}
          <span>{isPaused ? 'Resume Game' : 'Pause Game'}</span>
        </Button>
        
        {/* Phase Change */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-neon-purple/50"
          onClick={handlePhaseChange}
          disabled={!isAdmin}
        >
          {getPhaseIcon()}
          <span>{getNextPhaseLabel()}</span>
        </Button>
        
        {/* Next Player */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-neon-purple/50"
          onClick={handleNextPlayer}
          disabled={!isAdmin}
        >
          <SkipForward className="w-4 h-4" />
          <span>Next Player</span>
        </Button>
        
        {/* Force Eliminate */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-red-500/50"
          onClick={handleEliminateRandom}
          disabled={!isAdmin}
        >
          <UserX className="w-4 h-4 text-red-500" />
          <span className="text-red-400">Eliminate Random</span>
        </Button>
        
        {/* Reset Game */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 hover:bg-white/5 hover:border-orange-500/50"
          onClick={resetGameAction}
          disabled={!isAdmin}
        >
          <RotateCcw className="w-4 h-4 text-orange-500" />
          <span className="text-orange-400">Reset Game</span>
        </Button>
      </div>
      
      {/* Status */}
      <div className={`pt-3 border-t ${themeMode === 'dark' ? 'border-white/10' : 'border-slate-300/70'}`}>
        <div className="flex items-center justify-between text-xs">
          <span className={themeMode === 'dark' ? 'text-white/50' : 'text-slate-600'}>Game Status</span>
          <span className={isPaused ? 'text-yellow-500' : 'text-green-500'}>
            {isPaused ? 'PAUSED' : 'RUNNING'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-2">
          <span className={themeMode === 'dark' ? 'text-white/50' : 'text-slate-600'}>Current Phase</span>
          <span className={`${themeMode === 'dark' ? 'text-white/70' : 'text-slate-800'} uppercase`}>{phase.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
