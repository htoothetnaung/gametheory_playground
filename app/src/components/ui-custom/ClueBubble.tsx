import { useEffect, useState } from 'react';
import type { Clue } from '@/types';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ClueBubbleProps {
  clue: Clue;
  position: { x: number; y: number };
  onComplete?: () => void;
}

export function ClueBubble({ clue, position, onComplete }: ClueBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      setIsAnimating(true);
    }, 100);
    
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 500);
    }, 4000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);
  
  const getRiskConfig = () => {
    switch (clue.riskLevel) {
      case 'dangerous':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-950/80',
          borderColor: 'border-red-500/50',
          icon: AlertTriangle,
          glow: 'shadow-red-500/30',
        };
      case 'risky':
        return {
          color: 'text-orange-400',
          bgColor: 'bg-orange-950/80',
          borderColor: 'border-orange-500/50',
          icon: AlertTriangle,
          glow: 'shadow-orange-500/30',
        };
      case 'moderate':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-950/80',
          borderColor: 'border-yellow-500/50',
          icon: Info,
          glow: 'shadow-yellow-500/30',
        };
      default:
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-950/80',
          borderColor: 'border-green-500/50',
          icon: CheckCircle,
          glow: 'shadow-green-500/30',
        };
    }
  };
  
  const config = getRiskConfig();
  const Icon = config.icon;
  
  return (
    <div
      className={`
        absolute pointer-events-none z-50
        transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
      `}
      style={{
        left: position.x,
        top: position.y,
        transform: isAnimating ? 'translateY(-20px)' : 'translateY(0)',
      }}
    >
      <div className={`
        px-4 py-3 rounded-xl backdrop-blur-xl
        ${config.bgColor} ${config.borderColor}
        border shadow-lg ${config.glow}
        min-w-[180px] max-w-[280px]
      `}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-xs font-mono uppercase ${config.color}`}>
            {clue.riskLevel}
          </span>
          <span className="ml-auto text-xs text-white/40 font-mono">
            {(clue.semanticDistance * 100).toFixed(0)}%
          </span>
        </div>
        
        <p className="text-white font-medium text-lg leading-tight">
          &quot;{clue.clue}&quot;
        </p>
        
        <p className="text-white/50 text-xs mt-2">
          — {clue.playerName}
        </p>
        
        <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`
              h-full rounded-full transition-all duration-1000
              ${clue.riskLevel === 'dangerous' ? 'bg-red-500 w-full' :
                clue.riskLevel === 'risky' ? 'bg-orange-500 w-3/4' :
                clue.riskLevel === 'moderate' ? 'bg-yellow-500 w-1/2' :
                'bg-green-500 w-1/4'}
            `}
          />
        </div>
      </div>
      
      <div 
        className={`
          absolute -bottom-2 left-1/2 -translate-x-1/2
          w-4 h-4 rotate-45
          ${config.bgColor} ${config.borderColor}
          border-r border-b
        `} 
      />
    </div>
  );
}
