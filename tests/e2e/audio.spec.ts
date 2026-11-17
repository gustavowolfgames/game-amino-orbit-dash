import { expect, test } from '@playwright/test';

/** Audio loads in the background: a slow pickup sound must not delay Play. */
const DESIGN = { width: 390, height: 844 };
test.use({ viewport: DESIGN });

test('Play starts Orbit Dash while the pickup sound is still loading', async ({
  page,
}) => {
  await page.route(/sfx-pop\.json/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    await route.fulfill({ json: { urls: ['sfx-pop.mp3'] } });
  });
  await page.goto('/');
  await expect(page.locator('[data-intro-sting]')).toHaveCount(0, {
    timeout: 25_000,
  });
  await page.waitForTimeout(500);
  const box = await page.locator('#app canvas').first().boundingBox();
  if (!box) throw new Error('no title canvas');
  const scale = Math.min(box.width / DESIGN.width, box.height / DESIGN.height);
  const x = box.x + (box.width - DESIGN.width * scale) / 2 + 195 * scale;
  const y = box.y + (box.height - DESIGN.height * scale) / 2 + 692 * scale;
  const tapped = Date.now();
  await page.mouse.click(x, y);
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    /^Level 1 of \d+/,
    { timeout: 5_000 },
  );
  expect(Date.now() - tapped).toBeLessThan(5_000);
});
