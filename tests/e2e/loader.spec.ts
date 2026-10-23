import { expect, type Page, test } from '@playwright/test';

/**
 * The cinematic loader runs on every path (ENG-4977): it reveals into the title screen, or,
 * with the title skipped (the Vault, `?screen=game`), into the play screen's background, and
 * hands off to that screen. The bar under the WolfGames lockup only exists in reveal mode.
 */

const sting = (page: Page) => page.locator('[data-intro-sting]');

test.describe('loader', () => {
  test('?screen=game reveals into the game and hands off to it', async ({
    page,
  }) => {
    await page.goto('/?screen=game');
    await expect(sting(page)).toHaveAttribute(
      'data-intro-sting',
      'reveal-game',
      { timeout: 15_000 },
    );
    await expect(page.locator('[data-foot-bar]')).toHaveCSS('opacity', '1', {
      timeout: 15_000,
    });
    // The handoff: the loader is gone, and the game is playing.
    await expect(sting(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('[data-screen="game"]')).toBeAttached();
    await expect(
      page
        .locator('[aria-live="polite"]')
        .filter({ hasText: /^Level \d+ of \d+/ }),
    ).toHaveText(/^Level \d+ of \d+/, { timeout: 10_000 });
  });

  test('the title path still reveals into the title', async ({ page }) => {
    await page.goto('/');
    await expect(sting(page)).toHaveAttribute(
      'data-intro-sting',
      'reveal-title',
      { timeout: 15_000 },
    );
    await expect(sting(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('[data-screen="game"]')).toHaveCount(0);
  });
});

test.describe('loader: a failed load', () => {
  test('a missing splash is skipped: ?screen=game still reaches a running level', async ({
    page,
  }) => {
    await page.route(/bg-splash/, (route) => route.abort());
    await page.goto('/?screen=game');
    await expect(
      page
        .locator('[aria-live="polite"]')
        .filter({ hasText: /^Level \d+ of \d+/ }),
    ).toHaveText(/^Level \d+ of \d+/, { timeout: 25_000 });
  });

  test('missing game art keeps the loader up instead of a game that cannot start', async ({
    page,
  }) => {
    await page.route(/bg-game/, (route) => route.abort());
    await page.goto('/?screen=game');
    await expect(sting(page)).toBeAttached({ timeout: 15_000 });
    // Past the loader's own length and every retry: still the loader, never the game screen.
    await page.waitForTimeout(15_000);
    await expect(sting(page)).toBeAttached();
    await expect(page.locator('[data-screen="game"]')).toHaveCount(0);
  });
});
