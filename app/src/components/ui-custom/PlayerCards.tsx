import { useGameStore } from '@/store/gameStore';
import { Skull, User } from 'lucide-react';

export function PlayerCards() {
  const { gameState, selectedPlayer, setSelectedPlayer } = useGameStore();
  const { players, imposterId } = gameState;
  
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 flex-wrap justify-center max-w-4xl">
      {players.map((player, i) => {
        const isSelected = selectedPlayer === player.id;
        const isDead = !player.isAlive;
        const isSpeaking = player.isSpeaking;
        const isImposter = player.id === imposterId;
        
        return (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(isSelected ? null : player.id)}
            className={`
              relative px-3 py-2 rounded-lg border transition-all duration-300
              ${isSelected 
                ? 'bg-neon-purple/20 border-neon-purple shadow-neon' 
                : 'bg-black/40 border-white/10 hover:border-white/30'
              }
              ${isDead ? 'opacity-40 grayscale' : ''}
              ${isSpeaking ? 'animate-pulse-glow' : ''}
            `}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Speaking indicator */}
            {isSpeaking && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
            )}
            
            <div className="flex items-center gap-2">
              {/* Avatar indicator */}
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${player.color}30` }}
              >
                <span style={{ color: player.color }}>
                  {isImposter ? <Skull className="w-3 h-3" /> : <User className="w-3 h-3" />}
                </span>
              </div>
              
              {/* Name */}
              <span className={`
                text-xs font-medium
                ${isDead ? 'text-white/40 line-through' : 'text-white/80'}
              `}>
                {player.name}
              </span>
              
              {isImposter && (
                <span className="text-xs text-red-400 font-mono">IMP</span>
              )}
              
              {/* Status dot */}
              <div className={`
                w-2 h-2 rounded-full
                ${player.isAlive ? 'bg-green-500' : 'bg-red-500'}
              `} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
