/**
 * feedback — what each match-3 event sounds like and says.
 *
 * The controller drains the sim's events once a frame and runs them through this cue
 * table (`./cues.ts`): a sound and a screen-reader line. Nothing here writes game state,
 * and nothing diffs counters: every effect hangs off an event the sim emitted. To add
 * one, emit a new `GameEvent` in `../sim/plugin.ts` and give it a row here.
 */

import type { GameEvent } from '../sim/plugin';
import { createCues } from './cues';

/** The audio channels this game plays (aliases in src/game/asset-manifest.ts). */
export const SOUNDS = {
  sfx: ['sfx-pop', 'sfx-clear'],
  music: ['audio-music'],
} as const;
export type Sfx = (typeof SOUNDS.sfx)[number];

export interface FeedbackDeps {
  play: (id: Sfx, opts?: { volume?: number }) => void;
  say: (text: string) => void;
}

export function createFeedback(d: FeedbackDeps) {
  return createCues<GameEvent, Sfx>(
    {
      // One pop per move: a move's cascade steps share one sim instant.
      scored: {
        sfx: 'sfx-pop',
        gapMs: 60,
        aria: (e) =>
          e.chain > 1 ? `Chain ×${e.chain}, ${e.score} points.` : null,
      },
      rejected: { aria: 'No match. Swap undone.' },
      reshuffled: { aria: 'No moves left. New board.' },
      phase: {
        sfx: (e) => (e.phase === 'won' ? 'sfx-clear' : null),
        aria: (e) =>
          e.phase === 'won'
            ? 'Level complete.'
            : e.phase === 'lost'
              ? 'Out of moves.'
              : null,
      },
    },
    { play: d.play, say: d.say },
  );
}
