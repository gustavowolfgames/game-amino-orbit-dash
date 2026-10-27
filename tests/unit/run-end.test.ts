/**
 * The controller's end-of-run guard (src/game/mygame/screens/runEnd.ts): a terminal phase hands
 * off once, after the pause; a run restarted during the pause (an agent calling `start`) cancels
 * the hand-off and re-arms the guard for the new run's own end.
 */
import { describe, expect, it } from 'vitest';
import { createGameAgentWorld } from '~/game/mygame/agent/agentPlugin';
import { createRunEnd } from '~/game/mygame/screens/runEnd';
import type { GamePhase } from '~/game/mygame/sim/plugin';

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
    const db = createGameAgentWorld();
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

  it('a second end inside the pause replaces the first hand-off, so a restart cancels both', () => {
    const clock = fakeClock();
    const handoffs: string[] = [];
    const runEnd = createRunEnd({
      pause: 0.9,
      afterPause: (p) => handoffs.push(p),
      schedule: clock.schedule,
    });
    runEnd.update('lost');
    runEnd.update('won'); // lost → won inside the pause
    runEnd.update('playing'); // restart: reset kills the pending hand-off
    clock.flush();
    expect(handoffs).toEqual([]); // the first call was not orphaned

    runEnd.update('lost');
    runEnd.update('won');
    clock.flush();
    expect(handoffs).toEqual(['won']); // one hand-off, the latest end
  });

  it('a restart after the last render, before the delayed call fires, is not sent to results', () => {
    const clock = fakeClock();
    const handoffs: string[] = [];
    let phase: GamePhase = 'playing';
    const runEnd = createRunEnd({
      pause: 0.9,
      afterPause: (p) => handoffs.push(p),
      phase: () => phase,
      schedule: clock.schedule,
    });
    phase = 'lost';
    runEnd.update(phase); // frame: hand-off queued
    phase = 'playing'; // a restart lands after that render
    clock.flush(); // the pause runs out before the next render
    expect(handoffs).toEqual([]);

    runEnd.update(phase); // next frame re-arms the guard
    phase = 'lost';
    runEnd.update(phase);
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

  it('a pause getter is read at each end (a live-tuned win hold)', () => {
    const waits: number[] = [];
    let hold = 1.7;
    const runEnd = createRunEnd({
      pause: () => hold,
      afterPause: () => {},
      schedule: (s) => {
        waits.push(s);
        return { kill: () => {} };
      },
    });
    runEnd.update('won');
    hold = 0.9;
    runEnd.update('playing');
    runEnd.update('lost');
    expect(waits).toEqual([1.7, 0.9]);
  });
});
