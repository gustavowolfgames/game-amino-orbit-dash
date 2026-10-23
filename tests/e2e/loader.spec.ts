import { expect, type Page, test } from '@playwright/test';

/**
 * The cinematic loader runs for players (ENG-4977): it reveals into the title screen, or, with
 * the title skipped (the Vault, a game's config), into the play screen's background. The
 * developer shortcut `?screen=game` skips the intro and goes straight into the game.
 */

const sting = (page: Page) => page.locator('[data-intro-sting]');

test.describe('loader', () => {
  test('?screen=game skips the intro and goes straight into the game', async ({
    page,
  }) => {
    const started = Date.now();
    await page.goto('/?screen=game');
    await expect(
      page
        .locator('[aria-live="polite"]')
        .filter({ hasText: /^Level \d+ of \d+/ }),
    ).toHaveText(/^Level \d+ of \d+/, { timeout: 15_000 });
    await expect(page.locator('[data-screen="game"]')).toBeAttached();
    // The intro alone runs ~8 s (the sting, then the bar's minimum fill): none of it played.
    expect(Date.now() - started).toBeLessThan(7_000);
    await expect(sting(page)).toHaveCount(0);
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
    const loading = page.locator('[data-loading="no-intro"]');
    await expect(loading).toBeAttached({ timeout: 15_000 });
    // Past every retry: still loading, never the game screen.
    await page.waitForTimeout(10_000);
    await expect(loading).toBeAttached();
    await expect(page.locator('[data-screen="game"]')).toHaveCount(0);
  });
});
