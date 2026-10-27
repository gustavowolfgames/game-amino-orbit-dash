import { expect, type Page, test } from '@playwright/test';

/**
 * ENG-4797: Space during gameplay must not toggle the scaffold's global pause
 * ("PAUSED — Press SPACE to resume"). Escape pauses instead, and Space resumes.
 */

const gameScreen = (page: Page) => page.locator('[data-screen="game"]');
const pausedOverlay = (page: Page) =>
  page.getByRole('heading', { name: 'PAUSED' });

async function startGame(page: Page) {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });
  // Space on the title starts the game, the same as Play. The title may still be
  // loading when the first press lands, so keep pressing until the game mounts.
  await expect(async () => {
    await page.keyboard.press('Space');
    await expect(gameScreen(page)).toBeAttached({ timeout: 1_000 });
  }).toPass({ timeout: 45_000 });
}

test.describe('keyboard on the game screen', () => {
  // The first run pays for the dev server's cold compile of the title and game chunks.
  test.setTimeout(60_000);

  test('Space does not pause the run', async ({ page }) => {
    await startGame(page);
    await expect(pausedOverlay(page)).toHaveCount(0);

    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');

    await expect(gameScreen(page)).toBeAttached();
    await expect(pausedOverlay(page)).toHaveCount(0);
  });

  // Chrome leaves focus on a clicked button: the gear must not take Space or Enter after it.
  for (const key of ['Space', 'Enter']) {
    test(`after the gear opens and closes settings, ${key} does not reopen them`, async ({
      page,
    }) => {
      await startGame(page);
      const gear = page.getByRole('button', { name: 'Settings' });

      await gear.click();
      await expect(gear).toHaveAttribute('aria-expanded', 'true');
      await gear.click();
      await expect(gear).toHaveAttribute('aria-expanded', 'false');
      await expect(gear).toBeFocused();

      await page.keyboard.press(key);
      await expect(gear).toHaveAttribute('aria-expanded', 'false');
      await expect(pausedOverlay(page)).toHaveCount(0);
    });
  }

  test('a gear reached with Tab still opens settings with Space', async ({
    page,
  }) => {
    await startGame(page);
    const gear = page.getByRole('button', { name: 'Settings' });
    await gear.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(gear).toBeFocused();

    await page.keyboard.press('Space');
    await expect(gear).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape pauses and Space resumes', async ({ page }) => {
    await startGame(page);

    await page.keyboard.press('Escape');
    await expect(pausedOverlay(page)).toBeVisible();

    await page.keyboard.press('Space');
    await expect(pausedOverlay(page)).toHaveCount(0);
  });
});
