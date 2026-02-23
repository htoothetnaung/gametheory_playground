import { useRef, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, TrendingUp, Lightbulb, AlertCircle } from 'lucide-react';

const WIDTH_CLASSES = [
  'w-[2%]', 'w-1/12', 'w-2/12', 'w-3/12', 'w-4/12', 'w-5/12',
  'w-6/12', 'w-7/12', 'w-8/12', 'w-9/12', 'w-10/12', 'w-11/12', 'w-full',
];

const HEIGHT_CLASSES = ['h-2', 'h-3', 'h-4', 'h-5', 'h-6', 'h-7', 'h-8', 'h-9', 'h-10'];

function bucketClass(value: number, classes: string[]): string {
  const clamped = Math.max(0, Math.min(1, value));
  const index = Math.min(classes.length - 1, Math.round(clamped * (classes.length - 1)));
  return classes[index];
}

export function ImposterMonologue() {
  const { gameState, agentInternals, gameMetrics, themeMode } = useGameStore();
  const { imposterKnowledge, imposterIds = [], players } = gameState;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDark = themeMode === 'dark';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentInternals, imposterKnowledge]);

  const imposter = players.find(p => imposterIds.includes(p.id));
  const imposterInternals = agentInternals.filter(i => imposterIds.includes(i.playerId));
  const entropyHistory = gameMetrics.entropyHistory || [];
  const latestEntropy = typeof imposterKnowledge.entropy === 'number'
    ? imposterKnowledge.entropy
    : entropyHistory.length > 0
      ? entropyHistory[entropyHistory.length - 1]
      : 1;

  return (
    <div className={`glass-panel-strong border rounded-xl overflow-hidden flex flex-col h-80 ${isDark ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDark ? 'border-white/10 bg-red-950/20' : 'border-slate-300/80 bg-red-100/70'}`}>
        <Brain className="w-4 h-4 text-red-400" />
        <span className={`font-display text-sm ${isDark ? 'text-white/80' : 'text-slate-800'}`}>Imposter Internal Monologue</span>
        {imposter && (
          <span className="ml-auto text-xs text-red-400/60">{imposter.name}</span>
        )}
      </div>

      {/* Knowledge state */}
      <div className={`px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-300/80 bg-slate-50/80'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-600'}`}>Confidence Level</span>
          <span className={`
            text-xs font-mono
            ${imposterKnowledge.confidence > 0.7 ? 'text-green-400' :
              imposterKnowledge.confidence > 0.4 ? 'text-yellow-400' :
                'text-red-400'}
          `}>
            {(imposterKnowledge.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
          <div
            className={`
              h-full rounded-full transition-all duration-500
              ${imposterKnowledge.confidence > 0.7 ? 'bg-green-500' :
                imposterKnowledge.confidence > 0.4 ? 'bg-yellow-500' :
                  'bg-red-500'}
              ${bucketClass(imposterKnowledge.confidence, WIDTH_CLASSES)}
            `}
          />
        </div>

        <div className="flex items-center justify-between mt-3 mb-1">
          <span className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-600'}`}>Entropy</span>
          <span className="text-xs font-mono text-cyan-300">{latestEntropy.toFixed(2)}</span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 bg-cyan-500 ${bucketClass(latestEntropy, WIDTH_CLASSES)}`}
          />
        </div>

        {entropyHistory.length > 1 && (
          <div className="mt-2 flex items-end gap-1 h-10">
            {entropyHistory.slice(-12).map((value, idx) => (
              <div
                key={`${idx}-${value}`}
                className={`flex-1 bg-cyan-500/60 rounded-sm transition-all duration-300 ${bucketClass(value, HEIGHT_CLASSES)}`}
                title={`Entropy ${(value * 100).toFixed(1)}%`}
              />
            ))}
          </div>
        )}

        {/* Top guesses */}
        {imposterKnowledge.candidateWords.length > 0 && (
          <div className="mt-3">
            <span className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-600'}`}>Top Guesses:</span>
            <div className="mt-2 space-y-1">
              {imposterKnowledge.candidateWords.slice(0, 5).map((word, i) => (
                <div key={word.word}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={i === 0 ? 'text-red-400 font-semibold' : isDark ? 'text-white/70' : 'text-slate-700'}>{word.word}</span>
                    <span className={`font-mono ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{(word.probability * 100).toFixed(0)}%</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div
                      className={`${i === 0 ? 'h-full bg-red-500 rounded-full' : isDark ? 'h-full bg-white/40 rounded-full' : 'h-full bg-slate-400 rounded-full'} ${bucketClass(word.probability, WIDTH_CLASSES)}`}
                    />
                  </div>
                </div>
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
              <p className={`leading-relaxed ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                {imposterKnowledge.thoughtProcess}
              </p>
            </div>
          )}

          {/* Internal thought history */}
          {imposterInternals.length === 0 ? (
            <div className="text-center py-4">
              <p className={isDark ? 'text-white/30' : 'text-slate-500'}>Waiting for imposter to analyze clues...</p>
            </div>
          ) : (
            imposterInternals.map((internal, i) => (
              <div
                key={i}
                className="border-l-2 border-red-500/30 pl-3 py-1 animate-slide-up"
              >
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                  <TrendingUp className="w-3 h-3" />
                  <span>[{new Date(internal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                </div>
                <p className={`leading-relaxed ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
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
