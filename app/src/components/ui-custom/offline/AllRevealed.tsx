import { useOfflineGameStore } from '@/store/offlineGameStore';
import { Trophy, RotateCcw, Home, Users, MessageCircle } from 'lucide-react';

interface AllRevealedProps {
  onBackToMenu: () => void;
}

export function AllRevealed({ onBackToMenu }: AllRevealedProps) {
  const { players, currentWord, startGame, backToNameEntry } = useOfflineGameStore();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-neon-purple/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-15" />

      <div className="relative z-10 w-full max-w-2xl px-4 pt-10 pb-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-emerald-500/30 mb-4">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300/80 font-body">Everyone Has Their Card!</span>
          </div>

          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Time to <span className="gradient-text">Discuss</span>
          </h2>
          <p className="text-white/40 font-body text-base max-w-md mx-auto">
            Everyone knows their role. Now give clues, ask questions, and try to
            find the imposter!
          </p>
        </div>

        {/* How to play reminder */}
        <div className="glass-panel-strong border border-neon-purple/20 rounded-2xl p-5 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4 text-neon-purple" />
            <span className="text-sm font-display text-white/80">How To Play</span>
          </div>
          <ol className="text-sm text-white/50 space-y-2 font-body list-decimal list-inside">
            <li>Each player takes turns giving a <span className="text-white/70">one-word clue</span> related to their word</li>
            <li>Civilians know the word — try to prove it <span className="text-white/70">without being too obvious</span></li>
            <li>The imposter only has a hint — they must <span className="text-white/70">blend in</span></li>
            <li>After all clues, <span className="text-white/70">discuss and vote</span> to eliminate the suspected imposter</li>
            <li><span className="text-emerald-400">Civilians win</span> if they find the imposter. <span className="text-red-400">Imposter wins</span> if they survive!</li>
          </ol>
        </div>

        {/* Players list (no roles shown!) */}
        <div className="glass-panel border border-white/10 rounded-2xl p-5 mb-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-white/50" />
            <span className="text-sm font-display text-white/70">Players in This Round</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5"
              >
                <span className="text-xl">{player.emoji}</span>
                <span className="text-sm text-white/70 font-body">{player.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/25 mt-3 text-center">
            Category hint: <span className="text-white/40 font-mono">{currentWord?.category}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <button
            onClick={startGame}
            className="btn-cyber text-base px-10 py-3"
          >
            <RotateCcw className="w-4 h-4 inline mr-2" />
            Play Again (Same Players)
          </button>
          <button
            onClick={backToNameEntry}
            className="px-8 py-3 rounded-lg glass-panel border border-white/20 text-white/60 hover:text-white/90 hover:border-white/40 transition-all font-display text-sm"
          >
            <Users className="w-4 h-4 inline mr-2" />
            Change Players
          </button>
          <button
            onClick={onBackToMenu}
            className="px-8 py-3 rounded-lg glass-panel border border-white/20 text-white/60 hover:text-white/90 hover:border-white/40 transition-all font-display text-sm"
          >
            <Home className="w-4 h-4 inline mr-2" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
