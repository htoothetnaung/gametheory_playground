import { useState } from 'react';
import { useOfflineGameStore } from '@/store/offlineGameStore';
import { Hand, Eye, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export function SecretCardReveal() {
  const {
    players,
    pickOrder,
    currentPickIndex,
    phase,
    readyToPick,
    flipCard,
    confirmAndPass,
  } = useOfflineGameStore();

  const [isFlipping, setIsFlipping] = useState(false);

  const currentPlayerIdx = pickOrder[currentPickIndex];
  const currentPlayer = players[currentPlayerIdx];
  const pickNumber = currentPickIndex + 1;
  const totalPicks = pickOrder.length;

  if (!currentPlayer) return null;

  const isImposter = currentPlayer.role === 'imposter';

  // Phase: "ready-to-pick" — Tell everyone whose turn it is, they press "I'm Ready"
  if (phase === 'ready-to-pick') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="absolute inset-0 bg-gradient-radial from-neon-purple/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />

        <div className="relative z-10 text-center max-w-md animate-fade-in-up">
          {/* Progress */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-neon-purple/30">
              <Hand className="w-4 h-4 text-neon-purple" />
              <span className="text-sm text-white/70 font-body">
                Card {pickNumber} of {totalPicks}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mx-auto w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-gradient-to-r from-neon-purple to-purple-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((pickNumber - 1) / totalPicks) * 100}%` }}
            />
          </div>

          {/* Pass device message */}
          <div className="glass-panel-strong border border-yellow-500/20 rounded-2xl p-8 mb-8">
            <div className="text-6xl mb-4">{currentPlayer.emoji}</div>
            <div className="text-xs text-yellow-400/60 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Pass the device to
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              {currentPlayer.name}
            </h2>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
              Make sure nobody else is looking at the screen.
              Only <span className="text-white/70 font-semibold">{currentPlayer.name}</span> should see the next card!
            </p>
          </div>

          <button
            onClick={readyToPick}
            className="btn-cyber text-lg px-10 py-4"
          >
            <Eye className="w-5 h-5 inline mr-2" />
            I'm {currentPlayer.name} — Show My Card
          </button>
        </div>
      </div>
    );
  }

  // Phase: "card-reveal" — Show face-down card, tap to flip
  if (phase === 'card-reveal') {
    const handleFlip = () => {
      if (isFlipping) return;
      setIsFlipping(true);
      setTimeout(() => {
        flipCard();
        setIsFlipping(false);
      }, 350);
    };

    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="absolute inset-0 bg-gradient-radial from-neon-purple/5 via-transparent to-transparent" />

        <div className="relative z-10 text-center">
          {/* Player name tag */}
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-white/10">
            <span className="text-xl">{currentPlayer.emoji}</span>
            <span className="text-sm text-white/70 font-body">{currentPlayer.name}'s Card</span>
          </div>

          {/* The face-down card */}
          <div
            className="perspective-1000 cursor-pointer group mx-auto"
            onClick={handleFlip}
          >
            <div
              className={`
                relative w-64 h-96 transition-transform duration-700 preserve-3d
                ${isFlipping ? 'rotate-y-180' : ''}
              `}
            >
              {/* Card Back */}
              <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden">
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-4
                    bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]
                    border-2 border-neon-purple/40 rounded-2xl
                    shadow-[0_0_25px_rgba(168,133,255,0.15)]
                    group-hover:border-neon-purple/70 group-hover:shadow-[0_0_40px_rgba(168,133,255,0.3)]
                    transition-all duration-300"
                >
                  {/* Card pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-4 border border-white/20 rounded-xl" />
                    <div className="absolute inset-8 border border-white/10 rounded-lg" />
                    <div className="absolute inset-12 border border-white/5 rounded-md" />
                  </div>

                  <div className="text-6xl mb-3 animate-pulse-slow">🃏</div>
                  <div className="font-display text-lg text-white/80 tracking-wider">TAP TO</div>
                  <div className="font-display text-2xl text-neon-purple font-bold tracking-widest">REVEAL</div>

                  {/* Glowing corner accents */}
                  <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-neon-purple/50 rounded-tl-lg" />
                  <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-neon-purple/50 rounded-tr-lg" />
                  <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-neon-purple/50 rounded-bl-lg" />
                  <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-neon-purple/50 rounded-br-lg" />
                </div>
              </div>
            </div>
          </div>

          <p className="text-white/30 text-sm mt-6">Tap the card to see your role</p>
        </div>
      </div>
    );
  }

  // Phase: "card-shown" — Card revealed, player sees their role
  if (phase === 'card-shown') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div
          className={`absolute inset-0 bg-gradient-radial ${
            isImposter ? 'from-red-500/8' : 'from-emerald-500/8'
          } via-transparent to-transparent`}
        />

        <div className="relative z-10 text-center animate-fade-in-up">
          {/* Player name */}
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-white/10">
            <span className="text-xl">{currentPlayer.emoji}</span>
            <span className="text-sm text-white/70 font-body">{currentPlayer.name}</span>
          </div>

          {/* The revealed card */}
          <div className="mx-auto w-64 h-96 rounded-2xl overflow-hidden mb-8">
            <div
              className={`w-full h-full flex flex-col items-center justify-center gap-3 rounded-2xl
                border-2 transition-all duration-500
                ${isImposter
                  ? 'bg-gradient-to-br from-red-950 via-red-900/90 to-orange-950 border-red-500/60 shadow-[0_0_35px_rgba(239,68,68,0.3)]'
                  : 'bg-gradient-to-br from-emerald-950 via-emerald-900/90 to-teal-950 border-emerald-500/60 shadow-[0_0_35px_rgba(16,185,129,0.3)]'
                }`}
            >
              {/* Role badge */}
              <div
                className={`px-5 py-2 rounded-full text-sm font-display font-bold tracking-widest uppercase
                  ${isImposter
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
              >
                {isImposter ? '🔥 Imposter' : '🛡️ Civilian'}
              </div>

              {/* Emoji */}
              <div className="text-5xl my-2">{currentPlayer.emoji}</div>

              {/* Word or Hint */}
              <div className="mt-2 text-center px-4">
                {isImposter ? (
                  <>
                    <div className="text-xs text-red-300/60 uppercase tracking-wider mb-1">Your Hint</div>
                    <div className="text-3xl font-display font-bold text-red-300 tracking-wider">
                      {currentPlayer.hint}
                    </div>
                    <div className="text-xs text-red-300/50 mt-3 leading-relaxed">
                      You don't know the exact word!<br />Blend in with the civilians.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-emerald-300/60 uppercase tracking-wider mb-1">Secret Word</div>
                    <div className="text-3xl font-display font-bold text-emerald-300 tracking-wider">
                      {currentPlayer.word}
                    </div>
                    <div className="text-xs text-emerald-300/50 mt-3 leading-relaxed">
                      Give clues without being<br />too obvious!
                    </div>
                  </>
                )}
              </div>

              {/* Corner accents */}
              <div className={`absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 rounded-tl-lg ${isImposter ? 'border-red-500/40' : 'border-emerald-500/40'}`} />
              <div className={`absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 rounded-tr-lg ${isImposter ? 'border-red-500/40' : 'border-emerald-500/40'}`} />
              <div className={`absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 rounded-bl-lg ${isImposter ? 'border-red-500/40' : 'border-emerald-500/40'}`} />
              <div className={`absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 rounded-br-lg ${isImposter ? 'border-red-500/40' : 'border-emerald-500/40'}`} />
            </div>
          </div>

          {/* Warning */}
          <div className="glass-panel border border-yellow-500/20 rounded-xl px-5 py-3 mb-6 max-w-xs mx-auto">
            <div className="flex items-center gap-2 justify-center">
              <ShieldCheck className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-300/70">Memorize your role, then pass the device!</span>
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={confirmAndPass}
            className="btn-cyber text-base px-10 py-3"
          >
            <ChevronRight className="w-5 h-5 inline mr-1" />
            {currentPickIndex + 1 < pickOrder.length
              ? 'Got It — Pass to Next Player'
              : 'Got It — Start Discussion!'
            }
          </button>
        </div>
      </div>
    );
  }

  return null;
}
