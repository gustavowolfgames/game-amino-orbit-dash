/**
 * Ball sort's cue table (src/game/mygame/screens/feedback.ts): what each event
 * sounds like and says. The kit's own version of the template's feedback test (the
 * template's drives its juice kit off its example `scored` tap, which ball sort does
 * not have); the Carina switch (src/game/setup/carina.ts) is still the template's.
 */

import { describe, expect, it } from 'vitest';
import { createFeedback } from '~/game/mygame/screens/feedback';
import type { GameEvent } from '~/game/mygame/sim/plugin';
import { carinaFromSearch } from '~/game/setup/carina';

function setup() {
  const played: Array<[string, number | undefined]> = [];
  const said: string[] = [];
  const cues = createFeedback({
    play: (id, opts) => played.push([id, opts?.volume]),
    say: (text) => said.push(text),
  });
  return { cues, played, said };
}

describe('carinaFromSearch', () => {
  it('reads ?carina=0/1 and ignores everything else', () => {
    expect(carinaFromSearch('?carina=0')).toBe(false);
    expect(carinaFromSearch('?carina=1')).toBe(true);
    expect(carinaFromSearch('?screen=game')).toBeNull();
  });
});

describe('createFeedback (ball sort)', () => {
  it('plays a soft pop on a lift and a full one on a move, saying tubes 1-based', () => {
    const { cues, played, said } = setup();
    cues([{ type: 'lifted', tube: 0 }], 0);
    cues([{ type: 'moved', from: 0, to: 2, moves: 1 }], 0);
    expect(played).toEqual([
      ['sfx-pop', 0.5],
      ['sfx-pop', undefined],
    ]);
    expect(said).toEqual(['Holding from tube 1.', 'Moved to tube 3.']);
  });

  it('tells an illegal drop from a put-back', () => {
    const { cues, played, said } = setup();
    cues([{ type: 'putBack', tube: 1, illegal: true }], 0);
    cues([{ type: 'putBack', tube: 1, illegal: false }], 0);
    expect(played).toEqual([]);
    expect(said).toEqual(["Can't drop there.", 'Put back.']);
  });

  it('plays the clear on a sorted tube and a win', () => {
    const { cues, played, said } = setup();
    const events: GameEvent[] = [
      { type: 'tubeDone', tube: 3 },
      { type: 'phase', phase: 'won' },
    ];
    cues(events, 0);
    expect(played.map(([id]) => id)).toEqual(['sfx-clear', 'sfx-clear']);
    expect(said).toEqual(['Level complete.']); // the last line of a batch
  });

  it('says undo, restart, stuck and the cursor', () => {
    const { cues, said } = setup();
    cues([{ type: 'undone', undosLeft: 2 }], 0);
    cues([{ type: 'restarted', level: 0 }], 0);
    cues([{ type: 'stuck', moves: 9 }], 0);
    cues([{ type: 'cursor', tube: 4 }], 0);
    expect(said).toEqual([
      'Move undone. 2 undos left.',
      'Level restarted.',
      'No moves left. Retry.',
      'Tube 5.',
    ]);
  });
});
