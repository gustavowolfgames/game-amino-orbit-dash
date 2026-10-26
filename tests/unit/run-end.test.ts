/**
 * The controller's end-of-run guard (src/game/mygame/screens/runEnd.ts): a terminal phase hands
 * off once, after the pause; a run restarted during the pause (an agent calling `start` on the
 * live world) cancels the hand-off and re-arms the guard for the new run's own end.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createRunEnd } from '~/game/mygame/screens/runEnd';
import { disposeGameWorld, getGameWorld } from '~/game/mygame/world';

/** A hand-run clock in place of gsap.delayedCall. */
function fakeClock() {
  const calls: { run: () => void; killed: boolean }[] = [];
  return {
    schedule: (_s: number, run: () => void) => {
      const c = { run, killed: false };
      calls.push(c);
      return { kill: () => void (c.killed = true) };
    },
    /** Fire every pending call that was not killed. */
    flush: () => {
      for (const c of calls.splice(0)) if (!c.killed) c.run();
    },
  };
}

afterEach(() => disposeGameWorld());

describe('createRunEnd', () => {
  it('a terminal phase runs onEnd once and hands off after the pause', () => {
    const clock = fakeClock();
    const ends: string[] = [];
    const handoffs: string[] = [];
    const runEnd = createRunEnd({
      pause: 0.9,
      onEnd: (p) => ends.push(p),
      afterPause: (p) => handoffs.push(p),
      schedule: clock.schedule,
    });
    runEnd.update('playing');
    runEnd.update('lost');
    runEnd.update('lost');
    expect(ends).toEqual(['lost']);
    expect(handoffs).toEqual([]);
    clock.flush();
    expect(handoffs).toEqual(['lost']);
  });

  it('an agent restart during the pause cancels the hand-off, and the next end is handled', async () => {
    const clock = fakeClock();
    const handoffs: string[] = [];
    const runEnd = createRunEnd({
      pause: 0.9,
      afterPause: (p) => handoffs.push(p),
      schedule: clock.schedule,
    });
    const db = getGameWorld();
    await db.services.agent.execute('start', {});
    db.transactions.setPhase('lost');
    runEnd.update(db.resources.phase); // frame: the run ended, hand-off queued

    await db.services.agent.execute('start', {}); // agent restarts inside END_PAUSE
    runEnd.update(db.resources.phase); // frame: playing again
    clock.flush();
    expect(handoffs).toEqual([]); // the restarted run is not sent to results

    db.transactions.setPhase('lost'); // the new run ends the same way
    runEnd.update(db.resources.phase);
    clock.flush();
    expect(handoffs).toEqual(['lost']);
  });

  it('reset (teardown) cancels a pending hand-off', () => {
    const clock = fakeClock();
    const handoffs: string[] = [];
    const runEnd = createRunEnd({
      pause: 0.9,
      afterPause: (p) => handoffs.push(p),
      schedule: clock.schedule,
    });
    runEnd.update('won');
    runEnd.reset();
    clock.flush();
    expect(handoffs).toEqual([]);
  });
});
