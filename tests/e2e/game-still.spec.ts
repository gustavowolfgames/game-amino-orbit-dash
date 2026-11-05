import { expect, type Page, test } from '@playwright/test';

/**
 * The game screen's still (ENG-5476): until Pixi draws its first frame, GameScreen shows
 * `bg-game` over the brand ground, so the handoff from the loader (or the title's Play) lands
 * on the picture the first frame draws. These pin that it shows, what it shows, and that a
 * missing image fails to the brand ground rather than the template's grey.
 *
 * The still can be up for a single frame, too short to catch with a locator, so an init
 * script records every appearance with a MutationObserver.
 */

interface StillSeen {
  src: string | null;
  ground: string;
  brandGround: string;
}

declare global {
  interface Window {
    __stills?: StillSeen[];
  }
}

const recordStills = (page: Page) =>
  page.addInitScript(() => {
    window.__stills = [];
    new MutationObserver(() => {
      const still = document.querySelector<HTMLElement>('[data-game-still]');
      if (!still || still.dataset.seen) return;
      still.dataset.seen = '1';
      window.__stills?.push({
        src: still.querySelector('img')?.getAttribute('src') ?? null,
        ground: getComputedStyle(still).backgroundColor,
        brandGround: getComputedStyle(document.documentElement)
          .getPropertyValue('--brand-ground')
          .trim(),
      });
    }).observe(document, { childList: true, subtree: true });
  });

const stills = (page: Page) => page.evaluate(() => window.__stills ?? []);

const levelRunning = (page: Page) =>
  expect(
    page
      .locator('[aria-live="polite"]')
      .filter({ hasText: /^Level \d+ of \d+/ }),
  ).toHaveText(/^Level \d+ of \d+/, { timeout: 25_000 });

/** `rgb(r, g, b)` from a computed colour, and the same for a `#rrggbb` token. */
const rgb = (color: string) => {
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return hex
    ? `rgb(${hex
        .slice(1)
        .map((h) => Number.parseInt(h, 16))
        .join(', ')})`
    : color;
};

test.describe('game screen still', () => {
  test('?screen=game: the still is bg-game on the brand ground, gone once Pixi draws', async ({
    page,
  }) => {
    await recordStills(page);
    await page.goto('/?screen=game');
    await levelRunning(page);
    const [seen] = await stills(page);
    expect(seen, 'the still showed before the first frame').toBeTruthy();
    expect(seen!.src).toMatch(/bg-game/);
    expect(seen!.ground).toBe(rgb(seen!.brandGround));
    await expect(page.locator('[data-game-still]')).toHaveCount(0);
  });

  test('Play: the title hands off through the same still', async ({ page }) => {
    await recordStills(page);
    await page.goto('/');
    await expect(page.locator('[data-intro-sting]')).toHaveCount(0, {
      timeout: 25_000,
    });
    await expect(page.locator('#app canvas').first()).toBeAttached({
      timeout: 15_000,
    });
    await page.keyboard.press('Space');
    await levelRunning(page);
    const [seen] = await stills(page);
    expect(seen, 'the still showed before the first frame').toBeTruthy();
    expect(seen!.src).toMatch(/bg-game/);
    await expect(page.locator('[data-game-still]')).toHaveCount(0);
  });

  test('a bg-game that fails to load leaves the brand ground, not grey', async ({
    page,
  }) => {
    await recordStills(page);
    await page.route(/bg-game/, (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await page.goto('/?screen=game');
    await levelRunning(page);
    const [seen] = await stills(page);
    expect(seen, 'the still showed before the first frame').toBeTruthy();
    expect(seen!.ground).toBe(rgb(seen!.brandGround));
  });
});
