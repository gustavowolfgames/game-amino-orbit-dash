import { expect, test } from '@playwright/test';

/**
 * The two Dynamic Data URLs a game with nothing published 404s on at boot: the default Content
 * Pack and the `brand/theme` entry (`[@<release>]` when VITE_RELEASE_NAME is set). The game reads
 * those 404s as "nothing published" and plays its bundled pack and brand without logging, but
 * the browser itself prints "Failed to load resource: … 404" for any 4xx fetch, and JS cannot
 * silence that line. Only that line, only for these two URLs, is expected; any other status, URL
 * or message (a network failure, a refused payload, the game's own warnings) still fails here.
 * ENG-5190.
 */
const NOTHING_PUBLISHED = [
  /\/dynamic-data\/[^/]+\/packs\/default(\[[^\]/]*\])?\.json$/,
  /\/dynamic-data\/[^/]+\/brand(\[[^\]/]*\])?\/theme\.json$/,
];

function isNothingPublished404(text: string, url: string): boolean {
  return (
    text.startsWith('Failed to load resource') &&
    text.includes('status of 404') &&
    NOTHING_PUBLISHED.some((pattern) => pattern.test(url))
  );
}

/**
 * Smoke tests: the game boots, a screen renders, and nothing crashes.
 * Run with `bun run test:e2e` (starts the dev server automatically).
 */
test.describe('smoke', () => {
  test('app loads and root is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });
  });

  test('loading completes and main content appears', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    // Start screen: DOM with h1 + Play button (no canvas). Game screen: Pixi canvas.
    await expect(
      page
        .locator('#app canvas:not([class*="tp-"])')
        .or(page.locator('#app h1'))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('no unhandled console errors during load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('ResizeObserver') &&
          !text.includes('favicon') &&
          !isNothingPublished404(text, msg.location().url)
        ) {
          errors.push(text);
        }
      }
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    expect(errors).toEqual([]);
  });
});
