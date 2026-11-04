/**
 * Match-3's end of a level (src/game/mygame/screens/endOfPlay.ts). The kit's own version of
 * the template's results-preview test: the template ends a level on an end card over the board
 * (and `?screen=results` previews it); match-3 has no end card. A won level says LEVEL n CLEAR!
 * and plays on to the next; the pack's last level or a loss (OUT OF MOVES) goes to results.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActivePack } from '~/game/content';
import { createEndOfPlay } from '~/game/mygame/screens/endOfPlay';
import type { GameDatabase, GamePhase } from '~/game/mygame/sim/plugin';
import type { RunAnalytics } from '~/game/setup/edition-analytics';

const analytics: RunAnalytics = { levelStarted: () => {}, levelWon: () => {}, levelFailed: () => {} };

/** gsap.delayedCall, run by hand: `flush` fires the pending hand-off. */
const clock = vi.hoisted(() => {
  const pending: (() => void)[] = [];
  return {
    pending,
    flush: () => {
      for (const run of pending.splice(0)) run();
    },
  };
});
vi.mock('gsap', () => ({
  default: {
    delayedCall: (_s: number, run: () => void) => {
      clock.pending.push(run);
      return { kill: () => void clock.pending.splice(clock.pending.indexOf(run), 1) };
    },
  },
}));
vi.mock('~/game/setup/progress.save', () => ({ recordLevelWon: vi.fn() }));
vi.mock('~/game/setup/served-session', () => ({ completeActivePack: vi.fn() }));

/** End a run at `level` with `phase`, then let the pause run out. */
function endAt(level: number, phase: GamePhase) {
  const resources = { phase, level, packId: 'p', score: 900 };
  const world = { resources } as unknown as GameDatabase;
  const next = vi.fn();
  const toResults = vi.fn();
  const said: string[] = [];
  const end = createEndOfPlay({
    world: () => world,
    analytics,
    next,
    toResults,
    announce: (text) => said.push(text),
  });
  end.handlePhase(phase);
  clock.flush();
  return { next, toResults, said };
}

describe('match-3 end of a level', () => {
  beforeEach(() => void clock.pending.splice(0));

  it('a won level says CLEAR! and plays straight on to the next', () => {
    const { next, toResults, said } = endAt(0, 'won');
    expect(said).toEqual(['LEVEL 1 CLEAR!']);
    expect(next).toHaveBeenCalledOnce();
    expect(toResults).not.toHaveBeenCalled();
  });

  it("the pack's last level goes to results", () => {
    const { next, toResults } = endAt(getActivePack().levels.length - 1, 'won');
    expect(toResults).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it('a loss says OUT OF MOVES and goes to results', () => {
    const { toResults, said } = endAt(0, 'lost');
    expect(said).toEqual(['OUT OF MOVES']);
    expect(toResults).toHaveBeenCalledOnce();
  });
});
