import { useGameStore } from '@/store/gameStore';
import { MessageSquare, Vote, Brain, Trophy } from 'lucide-react';

export function PhaseIndicator() {
  const { gameState } = useGameStore();
  const { phase } = gameState;
  
  const phaseConfig = {
    clue_giving: {
      icon: MessageSquare,
      label: 'CLUE GIVING',
      description: 'Players give semantic clues',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/30',
    },
    voting: {
      icon: Vote,
      label: 'VOTING PHASE',
      description: 'Vote for the imposter',
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/10',
      borderColor: 'border-orange-400/30',
    },
    imposter_guess: {
      icon: Brain,
      label: 'IMPOSTER GUESS',
      description: 'Imposter tries to guess the word',
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      borderColor: 'border-red-400/30',
    },
    ended: {
      icon: Trophy,
      label: 'GAME ENDED',
      description: 'See the results',
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/30',
    },
  };
  
  const config = phaseConfig[phase];
  const Icon = config.icon;
  
  return (
    <div className={`
      flex items-center gap-3 px-4 py-3 rounded-xl
      glass-panel border ${config.borderColor}
      animate-fade-in
    `}>
      <div className={`p-2 rounded-lg ${config.bgColor}`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>
      <div>
        <p className={`font-display text-sm font-semibold ${config.color}`}>
          {config.label}
        </p>
        <p className="text-xs text-white/50">
          {config.description}
        </p>
      </div>
    </div>
  );
}
