import { useRef, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export function ClueStream() {
  const { gameState } = useGameStore();
  const { clues, players } = gameState;
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [clues]);
  
  const getPlayerById = (id: string) => players.find(p => p.id === id);
  
  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'dangerous': return <AlertTriangle className="w-3 h-3 text-red-500" />;
      case 'risky': return <AlertTriangle className="w-3 h-3 text-orange-500" />;
      case 'moderate': return <Info className="w-3 h-3 text-yellow-500" />;
      default: return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
  };
  
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'dangerous': return 'text-red-400 border-red-500/30 bg-red-950/30';
      case 'risky': return 'text-orange-400 border-orange-500/30 bg-orange-950/30';
      case 'moderate': return 'text-yellow-400 border-yellow-500/30 bg-yellow-950/30';
      default: return 'text-green-400 border-green-500/30 bg-green-950/30';
    }
  };
  
  return (
    <div className="glass-panel-strong border border-white/10 rounded-xl overflow-hidden flex flex-col w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <MessageSquare className="w-4 h-4 text-neon-purple" />
        <span className="font-display text-sm text-white/80">Clue Stream</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-white/50">Live</span>
        </div>
      </div>
      
      {/* Clues */}
      <ScrollArea className="h-56" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {clues.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/30 text-sm">Waiting for first clue...</p>
              <p className="text-white/20 text-xs mt-1">Civilians: Give semantic clues</p>
              <p className="text-white/20 text-xs">Imposter: Try to blend in</p>
            </div>
          ) : (
            clues.map((clue, i) => {
              const player = getPlayerById(clue.playerId);
              if (!player) return null;
              
              return (
                <div 
                  key={clue.id}
                  className={`
                    p-3 rounded-lg border animate-slide-up
                    ${getRiskColor(clue.riskLevel)}
                  `}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start gap-2">
                    {getRiskIcon(clue.riskLevel)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: player.color }}>
                          {player.name}
                        </span>
                        <span className="text-xs text-white/30">
                          {(clue.semanticDistance * 100).toFixed(0)}% similarity
                        </span>
                      </div>
                      <p className="text-white mt-1 font-medium">
                        "{clue.clue}"
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/10 bg-white/5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-white/40">Safe</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-white/40">Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-white/40">Risky</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-white/40">Danger</span>
          </div>
        </div>
      </div>
    </div>
  );
}
