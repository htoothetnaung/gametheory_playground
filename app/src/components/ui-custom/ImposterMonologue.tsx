import { useRef, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, TrendingUp, Lightbulb, AlertCircle } from 'lucide-react';

export function ImposterMonologue() {
  const { gameState, agentInternals } = useGameStore();
  const { imposterKnowledge, imposterId, players } = gameState;
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentInternals, imposterKnowledge]);
  
  const imposter = players.find(p => p.id === imposterId);
  const imposterInternals = agentInternals.filter(i => i.playerId === imposterId);
  
  return (
    <div className="glass-panel-strong border border-white/10 rounded-xl overflow-hidden flex flex-col h-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-red-950/20">
        <Brain className="w-4 h-4 text-red-400" />
        <span className="font-display text-sm text-white/80">Imposter Internal Monologue</span>
        {imposter && (
          <span className="ml-auto text-xs text-red-400/60">{imposter.name}</span>
        )}
      </div>
      
      {/* Knowledge state */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50">Confidence Level</span>
          <span className={`
            text-xs font-mono
            ${imposterKnowledge.confidence > 0.7 ? 'text-green-400' :
              imposterKnowledge.confidence > 0.4 ? 'text-yellow-400' :
              'text-red-400'}
          `}>
            {(imposterKnowledge.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`
              h-full rounded-full transition-all duration-500
              ${imposterKnowledge.confidence > 0.7 ? 'bg-green-500' :
                imposterKnowledge.confidence > 0.4 ? 'bg-yellow-500' :
                'bg-red-500'}
            `}
            style={{ width: `${imposterKnowledge.confidence * 100}%` }}
          />
        </div>
        
        {/* Top guesses */}
        {imposterKnowledge.candidateWords.length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-white/50">Top Guesses:</span>
            <div className="flex gap-2 mt-1">
              {imposterKnowledge.candidateWords.slice(0, 3).map((word, i) => (
                <span 
                  key={word.word}
                  className={`
                    px-2 py-0.5 rounded text-xs font-mono
                    ${i === 0 ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
                      'bg-white/10 text-white/60 border border-white/20'}
                  `}
                >
                  {word.word} ({(word.probability * 100).toFixed(0)}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Thought log */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-3 font-mono text-xs">
          {/* Current thought */}
          {imposterKnowledge.thoughtProcess && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400/80">Current Analysis</span>
              </div>
              <p className="text-white/80 leading-relaxed">
                {imposterKnowledge.thoughtProcess}
              </p>
            </div>
          )}
          
          {/* Internal thought history */}
          {imposterInternals.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-white/30">Waiting for imposter to analyze clues...</p>
            </div>
          ) : (
            imposterInternals.map((internal, i) => (
              <div 
                key={i}
                className="border-l-2 border-red-500/30 pl-3 py-1 animate-slide-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center gap-2 text-white/40 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>[{new Date(internal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                </div>
                <p className="text-white/70 leading-relaxed">
                  {internal.thought}
                </p>
                <div className="flex items-center gap-2 mt-1 text-red-400/60">
                  <AlertCircle className="w-3 h-3" />
                  <span className="italic">Strategy: {internal.strategy}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        <div className="w-full h-px bg-red-500 animate-scan" />
      </div>
    </div>
  );
}
