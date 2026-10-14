/**
 * Cue tables (src/game/mygame/screens/cues.ts): each sim event type maps to a
 * sound, a screen-reader line and a hook; sounds throttle per cue on sim time.
 */

import { describe, expect, it } from 'vitest';
import { createCues } from '~/game/mygame/screens/cues';
import type { EventOf } from '~/game/mygame/sim/events';

type Ev = EventOf<{
  hit: { power: number };
  lap: { n: number };
  quiet: { why: string };
}>;
type Sfx = 'sfx-thud' | 'sfx-big' | 'sfx-cheer';

function sinks() {
  const played: string[] = [];
  const said: string[] = [];
  return {
    played,
    said,
    sinks: {
      play: (id: Sfx, opts?: { volume?: number }) =>
        played.push(opts ? `${id}@${opts.volume}` : id),
      say: (t: string) => said.push(t),
    },
  };
}

describe('createCues', () => {
  it('plays, says and runs per event type; unlisted types are ignored', () => {
    const { played, said, sinks: s } = sinks();
    const laps: number[] = [];
    const cues = createCues<Ev, Sfx>(
      {
        hit: {
          sfx: (e) => (e.power > 5 ? 'sfx-big' : 'sfx-thud'),
          volume: 0.7,
        },
        lap: {
          sfx: 'sfx-cheer',
          aria: (e) => `Lap ${e.n}.`,
          run: (e) => laps.push(e.n),
        },
      },
      s,
    );
    cues(
      [
        { type: 'hit', power: 9 },
        { type: 'quiet', why: 'no cue' },
        { type: 'lap', n: 2 },
      ],
      0,
    );
    expect(played).toEqual(['sfx-big@0.7', 'sfx-cheer']);
    expect(said).toEqual(['Lap 2.']);
    expect(laps).toEqual([2]);
  });

  it('throttles a cue sound by gapMs of sim time, but still runs its hook', () => {
    const { played, sinks: s } = sinks();
    let hits = 0;
    const cues = createCues<Ev, Sfx>(
      { hit: { sfx: 'sfx-thud', gapMs: 100, run: () => hits++ } },
      s,
    );
    const hit = { type: 'hit', power: 1 } as const;
    cues([hit, hit, hit], 0); // a burst in one frame: one sound
    cues([hit], 50); // too soon
    cues([hit], 100); // gap reached
    expect(played).toEqual(['sfx-thud', 'sfx-thud']);
    expect(hits).toBe(5);
    cues([hit], 10); // sim time went back (a new run): sounds at once
    expect(played).toHaveLength(3);
  });

  it('says only the last line of a batch, and nothing when no cue speaks', () => {
    const { said, sinks: s } = sinks();
    const cues = createCues<Ev, Sfx>(
      { lap: { aria: (e) => (e.n > 1 ? `Lap ${e.n}.` : null) } },
      s,
    );
    cues([{ type: 'lap', n: 1 }], 0);
    expect(said).toEqual([]);
    cues(
      [
        { type: 'lap', n: 2 },
        { type: 'lap', n: 3 },
      ],
      0,
    );
    expect(said).toEqual(['Lap 3.']);
  });
});
