/**
 * endOfPlay — what happens when a ball sort level ends, kept out of the controller so
 * it stays thin.
 *
 *   • A won level records progress and reports analytics with the level's move count
 *     (ball sort has no score: `moves` against the level's `par` is how well it went);
 *     the pack's last level reports the edition complete to the Vault
 *     (`completeActivePack`).
 *   • After a beat, a won level that is not the pack's last starts the next (`next`);
 *     the last one, or a `lost` phase, goes to results (`toResults`). A stuck board is
 *     not an end: it stays in play with Retry.
 *
 * Built on `./runEnd.ts`: once per terminal phase, and a run restarted during the pause
 * (an agent's `start`, the Inspector's restart) cancels the hand-off. The controller
 * calls `handlePhase` from its per-frame render, `reset` from `startRun`, and `destroy`
 * on teardown.
 */

import { isLastLevel } from '~/game/content';
import type { RunAnalytics } from '~/game/setup/edition-analytics';
import { recordLevelWon } from '~/game/setup/progress.save';
import { completeActivePack } from '~/game/setup/served-session';
import type { GameDatabase, GamePhase } from '../sim/plugin';
import { createRunEnd } from './runEnd';

/** Delay (s) before the next level or results, so the last frame reads. */
export const END_PAUSE = 0.9;

export interface EndOfPlayDeps {
  /** The world, or null once the controller is torn down. */
  world: () => GameDatabase | null;
  analytics: RunAnalytics;
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
  /** The level that just ended was the pack's last. */
  let last = false;

  const runEnd = createRunEnd({
    pause: END_PAUSE,
    phase: () => deps.world()?.resources.phase ?? 'idle',
    onEnd: (phase) => {
      const db = deps.world();
      last = !!db && isLastLevel(db.resources.level);
      if (phase !== 'won' || !db) return;
      const { level, packId, moves } = db.resources;
      deps.analytics.levelWon(level, moves);
      if (last) completeActivePack(); // the Vault served mode decides what a finished pack means
      recordLevelWon(packId, level, last); // reload resumes the next level
    },
    afterPause: (phase) => {
      if (destroyed) return;
      // A won level goes straight to the next one; the last one (or a loss) to results.
      if (phase === 'won' && !last) deps.next();
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
