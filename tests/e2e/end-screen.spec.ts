import { expect, type Page, test } from '@playwright/test';

/**
 * The result preview uses the Pixi card over the board. Its buttons must remain
 * reachable by pointer, keyboard and screen readers.
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

test('the in-game result preview card restarts the orbit level', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?screen=results');
  await expect(ariaLine(page)).toHaveText(/^Level complete\. Score 8\./, {
    timeout: 20_000,
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/end-screen-confetti.png' });

  // The card is up once its line is read (the card opens after the end pause, which the
  // frame rate stretches); its stars pop 1.6s into its entrance, with confetti.
  await expect(ariaLine(page)).toHaveText(/^Level complete\. Score 8\./);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'test-results/end-screen-stars.png' });
  await expect(page.locator('#app h1', { hasText: 'Complete' })).toHaveCount(0); // no DOM results screen

  // The preview does not record a win, so Continue restarts level 1.
  const next = await toPage(page, PRIMARY);
  await expect(async () => {
    await page.mouse.click(next.x, next.y);
    await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/, {
      timeout: 400,
    });
  }).toPass({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

/** Open the dev/QA result preview and wait for the card's line. */
async function showResultCard(page: Page) {
  await page.goto('/?screen=results');
  await expect(ariaLine(page)).toHaveText(
    /Score 8\. Enter: next level\. Escape: main menu\./,
    { timeout: 20_000 },
  );
}

test('the card answers the keyboard once its buttons are up', async ({
  page,
}) => {
  await showResultCard(page);
  // Buttons land ~2.75s into the entrance.
  await page.waitForTimeout(3100);
  await page.keyboard.press('Enter');
  await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/);
});

test('screen readers get real buttons for the card', async ({ page }) => {
  await showResultCard(page);
  await page.waitForTimeout(3100);
  // Visually hidden, so no pointer can hit it: a screen reader activates it with a click event.
  await page.getByRole('button', { name: 'Main menu' }).dispatchEvent('click');
  await expect(page.locator('#app canvas')).toHaveCount(0, { timeout: 10_000 }); // the title screen is DOM
});

test('Tab shows the focused card button, and Enter presses it', async ({
  page,
}) => {
  await showResultCard(page);
  await page.waitForTimeout(3100);
  const menu = page.getByRole('button', { name: 'Main menu' });
  for (let i = 0; i < 6; i++) {
    if (await menu.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(menu).toBeFocused();
  // Revealed while it has keyboard focus: full size, unclipped, and on top at its centre.
  const box = await menu.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(20);
  expect(
    await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
      );
    }),
  ).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#app canvas')).toHaveCount(0, { timeout: 10_000 });
});

test('a card button Tab revealed takes a mouse click', async ({ page }) => {
  await showResultCard(page);
  await page.waitForTimeout(3100);
  const cont = page.getByRole('button', { name: 'Continue' });
  for (let i = 0; i < 6; i++) {
    if (await cont.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(cont).toBeFocused();
  // A real click (no force): it must reach the button, not pass through to the canvas.
  await cont.click({ timeout: 2_000 });
  await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/);
});
