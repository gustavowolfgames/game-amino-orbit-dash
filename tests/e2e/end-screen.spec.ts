import { expect, type Page, test } from '@playwright/test';

/**
 * The end screen in a real browser: a won level ends on the Pixi card over the board
 * (src/game/mygame/render/endScreen.ts), not a hop to the DOM results screen, and its
 * Next button starts the next level. Run with `bun run test:e2e`.
 */

const DESIGN = { width: 390, height: 844 };
/** The card's primary button centre, in design px (screen-results defaults: 661 + 16 + 47 + 16 + 58/2). */
const PRIMARY = { x: 195, y: 769 };

const ariaLine = (page: Page) => page.locator('[aria-live="polite"]');

/** Design px → page px: the game's DesignLayer contain-fits DESIGN in the canvas. */
async function toPage(page: Page, p: { x: number; y: number }) {
  const box = await page.locator('#app canvas').first().boundingBox();
  if (!box) throw new Error('no game canvas');
  const scale = Math.min(box.width / DESIGN.width, box.height / DESIGN.height);
  return {
    x: box.x + (box.width - DESIGN.width * scale) / 2 + p.x * scale,
    y: box.y + (box.height - DESIGN.height * scale) / 2 + p.y * scale,
  };
}

test.use({ viewport: DESIGN });

test('a won level ends on the in-game card, and Next plays the next level', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?screen=game');
  await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/, {
    timeout: 20_000,
  });

  // The bundled pack's level 1 goal is 10 taps.
  const centre = await toPage(page, { x: 195, y: 420 });
  for (let i = 0; i < 10; i++) await page.mouse.click(centre.x, centre.y);
  await expect(ariaLine(page)).toHaveText('Level complete.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/end-screen-confetti.png' });

  // The card's stars pop 1.6s into its entrance (after the 0.9s end pause), with confetti.
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'test-results/end-screen-stars.png' });
  // The buttons land last.
  await page.waitForTimeout(1200);
  await expect(page.locator('#app h1', { hasText: 'Complete' })).toHaveCount(0); // no DOM results screen
  await page.screenshot({ path: 'test-results/end-screen-won.png' });

  const next = await toPage(page, PRIMARY);
  await page.mouse.click(next.x, next.y);
  await expect(ariaLine(page)).toHaveText(/^Level 2 of \d+/);
  expect(errors).toEqual([]);
});

test('the card answers the keyboard: Enter plays on', async ({ page }) => {
  await page.goto('/?screen=game');
  await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/, {
    timeout: 20_000,
  });
  const centre = await toPage(page, { x: 195, y: 420 });
  for (let i = 0; i < 10; i++) await page.mouse.click(centre.x, centre.y);
  await expect(ariaLine(page)).toHaveText(
    /Score 10\. Enter: next level\. Escape: main menu\./,
  );
  await page.keyboard.press('Enter');
  await expect(ariaLine(page)).toHaveText(/^Level 2 of \d+/);
});
