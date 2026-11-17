import { expect, test } from '@playwright/test';

test('Space switches the orbit lane without pausing the game', async ({
  page,
}) => {
  await page.goto('/?screen=game');
  const line = page.locator('[aria-live="polite"]');
  await expect(line).toHaveText(/^Level 1 of \d+/, { timeout: 20_000 });
  await page.keyboard.press('Space');
  await expect(line).toHaveText('Outer lane.');
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toHaveCount(0);
  await expect(page.locator('[data-screen="game"]')).toBeAttached();
});
