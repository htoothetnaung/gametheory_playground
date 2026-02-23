import { useState, useEffect } from 'react';
import { useOfflineGameStore, MIN_PLAYERS, MAX_PLAYERS } from '@/store/offlineGameStore';
import { Users, UserPlus, Shuffle, ArrowLeft, Minus, Plus } from 'lucide-react';

interface NameEntryProps {
  onBack: () => void;
}

const PLAYER_EMOJIS = ['🦊', '🐺', '🦁', '🐸', '🦉', '🐙', '🦅', '🐯', '🐨', '🦋', '🐬', '🦖'];

export function NameEntry({ onBack }: NameEntryProps) {
  const { totalPlayers, setTotalPlayers, setPlayerNames, startGame } = useOfflineGameStore();
  const [names, setNames] = useState<string[]>(Array(totalPlayers).fill(''));
  const [error, setError] = useState('');

  // Sync names array when totalPlayers changes
  useEffect(() => {
    setNames((prev) => {
      if (prev.length === totalPlayers) return prev;
      if (prev.length < totalPlayers) {
        return [...prev, ...Array(totalPlayers - prev.length).fill('')];
      }
      return prev.slice(0, totalPlayers);
    });
  }, [totalPlayers]);

  const handleCountChange = (delta: number) => {
    setTotalPlayers(totalPlayers + delta);
    setError('');
  };

  const handleNameChange = (index: number, value: string) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
    setError('');
  };

  const handleStart = () => {
    const trimmed = names.map((n) => n.trim());
    if (trimmed.some((n) => n === '')) {
      setError('All players must enter their names!');
      return;
    }
    const unique = new Set(trimmed.map((n) => n.toLowerCase()));
    if (unique.size !== trimmed.length) {
      setError('Each player must have a unique name!');
      return;
    }
    setPlayerNames(trimmed);
    startGame();
  };

  const allFilled = names.every((n) => n.trim() !== '');

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-radial from-neon-purple/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />

      <div className="relative z-10 w-full max-w-lg px-4 pt-8 pb-10">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-body">Back to Menu</span>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-neon-purple/30 mb-4">
            <UserPlus className="w-4 h-4 text-neon-purple" />
            <span className="text-sm text-white/70 font-body">Setup Your Game</span>
          </div>

          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Who's <span className="gradient-text">Playing</span>?
          </h2>
          <p className="text-white/40 font-body text-base">
            {totalPlayers} players — {totalPlayers - 1} civilians, 1 secret imposter
          </p>
        </div>

        {/* Player count selector */}
        <div className="glass-panel-strong border border-neon-purple/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/70 font-display">Number of Players</div>
              <div className="text-xs text-white/30 font-body mt-0.5">{MIN_PLAYERS}–{MAX_PLAYERS} players supported</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCountChange(-1)}
                disabled={totalPlayers <= MIN_PLAYERS}
                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                  totalPlayers <= MIN_PLAYERS
                    ? 'border-white/5 text-white/15 cursor-not-allowed'
                    : 'border-white/20 text-white/70 hover:border-neon-purple/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-display text-2xl text-neon-purple font-bold w-8 text-center">{totalPlayers}</span>
              <button
                onClick={() => handleCountChange(1)}
                disabled={totalPlayers >= MAX_PLAYERS}
                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                  totalPlayers >= MAX_PLAYERS
                    ? 'border-white/5 text-white/15 cursor-not-allowed'
                    : 'border-white/20 text-white/70 hover:border-neon-purple/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Name inputs */}
        <div className="space-y-3 mb-6 max-h-[45vh] overflow-y-auto pr-1 custom-scroll">
          {names.map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-3 glass-panel border border-white/10 rounded-xl px-4 py-3 transition-all focus-within:border-neon-purple/50 focus-within:shadow-[0_0_15px_rgba(168,133,255,0.15)]"
            >
              <span className="text-2xl">{PLAYER_EMOJIS[i % PLAYER_EMOJIS.length]}</span>
              <div className="flex-1">
                <label className="text-xs text-white/30 font-mono block mb-0.5">
                  Player {i + 1}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder={`Enter name...`}
                  maxLength={20}
                  className="w-full bg-transparent text-white/90 font-body text-lg outline-none placeholder:text-white/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (i < totalPlayers - 1) {
                        const next = document.querySelector(`input[data-idx="${i + 1}"]`) as HTMLInputElement;
                        next?.focus();
                      } else if (allFilled) {
                        handleStart();
                      }
                    }
                  }}
                  data-idx={i}
                  autoFocus={i === 0}
                />
              </div>
              {name.trim() && (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="text-center mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Player count */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Users className="w-4 h-4 text-white/30" />
          <span className="text-sm text-white/30 font-mono">
            {names.filter((n) => n.trim()).length} / {totalPlayers} ready
          </span>
        </div>

        {/* Start button */}
        <div className="text-center">
          <button
            onClick={handleStart}
            disabled={!allFilled}
            className={`btn-cyber text-lg px-12 py-4 transition-all ${
              !allFilled ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <Shuffle className="w-5 h-5 inline mr-2" />
            Shuffle Roles & Start
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/25 max-w-sm mx-auto leading-relaxed">
            Roles will be randomly assigned. The turn order for picking cards
            will also be randomized. Pass the device to each player secretly!
          </p>
        </div>
      </div>
    </div>
  );
}
