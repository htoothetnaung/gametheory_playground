import { useGameStore } from '@/store/gameStore';
import { Eye, Terminal } from 'lucide-react';
import type { ViewMode } from '@/types';

export function ViewToggle() {
  const { viewMode, setViewMode } = useGameStore();
  
  const modes: { id: ViewMode; label: string; icon: typeof Eye }[] = [
    { id: 'theater', label: 'Theater', icon: Eye },
    { id: 'god', label: 'God Mode', icon: Terminal },
  ];
  
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg glass-panel border border-white/10">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = viewMode === mode.id;
        
        return (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-300
              ${isActive 
                ? 'bg-neon-purple text-white shadow-neon' 
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
