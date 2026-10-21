/**
 * cues — sim events become feedback, declared as a table.
 *
 * Each frame the controller drains the sim's events (`../sim/events.ts`) and
 * hands them here. The table says, per event type, what the player hears, what
 * the screen reader says, and what else reacts (a HUD flash, a view's burst):
 *
 *   const cues = createCues<GameEvent, Sfx>(
 *     {
 *       hit: { sfx: 'sfx-thud', gapMs: 80 },               // at most one thud per 80 ms
 *       lap: { sfx: 'sfx-cheer', aria: (e) => `Lap ${e.n}.`, run: (e) => hud.flash(e.n) },
 *       phase: { sfx: (e) => (e.phase === 'won' ? 'sfx-win' : null) },
 *     },
 *     { play: audio.play, say: setAriaText },
 *   );
 *   // in render: cues(drainEvents(db), db.resources.elapsedMs);
 *
 * `gapMs` throttles a cue's sound against sim time (the `nowMs` you pass), so
 * a burst of hits in one frame plays one sound, and a replay throttles the
 * same way. The screen-reader line says only the last text of a batch. No DOM,
 * no timers.
 */

import type { GameEventBase } from '../sim/events';

/** What one kind of event does. Every field is optional. */
export interface Cue<E extends GameEventBase, S extends string> {
  /** Sound to play: a channel, or pick one per event (null: none). */
  sfx?: S | ((event: E) => S | null | undefined);
  /** Loudness of that sound (0–1). */
  volume?: number;
  /** Least sim time (ms) between two sounds of this cue. Default 0: every event sounds. */
  gapMs?: number;
  /** Screen-reader line (null: say nothing). */
  aria?: string | ((event: E) => string | null | undefined);
  /** Anything else that reacts: a HUD flash, a view's burst. Never throttled. */
  run?: (event: E) => void;
}

/** One optional cue per event type of the union `E`. */
export type CueTable<E extends GameEventBase, S extends string> = {
  readonly [K in E['type']]?: Cue<Extract<E, { type: K }>, S>;
};

/** Where cues go. Both are optional, so a test can watch just one. */
export interface CueSinks<S extends string> {
  play?: (id: S, opts?: { volume?: number }) => void;
  say?: (text: string) => void;
}

/** Run every event of a frame through the table. `nowMs` is sim time. */
export type CueRunner<E extends GameEventBase> = (
  events: readonly E[],
  nowMs: number,
) => void;

export function createCues<E extends GameEventBase, S extends string>(
  table: CueTable<E, S>,
  sinks: CueSinks<S>,
): CueRunner<E> {
  /** Sim time each cue last sounded, by event type. */
  const lastSound = new Map<string, number>();
  const lookup = table as Readonly<Record<string, Cue<E, S> | undefined>>;

  return (events, nowMs) => {
    let text: string | null = null;
    for (const event of events) {
      const cue = lookup[event.type];
      if (!cue) continue;

      const id = typeof cue.sfx === 'function' ? cue.sfx(event) : cue.sfx;
      if (id && sinks.play) {
        const last = lastSound.get(event.type);
        const gap = cue.gapMs ?? 0;
        // A new run rewinds sim time: `nowMs < last` sounds again at once.
        if (last === undefined || nowMs < last || nowMs - last >= gap) {
          lastSound.set(event.type, nowMs);
          sinks.play(
            id,
            cue.volume === undefined ? undefined : { volume: cue.volume },
          );
        }
      }

      const line = typeof cue.aria === 'function' ? cue.aria(event) : cue.aria;
      if (line) text = line;

      cue.run?.(event);
    }
    if (text !== null) sinks.say?.(text);
  };
}
