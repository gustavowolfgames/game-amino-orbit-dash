// catalog: screen-results-dom for the win/lose outcome (stars, score count-up, buttons)
import { ScreenResults } from '@wolfgames/components/modules/prefabs/screen-results-dom';
import { useScreen } from '~/core/systems/screens';
import { getActivePack } from '~/game/content';
import { starsFor } from '~/game/mygame/sim/rules/scoring';
import { getGameWorld } from '~/game/mygame/world';
import { whenContentSettled } from '~/game/setup/content';

/**
 * Results — shown after the pack's last level is won (total score + 1–3 stars)
 * or when a level runs out of moves (Retry restarts that level). Wins between
 * levels never come here: the game screen plays straight on.
 */
export function ResultsScreen() {
  const { goto } = useScreen();

  // Read the final state straight from the app-scoped ECS world — the single
  // source of truth. It's final by the time this screen shows; a plain read is
  // correct (no signals clipboard). The next run starts on game-screen init:
  // after a loss it restarts the same level, after the last win level 1.
  const { score, bankedScore, level, phase } = getGameWorld().resources;
  const won = phase === 'won';
  const levelCount = getActivePack().levels.length;
  const packDone = won && level >= levelCount - 1;
  const total = bankedScore + score;

  // A finished pack in the Vault's unlocked walk has started loading the next edition
  // (src/game/setup/served-session.ts); wait for it (bounded) so the next run starts there.
  // Otherwise the settled promise is already resolved.
  const handlePrimary = async () => {
    await whenContentSettled();
    goto('game');
  };

  return (
    <div class="design-box-span pointer-events-auto">
      <ScreenResults
        variant={won ? 'win' : 'lose'}
        starsEarned={won ? Math.max(1, starsFor(total)) : 0}
        score={total}
        headlineLine1={
          packDone ? 'ALL LEVELS' : won ? `LEVEL ${level + 1}` : 'OUT OF MOVES'
        }
        headlineLine2={won ? 'COMPLETE!' : `LEVEL ${level + 1}`}
        primaryLabel={won ? (packDone ? 'PLAY AGAIN' : 'NEXT LEVEL') : 'RETRY'}
        secondaryLabel="MAIN MENU"
        onPrimary={handlePrimary}
        onSecondary={() => goto('start')}
      />
    </div>
  );
}
