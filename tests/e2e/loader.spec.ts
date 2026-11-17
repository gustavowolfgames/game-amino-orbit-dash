import { expect, type Page, type Route, test } from '@playwright/test';

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

  // A lockfile entry never published under the game's slug 404s (ENG-5189): the file is
  // skipped and reported once, and the game still starts without it.
  const notFound = (route: Route) => route.fulfill({ status: 404, body: '' });
  const missingArtWarnings = (page: Page) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().startsWith('Art failed to load'))
        warnings.push(msg.text());
    });
    return warnings;
  };

  test('missing game art is skipped: ?screen=game still reaches a running level', async ({
    page,
  }) => {
    const warnings = missingArtWarnings(page);
    await page.route(/bg-game/, notFound);
    await page.goto('/?screen=game');
    await expect(
      page
        .locator('[aria-live="polite"]')
        .filter({ hasText: /^Level \d+ of \d+/ }),
    ).toHaveText(/^Level \d+ of \d+/, { timeout: 25_000 });
    expect(warnings).toHaveLength(1);
  });

  test('geometric title art stays playable when bg-title is unavailable', async ({
    page,
  }) => {
    const warnings = missingArtWarnings(page);
    await page.route(/bg-title/, notFound);
    await page.goto('/');
    // The loader plays, then hands off to the title screen and its canvas.
    await expect(sting(page)).toHaveAttribute(
      'data-intro-sting',
      'reveal-title',
      { timeout: 15_000 },
    );
    await expect(sting(page)).toHaveCount(0, { timeout: 25_000 });
    await expect(page.locator('#app canvas').first()).toBeAttached({
      timeout: 15_000,
    });
    // Orbit Dash generates title art in Pixi and does not request bg-title.
    expect(warnings).toHaveLength(0);
    // The title works: Space is the Play button.
    await page.keyboard.press('Space');
    await expect(page.locator('[data-screen="game"]')).toBeAttached({
      timeout: 15_000,
    });
  });
});
