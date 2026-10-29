/**
 * endOfPlay — what happens when a match-3 level ends, kept out of the controller so it
 * stays thin.
 *
 *   • A won level records progress and says LEVEL n CLEAR!; the pack's last level
 *     reports the edition complete to the Vault (`completeActivePack`).
 *   • A lost level (out of moves) reports the failure and says OUT OF MOVES.
 *   • After a beat, a won level that is not the pack's last plays straight on to the
 *     next (`next`); the last win and a loss go to results (`toResults`).
 *
 * Built on `./runEnd.ts`: once per terminal phase, and a run restarted during the pause
 * (an agent's `start`, the Inspector's restart) cancels the hand-off. The controller
 * calls `handlePhase` from its per-frame render once the board has settled, `reset`
 * from `startRun`, and `destroy` on teardown.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { isLastLevel } from '~/game/content';
import type { RunAnalytics } from '~/game/setup/edition-analytics';
import { recordLevelWon } from '~/game/setup/progress';
import { completeActivePack } from '~/game/setup/served-session';
import type { GameDatabase, GamePhase } from '../sim/plugin';
import { createRunEnd } from './runEnd';

/** Delay (s) before handing off to results, so the last frame reads. */
export const END_PAUSE = 0.9;
/** The pause is this much longer between levels, so the CLEAR! banner reads. */
const NEXT_LEVEL_HOLD = 1.6;

export interface EndOfPlayDeps {
  /** The world, or null once the controller is torn down. */
  world: () => GameDatabase | null;
  analytics: RunAnalytics;
  /** The HUD's centre-screen banner. */
  announce: (text: string, y: number) => void;
  /** Start the next level (the controller's `startRun`). */
  next: () => void;
  /** Leave for the results screen. */
  toResults: () => void;
}

export interface EndOfPlay {
  /** Called every frame with the run's phase; acts once per terminal phase. */
  handlePhase(phase: GamePhase): void;
  /** A run started: forget the last end and cancel a pending hand-off. */
  reset(): void;
  destroy(): void;
}

export function createEndOfPlay(deps: EndOfPlayDeps): EndOfPlay {
  let destroyed = false;
  /** A won level that is not the pack's last plays straight on to the next. */
  let advance = false;

  const runEnd = createRunEnd({
    pause: () => END_PAUSE * (advance ? NEXT_LEVEL_HOLD : 1),
    phase: () => deps.world()?.resources.phase ?? 'idle',
    onEnd: (phase) => {
      advance = false;
      const db = deps.world();
      if (!db) return;
      const { level, packId, score } = db.resources;
      const y = DESIGN_CANVAS.height / 2;
      if (phase === 'won') {
        const last = isLastLevel(level);
        advance = !last;
        deps.analytics.levelWon(level, score);
        if (last) completeActivePack(); // the Vault served mode decides what a finished pack means
        recordLevelWon(packId, level, last); // reload resumes the next level
        deps.announce(`LEVEL ${level + 1} CLEAR!`, y);
      } else {
        deps.analytics.levelFailed(level, 'out_of_moves');
        deps.announce('OUT OF MOVES', y);
      }
    },
    afterPause: () => {
      if (destroyed) return;
      // Between levels play straight on; the last win and a loss go to results.
      if (advance) deps.next();
      else deps.toResults();
    },
  });

  return {
    handlePhase: (phase) => runEnd.update(phase),
    reset: () => runEnd.reset(),
    destroy() {
      destroyed = true;
      runEnd.reset();
    },
  };
}
