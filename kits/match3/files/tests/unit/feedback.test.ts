/**
 * The match-3's cue table (src/game/mygame/screens/feedback.ts): what each event
 * sounds like and says. The kit's own version of the template's feedback test (the
 * template's drives its juice kit off its example `scored` tap); the Carina switch
 * (src/game/setup/carina.ts) is still the template's.
 */

import { describe, expect, it } from 'vitest';
import { createFeedback } from '~/game/mygame/screens/feedback';
import type { GameEvent } from '~/game/mygame/sim/plugin';
import { carinaFromSearch } from '~/game/setup/carina';

function setup() {
  const played: string[] = [];
  const said: string[] = [];
  const cues = createFeedback({
    play: (id) => played.push(id),
    say: (text) => said.push(text),
  });
  return { cues, played, said };
}

const scored = (chain: number, score: number): GameEvent => ({
  type: 'scored',
  x: 3,
  y: 4,
  points: 30,
  chain,
  score,
});

describe('carinaFromSearch', () => {
  it('reads ?carina=0/1 and ignores everything else', () => {
    expect(carinaFromSearch('?carina=0')).toBe(false);
    expect(carinaFromSearch('?carina=1')).toBe(true);
    expect(carinaFromSearch('?screen=game')).toBeNull();
  });
});

describe('createFeedback (match-3)', () => {
  it('plays one pop per move, however many cascade steps it has', () => {
    const { cues, played } = setup();
    cues([scored(1, 30), scored(2, 90), scored(3, 180)], 0);
    expect(played).toEqual(['sfx-pop']);
    cues([scored(1, 210)], 100);
    expect(played).toEqual(['sfx-pop', 'sfx-pop']);
  });

  it('says a chain, not a plain clear', () => {
    const { cues, said } = setup();
    cues([scored(1, 30)], 0);
    expect(said).toEqual([]);
    cues([scored(2, 90)], 100);
    expect(said).toEqual(['Chain ×2, 90 points.']);
  });

  it('says a rejected swap and a reshuffle', () => {
    const { cues, said } = setup();
    cues(
      [{ type: 'rejected', a: { col: 0, row: 0 }, b: { col: 1, row: 0 } }],
      0,
    );
    cues([{ type: 'reshuffled' }], 0);
    expect(said).toEqual([
      'No match. Swap undone.',
      'No moves left. New board.',
    ]);
  });

  it('plays the clear on a win and says the end of a level', () => {
    const { cues, played, said } = setup();
    cues([{ type: 'phase', phase: 'won' }], 0);
    cues([{ type: 'phase', phase: 'lost' }], 0);
    expect(played).toEqual(['sfx-clear']);
    expect(said).toEqual(['Level complete.', 'Out of moves.']);
  });
});
