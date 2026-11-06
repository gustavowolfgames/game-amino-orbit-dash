/**
 * check:assets fails a game whose `bg-game` is still the template's grey placeholder once it
 * publishes backgrounds of its own: the game screen shows `bg-game` until Pixi's first frame,
 * so a stale placeholder is a grey flash at every handoff (ENG-5476).
 */
import { describe, expect, it } from 'vitest';
import {
  bgGamePlaceholderProblem,
  TEMPLATE_BG_GAME_HASH,
} from '../../../scripts/check-asset-naming';

const TEMPLATE_FILES = {
  'bg-game.webp': `bg-game-${TEMPLATE_BG_GAME_HASH}.webp`,
  'bg-title.webp': 'bg-title-e7af92bfb29e.webp',
  'sfx-pop.mp3': 'sfx-pop-276dcf12bbf6.mp3',
};

describe('bgGamePlaceholderProblem', () => {
  it('passes the template itself: no background of the game’s own yet', () => {
    expect(bgGamePlaceholderProblem('bg-game.webp', TEMPLATE_FILES)).toBeNull();
  });

  it('flags the placeholder once the game publishes its own backdrop, naming the fix', () => {
    const problem = bgGamePlaceholderProblem('bg-game.webp', {
      ...TEMPLATE_FILES,
      'bg-space.webp': 'bg-space-0123456789ab.webp',
    });
    expect(problem).toContain("'bg-game'");
    expect(problem).toContain('src/game/asset-manifest.ts');
    expect(problem).toContain("src: 'bg-space.webp'");
  });

  it('passes once bg-game points at the game’s backdrop (the Lila fix)', () => {
    expect(
      bgGamePlaceholderProblem('bg-space.webp', {
        ...TEMPLATE_FILES,
        'bg-space.webp': 'bg-space-0123456789ab.webp',
      }),
    ).toBeNull();
  });

  it('passes once the game republishes bg-game.webp with its own art', () => {
    expect(
      bgGamePlaceholderProblem('bg-game.webp', {
        ...TEMPLATE_FILES,
        'bg-game.webp': 'bg-game-fedcba987654.webp',
        'bg-space.webp': 'bg-space-0123456789ab.webp',
      }),
    ).toBeNull();
  });

  it('flags a bundled placeholder copy too', () => {
    expect(
      bgGamePlaceholderProblem(
        'bg-game.webp',
        { 'bg-space.webp': 'bg-space-0123456789ab.webp' },
        TEMPLATE_BG_GAME_HASH,
      ),
    ).not.toBeNull();
  });

  it('passes with no bg-game alias: the game screen falls back to the brand ground', () => {
    expect(
      bgGamePlaceholderProblem(undefined, {
        'bg-space.webp': 'bg-space-0123456789ab.webp',
      }),
    ).toBeNull();
  });
});
