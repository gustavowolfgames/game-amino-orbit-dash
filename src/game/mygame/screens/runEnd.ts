/**
 * runEnd — the controller's guard on the end of a run.
 *
 * Fed the world's phase every frame. The first frame of a terminal phase (`won` / `lost`) runs
 * `onEnd` once and schedules `afterPause` (the hand-off) after `pause` seconds. A run that starts
 * again before then — the player, or an agent calling `start` on the live world — cancels that
 * hand-off and re-arms the guard, so the new run's own end is handled and the old one never
 * sends it to results.
 */

import gsap from 'gsap';

import type { GamePhase } from '../sim/plugin';

type Terminal = Exclude<GamePhase, 'playing' | 'idle'>;

export interface RunEndOptions {
  /** Seconds between the terminal phase and `afterPause`, so the last frame reads. */
  pause: number;
  /** Runs once, on the first frame of a terminal phase. */
  onEnd?: (phase: Terminal) => void;
  /** The hand-off; skipped if a new run starts during the pause. */
  afterPause: (phase: Terminal) => void;
  /** Delayed call (GSAP by default; tests pass their own). */
  schedule?: (seconds: number, run: () => void) => { kill: () => void };
}

export interface RunEnd {
  /** Feed the current phase (every frame). */
  update: (phase: GamePhase) => void;
  /** Cancel a pending hand-off and re-arm (a new run, or teardown). */
  reset: () => void;
}

export function createRunEnd(options: RunEndOptions): RunEnd {
  const schedule =
    options.schedule ??
    ((seconds: number, run: () => void) => gsap.delayedCall(seconds, run));
  let handled: Terminal | null = null;
  let pending: { kill: () => void } | null = null;

  const reset = () => {
    pending?.kill();
    pending = null;
    handled = null;
  };

  return {
    reset,
    update(phase) {
      if (phase === 'playing' || phase === 'idle') {
        if (handled) reset(); // a new run began during the pause
        return;
      }
      if (phase === handled) return;
      handled = phase;
      options.onEnd?.(phase);
      pending = schedule(options.pause, () => {
        pending = null;
        options.afterPause(phase);
      });
    },
  };
}
