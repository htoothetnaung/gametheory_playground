import { useGameStore } from '@/store/gameStore';
import { Lock, AlertTriangle, Eye, EyeOff, Trash2, X, Maximize2 } from 'lucide-react';

type WordCardProps = {
  onSetSecretWordVisible?: (visible: boolean) => void;
  onDiscardSecretWord?: () => void;
  onSetSecretWordCardCollapsed?: (collapsed: boolean) => void;
};

const WORD_SCANLINE_CLASSES = [
  'mt-[10px]',
  'mt-[30px]',
  'mt-[50px]',
  'mt-[70px]',
  'mt-[90px]',
  'mt-[110px]',
  'mt-[130px]',
  'mt-[150px]',
];

const WORD_PARTICLE_CLASSES = [
  'left-[8%] top-[14%] animation-delay-100',
  'left-[22%] top-[72%] animation-delay-200',
  'left-[38%] top-[26%] animation-delay-300',
  'left-[54%] top-[84%] animation-delay-500',
  'left-[71%] top-[18%] animation-delay-200',
  'left-[88%] top-[58%] animation-delay-300',
];

export function WordCard({
  onSetSecretWordVisible,
  onDiscardSecretWord,
  onSetSecretWordCardCollapsed,
}: WordCardProps) {
  const {
    gameState,
    selectedPlayer,
    secretWordVisible,
    toggleSecretWordVisible,
    discardSecretWord,
    secretWordDiscarded,
    secretWordCardCollapsed,
    setSecretWordCardCollapsed,
    themeMode,
  } = useGameStore();
  const { secretWord, players, imposterIds = [] } = gameState;

  const isImposterView = imposterIds.includes(selectedPlayer || '');
  const imposter = players.find(p => imposterIds.includes(p.id));

  const handleSetCollapsed = (collapsed: boolean) => {
    if (onSetSecretWordCardCollapsed) {
      onSetSecretWordCardCollapsed(collapsed);
      return;
    }
    setSecretWordCardCollapsed(collapsed);
  };

  const handleToggleVisible = () => {
    const nextVisible = !secretWordVisible;
    if (onSetSecretWordVisible) {
      onSetSecretWordVisible(nextVisible);
      return;
    }
    toggleSecretWordVisible();
  };

  const handleDiscard = () => {
    if (onDiscardSecretWord) {
      onDiscardSecretWord();
      return;
    }
    discardSecretWord();
  };

  if (secretWordCardCollapsed) {
    return (
      <button
        onClick={() => handleSetCollapsed(false)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
          ${themeMode === 'dark'
            ? 'glass-panel border-neon-purple/40 text-white/80 hover:border-neon-purple/80'
            : 'bg-white/90 border-indigo-300 text-slate-700 hover:border-indigo-500 shadow-sm'}
        `}
        title="Reopen secret word card"
      >
        <Maximize2 className="w-4 h-4" />
        <span className="text-sm font-medium">Open Word Card</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <div className={`
        relative w-64 h-40 rounded-xl overflow-hidden
        ${isImposterView
          ? 'bg-gradient-to-br from-red-950/80 to-red-900/40 border-red-500/50'
          : 'bg-gradient-to-br from-blue-950/80 to-purple-900/40 border-neon-purple/50'
        }
        border-2 backdrop-blur-xl
        shadow-glass-strong
        transition-all duration-500
      `}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-transparent" />

        <div className="absolute inset-0 pointer-events-none opacity-20">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`w-full h-px bg-white/10 ${WORD_SCANLINE_CLASSES[i]}`}
            />
          ))}
        </div>

        <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isImposterView ? (
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
            ) : (
              <Lock className="w-4 h-4 text-neon-purple" />
            )}
            <span className={`
              text-xs font-mono uppercase tracking-wider
              ${isImposterView ? 'text-red-400' : 'text-neon-purple'}
            `}>
              {isImposterView ? 'REDACTED' : 'SECRET WORD'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`
              w-2 h-2 rounded-full animate-pulse
              ${isImposterView ? 'bg-red-500' : 'bg-green-500'}
            `} />
            <button
              onClick={() => handleSetCollapsed(true)}
              className="relative z-30 cursor-pointer p-1 rounded hover:bg-white/10 transition-colors"
              title="Close secret word card"
            >
              <X className="w-3 h-3 text-white/50 hover:text-white" />
            </button>
            <button
              onClick={handleToggleVisible}
              className="relative z-30 cursor-pointer p-1 rounded hover:bg-white/10 transition-colors"
              title="Hide/Show secret word"
            >
              {secretWordVisible ? (
                <EyeOff className="w-3 h-3 text-white/50 hover:text-white" />
              ) : (
                <Eye className="w-3 h-3 text-white/50 hover:text-white" />
              )}
            </button>
            <button
              onClick={handleDiscard}
              className="relative z-30 cursor-pointer p-1 rounded hover:bg-white/10 transition-colors"
              title="Discard secret word for this round"
              disabled={secretWordDiscarded}
            >
              <Trash2 className={`w-3 h-3 ${secretWordDiscarded ? 'text-orange-300' : 'text-white/50 hover:text-orange-300'}`} />
            </button>
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {isImposterView ? (
            <div className="text-center">
              <div className="text-4xl font-display font-bold text-red-500/80 tracking-widest animate-pulse">
                ERROR
              </div>
              <div className="text-xs text-red-400/60 mt-2 font-mono">
                ACCESS DENIED
              </div>
              <div className="text-xs text-red-400/40 mt-1 font-mono">
                You are the IMPOSTER
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-3xl font-display font-bold text-white tracking-wider">
                {secretWordDiscarded ? 'DISCARDED' : secretWordVisible ? secretWord : 'HIDDEN'}
              </div>
              <div className="text-xs text-white/40 mt-2 font-mono uppercase">
                Do not say this word
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-3 left-4 right-4 pointer-events-none flex items-center justify-between">
          <span className="text-xs text-white/30 font-mono">
            ROUND {gameState.round}
          </span>
          {isImposterView && imposter && (
            <span className="text-xs text-red-400/60 font-mono">
              {imposter.name}
            </span>
          )}
        </div>

        {isImposterView && (
          <>
            <div className="absolute top-1/4 left-0 right-0 pointer-events-none h-1 bg-red-500/30 animate-pulse" />
            <div className="absolute bottom-1/3 left-0 right-0 pointer-events-none h-0.5 bg-red-500/20 animate-pulse" />
          </>
        )}
      </div>

      <div className="absolute -inset-4 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`
              absolute w-1 h-1 rounded-full
              ${isImposterView ? 'bg-red-500/40' : 'bg-neon-purple/40'}
              animate-float ${WORD_PARTICLE_CLASSES[i]}
            `}
          />
        ))}
      </div>
    </div>
  );
}
