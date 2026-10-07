import { useScreen } from '~/core/systems/screens';
import { Button } from '~/core/ui/Button';
import { getActivePack } from '~/game/content';
import { getGameWorld } from '~/game/mygame/world';

export function ResultsScreen() {
  const { goto } = useScreen();

  // Read the final score straight from the app-scoped ECS world — the single
  // source of truth. It's final by the time this screen shows; a plain read is
  // correct (no signals clipboard). The next run resets on game-screen init.
  const { score, level, phase } = getGameWorld().resources;
  const won = phase === 'won';
  const packDone = won && level >= getActivePack().levels.length - 1;

  const handlePlayAgain = () => {
    goto('game');
  };

  const handleMainMenu = () => {
    goto('start');
  };

  // Colours and type come from the brand theme's CSS variables (src/game/brand/theme.ts),
  // so a published partner sheet restyles this screen with no code change.
  return (
    <div
      class="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--brand-ground)', color: 'var(--brand-text)', 'font-family': 'var(--font-body)' }}
    >
      <h1 class="text-3xl font-bold mb-2" style={{ 'font-family': 'var(--font-display)' }}>
        {packDone ? 'Pack Complete' : won ? `Level ${level + 1} Complete` : 'Game Over'}
      </h1>

      <div class="text-center mb-8">
        <p class="text-sm mb-1" style={{ color: 'var(--brand-muted)' }}>Score</p>
        <p class="text-5xl font-bold" style={{ color: 'var(--brand-accent)', 'font-family': 'var(--font-numeric)' }}>
          {score}
        </p>
      </div>

      <div class="flex gap-4">
        <Button onClick={handlePlayAgain}>
          {won && !packDone ? 'Next Level' : 'Play Again'}
        </Button>
        <Button variant="secondary" onClick={handleMainMenu}>
          Main Menu
        </Button>
      </div>
    </div>
  );
}
