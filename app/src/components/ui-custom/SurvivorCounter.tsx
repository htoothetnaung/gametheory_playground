import { useGameStore } from '@/store/gameStore';
import { Users, UserX } from 'lucide-react';

export function SurvivorCounter() {
  const { gameState } = useGameStore();
  const { players } = gameState;
  const survivors = players.filter(p => p.isAlive).length;
  const eliminated = players.length - survivors;
  
  return (
    <div className="flex items-center gap-4">
      {/* Survivors */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg glass-panel border border-white/10">
        <div className="p-1.5 rounded-full bg-green-500/20">
          <Users className="w-4 h-4 text-green-500" />
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider">Alive</p>
          <p className="font-display text-lg font-bold text-white">
            {survivors}<span className="text-white/30">/10</span>
          </p>
        </div>
      </div>
      
      {/* Eliminated */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg glass-panel border border-white/10">
        <div className="p-1.5 rounded-full bg-red-500/20">
          <UserX className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider">Eliminated</p>
          <p className="font-display text-lg font-bold text-red-400">
            {eliminated}
          </p>
        </div>
      </div>
    </div>
  );
}
