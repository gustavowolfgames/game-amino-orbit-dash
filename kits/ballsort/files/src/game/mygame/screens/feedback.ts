/**
 * feedback — what each ball sort event sounds like and says.
 *
 * The controller drains the sim's events once a frame and runs them through this cue
 * table (`./cues.ts`): a sound and a screen-reader line. Nothing here writes game state,
 * and nothing diffs counters: every effect hangs off an event the sim emitted. To add
 * one, emit a new `GameEvent` in `../sim/plugin.ts` and give it a row here. Tubes are
 * said 1-based.
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
      lifted: {
        sfx: 'sfx-pop',
        volume: 0.5,
        aria: (e) => `Holding from tube ${e.tube + 1}.`,
      },
      putBack: {
        aria: (e) => (e.illegal ? "Can't drop there." : 'Put back.'),
      },
      moved: { sfx: 'sfx-pop', aria: (e) => `Moved to tube ${e.to + 1}.` },
      tubeDone: { sfx: 'sfx-clear', aria: (e) => `Tube ${e.tube + 1} sorted.` },
      undone: { aria: (e) => `Move undone. ${e.undosLeft} undos left.` },
      restarted: { aria: 'Level restarted.' },
      stuck: { aria: 'No moves left. Retry.' },
      cursor: { aria: (e) => `Tube ${e.tube + 1}.` },
      phase: {
        sfx: (e) => (e.phase === 'won' ? 'sfx-clear' : null),
        aria: (e) => (e.phase === 'won' ? 'Level complete.' : null),
      },
    },
    { play: d.play, say: d.say },
  );
}
