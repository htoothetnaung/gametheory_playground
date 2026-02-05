import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export function WordCard() {
  const { gameState, selectedPlayer } = useGameStore();
  const { secretWord, players, imposterId } = gameState;
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const isImposterView = selectedPlayer === imposterId;
  const imposter = players.find(p => p.id === imposterId);
  
  // Collapsed state - show small toggle button
  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg glass-panel border border-neon-purple/30 hover:border-neon-purple/60 transition-all"
      >
        <Eye className="w-4 h-4 text-neon-purple" />
        <span className="text-sm text-white/70">Show Word Card</span>
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
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
        
        <div className="absolute inset-0 opacity-20">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i}
              className="w-full h-px bg-white/10"
              style={{ marginTop: `${i * 20 + 10}px` }}
            />
          ))}
        </div>
        
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
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
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Collapse card"
            >
              <EyeOff className="w-3 h-3 text-white/50 hover:text-white" />
            </button>
          </div>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center">
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
                {secretWord}
              </div>
              <div className="text-xs text-white/40 mt-2 font-mono uppercase">
                Do not say this word
              </div>
            </div>
          )}
        </div>
        
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
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
            <div className="absolute top-1/4 left-0 right-0 h-1 bg-red-500/30 animate-pulse" />
            <div className="absolute bottom-1/3 left-0 right-0 h-0.5 bg-red-500/20" 
              style={{ animation: 'glitch 0.3s infinite' }} 
            />
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
              animate-float
            `}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
