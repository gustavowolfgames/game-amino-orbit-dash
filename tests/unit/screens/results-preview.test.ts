/**
 * `?screen=results` (src/game/setup/devLinks.ts → `resultsPreview` in
 * src/game/mygame/screens/endOfPlay.ts): the card a won level of the run in play would show.
 */

import { describe, expect, it } from 'vitest';
import { getActivePack } from '~/game/content';
import { endCopy } from '~/game/mygame/render/endScreen';
import { resultsPreview } from '~/game/mygame/screens/endOfPlay';

describe('resultsPreview', () => {
  it('a won level, scored at its goal', () => {
    expect(resultsPreview(0, 10)).toEqual({
      won: true,
      packDone: false,
      level: 0,
      score: 10,
    });
    expect(endCopy(resultsPreview(0, 10)).primaryLabel).toBe('NEXT LEVEL');
  });

  it("the pack's last level shows the pack-done card", () => {
    const last = getActivePack().levels.length - 1;
    expect(resultsPreview(last, 30).packDone).toBe(true);
    expect(endCopy(resultsPreview(last, 30)).headlineLine1).toBe('ALL LEVELS');
  });
});
