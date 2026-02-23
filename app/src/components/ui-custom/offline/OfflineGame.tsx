import { useOfflineGameStore } from '@/store/offlineGameStore';
import { NameEntry } from './NameEntry';
import { SecretCardReveal } from './SecretCardReveal';
import { AllRevealed } from './AllRevealed';

interface OfflineGameProps {
  onBackToMenu: () => void;
}

export function OfflineGame({ onBackToMenu }: OfflineGameProps) {
  const { phase, resetGame } = useOfflineGameStore();

  const handleBackToMenu = () => {
    resetGame();
    onBackToMenu();
  };

  switch (phase) {
    case 'name-entry':
      return <NameEntry onBack={handleBackToMenu} />;

    case 'ready-to-pick':
    case 'card-reveal':
    case 'card-shown':
      return <SecretCardReveal />;

    case 'all-revealed':
      return <AllRevealed onBackToMenu={handleBackToMenu} />;

    default:
      return <NameEntry onBack={handleBackToMenu} />;
  }
}
