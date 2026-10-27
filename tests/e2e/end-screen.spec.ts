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

  // The card is up once its line is read (the card opens after the end pause, which the
  // frame rate stretches); its stars pop 1.6s into its entrance, with confetti.
  await expect(ariaLine(page)).toHaveText(/^Level complete\. Score 10\./);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'test-results/end-screen-stars.png' });
  await expect(page.locator('#app h1', { hasText: 'Complete' })).toHaveCount(0); // no DOM results screen

  // The buttons take taps only once they land (~2.75s in): tap Next until the next level starts.
  const next = await toPage(page, PRIMARY);
  await expect(async () => {
    await page.mouse.click(next.x, next.y);
    await expect(ariaLine(page)).toHaveText(/^Level 2 of \d+/, {
      timeout: 400,
    });
  }).toPass({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

/** Play level 1 to its end card and wait for the card's line. */
async function winLevelOne(page: Page) {
  await page.goto('/?screen=game');
  await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/, {
    timeout: 20_000,
  });
  const centre = await toPage(page, { x: 195, y: 420 });
  for (let i = 0; i < 10; i++) await page.mouse.click(centre.x, centre.y);
  await expect(ariaLine(page)).toHaveText(
    /Score 10\. Enter: next level\. Escape: main menu\./,
  );
}

test('the card answers the keyboard once its buttons are up', async ({
  page,
}) => {
  await winLevelOne(page);
  // Buttons land ~2.75s into the entrance: an Enter or a tap before that does nothing.
  await page.keyboard.press('Enter');
  const next = await toPage(page, PRIMARY);
  await page.mouse.click(next.x, next.y);
  await page.waitForTimeout(500);
  await expect(ariaLine(page)).toHaveText(/^Level complete/);

  await page.waitForTimeout(2600);
  await page.keyboard.press('Enter');
  await expect(ariaLine(page)).toHaveText(/^Level 2 of \d+/);
});

test('screen readers get real buttons for the card', async ({ page }) => {
  await winLevelOne(page);
  await page.waitForTimeout(3100);
  // Visually hidden, so no pointer can hit it: a screen reader activates it with a click event.
  await page.getByRole('button', { name: 'Main menu' }).dispatchEvent('click');
  await expect(page.locator('#app canvas')).toHaveCount(0, { timeout: 10_000 }); // the title screen is DOM
});

test('Tab shows the focused card button, and Enter presses it', async ({
  page,
}) => {
  await winLevelOne(page);
  await page.waitForTimeout(3100);
  const menu = page.getByRole('button', { name: 'Main menu' });
  for (let i = 0; i < 6; i++) {
    if (await menu.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(menu).toBeFocused();
  // Revealed while it has keyboard focus (it is clipped to 1px otherwise).
  const box = await menu.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(20);
  await page.keyboard.press('Enter');
  await expect(page.locator('#app canvas')).toHaveCount(0, { timeout: 10_000 });
});
