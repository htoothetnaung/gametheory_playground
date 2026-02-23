import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, Brain } from 'lucide-react';

export function SemanticVectorSpace() {
  const { gameState, semanticVectors, gameMetrics, themeMode } = useGameStore();
  const { clues, secretWord } = gameState;
  const isDark = themeMode === 'dark';

  const data = useMemo(() => {
    if (semanticVectors.length > 0) {
      return semanticVectors.map((vector) => ({
        x: vector.x * 10,
        y: vector.y * 10,
        z: Math.max(50, (vector.distance ?? 0.5) * 100),
        label: vector.label,
        type: vector.type,
        fill: vector.type === 'secret' ? '#ff4757' : vector.type === 'imposter_clue' ? '#f59e0b' : '#3b82f6',
        distance: vector.distance,
      }));
    }

    const vectors: Array<{
      x: number;
      y: number;
      z: number;
      label: string;
      type: string;
      fill: string;
      distance?: number;
    }> = [
        { x: 0, y: 0, z: 100, label: secretWord, type: 'secret', fill: '#ff4757' },
      ];

    clues.forEach((clue, i) => {
      const isImposterClue = (gameState.imposterIds || []).includes(clue.playerId);
      const angle = (i / Math.max(clues.length, 1)) * Math.PI * 2;
      const distance = (1 - clue.semanticDistance) * 8 + 2;

      vectors.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        z: clue.semanticDistance * 100,
        label: clue.clue,
        type: isImposterClue ? 'imposter_clue' : 'civilian_clue',
        fill: isImposterClue ? '#f59e0b' : '#3b82f6',
        distance: clue.semanticDistance,
      });
    });

    return vectors;
  }, [semanticVectors, clues, secretWord, gameState.imposterIds]);

  const civilianClues = data.filter(d => d.type === 'civilian_clue');
  const imposterClues = data.filter(d => d.type === 'imposter_clue');
  const computedAvgCivilianDistance = useMemo(() => {
    const civilianDistances = civilianClues.map(d => d.distance || 0);
    return civilianDistances.length > 0
      ? civilianDistances.reduce((a, b) => a + b, 0) / civilianDistances.length
      : 0;
  }, [civilianClues]);

  const avgCivilianDistance = gameMetrics.averageCivilianSimilarity ?? computedAvgCivilianDistance;

  return (
    <div className={`glass-panel-strong border rounded-xl p-4 ${isDark ? 'border-white/10' : 'border-slate-300/80 bg-white/85'}`}>
      <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/10' : 'border-slate-300/80'}`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-neon-purple/20">
            <Target className="w-4 h-4 text-neon-purple" />
          </div>
          <div>
            <span className={`font-display text-sm ${isDark ? 'text-white/80' : 'text-slate-800'}`}>Semantic Vector Space</span>
            <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-600'}`}>PCA projection of clue embeddings</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className={isDark ? 'text-white/50' : 'text-slate-600'}>Civilian: {civilianClues.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className={isDark ? 'text-white/50' : 'text-slate-600'}>Imposter: {imposterClues.length}</span>
          </div>
        </div>
      </div>

      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis type="number" dataKey="x" domain={[-12, 12]} hide />
            <YAxis type="number" dataKey="y" domain={[-12, 12]} hide />
            <ZAxis type="number" dataKey="z" range={[50, 400]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload as { label: string; distance?: number };
                  return (
                    <div className={`rounded-lg p-2 text-xs ${isDark ? 'bg-void border border-white/20' : 'bg-white border border-slate-300'}`}>
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.label}</p>
                      {p.distance !== undefined && (
                        <p className="text-neon-purple">
                          Similarity: {(p.distance * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Scatter name="Secret Word" data={[data[0]]} fill="#ff4757">
              <Cell fill="#ff4757" />
            </Scatter>
            <Scatter name="Civilian Clues" data={civilianClues} fill="#3b82f6" />
            <Scatter name="Imposter Clues" data={imposterClues} fill="#f59e0b" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className={`mt-4 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-300/80'}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Brain className="w-3 h-3 text-neon-purple" />
              <span className={isDark ? 'text-white/50' : 'text-slate-600'}>Avg Civilian Similarity:</span>
              <span className={`
                font-mono
                ${avgCivilianDistance > 0.7 ? 'text-red-400' :
                  avgCivilianDistance > 0.5 ? 'text-orange-400' :
                    avgCivilianDistance > 0.3 ? 'text-yellow-400' :
                      'text-green-400'}
              `}>
                {(avgCivilianDistance * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className={isDark ? 'text-white/40' : 'text-slate-600'}>
            {avgCivilianDistance > 0.6 ? 'Information Leakage!' :
              avgCivilianDistance < 0.4 ? 'Coordination Failure' :
                'Optimal Strategy'}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={isDark ? 'text-white/40' : 'text-slate-600'}>Nash Equilibrium Zone</span>
            <span className={isDark ? 'text-white/40' : 'text-slate-600'}>0.4 - 0.6 similarity</span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
            <div
              className={`
                h-full rounded-full transition-all duration-500
                ${avgCivilianDistance >= 0.4 && avgCivilianDistance <= 0.6
                  ? 'bg-green-500 w-full'
                  : avgCivilianDistance < 0.4
                    ? 'bg-yellow-500 w-1/4'
                    : 'bg-red-500 w-full'}
              `}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
          <span className={isDark ? 'text-white/60' : 'text-slate-700'}>Secret Word</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className={isDark ? 'text-white/60' : 'text-slate-700'}>Civilian Clue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className={isDark ? 'text-white/60' : 'text-slate-700'}>Imposter Clue</span>
        </div>
      </div>
    </div>
  );
}
