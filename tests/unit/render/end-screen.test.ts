/**
 * The end screen's copy (src/game/mygame/render/endScreen.ts): what the card says and
 * offers for each way a run ends.
 */

import { describe, expect, it } from 'vitest';
import { endCopy } from '~/game/mygame/render/endScreen';

describe('endCopy', () => {
  it('a won level offers the next one, with three stars', () => {
    expect(
      endCopy({ won: true, packDone: false, level: 1, score: 40 }),
    ).toEqual({
      headlineLine1: 'LEVEL 2',
      headlineLine2: 'COMPLETE!',
      primaryLabel: 'NEXT LEVEL',
      starsEarned: 3,
    });
  });

  it('the last level offers the pack again', () => {
    const copy = endCopy({ won: true, packDone: true, level: 4, score: 90 });
    expect(copy.headlineLine1).toBe('ALL LEVELS');
    expect(copy.primaryLabel).toBe('PLAY AGAIN');
  });

  it('the last level of a Vault edition, with another to come, offers the next edition', () => {
    const copy = endCopy({
      won: true,
      packDone: true,
      nextEdition: true,
      level: 4,
      score: 90,
    });
    expect(copy.headlineLine1).toBe('ALL LEVELS');
    expect(copy.primaryLabel).toBe('NEXT EDITION');
  });

  it('a loss offers a retry, with no stars (the card shows its lose state)', () => {
    expect(
      endCopy({ won: false, packDone: false, level: 0, score: 3 }),
    ).toMatchObject({
      primaryLabel: 'TRY AGAIN',
      starsEarned: 0,
    });
  });
});
