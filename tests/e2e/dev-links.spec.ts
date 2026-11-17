import { expect, type Page, test } from '@playwright/test';

/**
 * The dev/QA URL shortcuts (src/game/setup/devLinks.ts) on the dev server, where they are on:
 * `?screen=results` opens the game with its end card up, and `?unlock=all` resumes the active
 * pack on its last level. Run with `bun run test:e2e`.
 */

const DESIGN = { width: 390, height: 844 };
/** The card's primary button centre, in design px (as in end-screen.spec.ts). */
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

test('?screen=results opens the game with the end card up, and its button plays the level', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?screen=results');
  // Level 1 of the bundled pack, previewed at its goal of 8.
  await expect(ariaLine(page)).toHaveText(
    'Level complete. Score 8. Enter: next level. Escape: main menu.',
    { timeout: 20_000 },
  );
  await expect(page.locator('[data-screen="game"]')).toHaveCount(1);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'test-results/dev-links-results.png' });

  // Nothing was won: the button starts the level in play again.
  const next = await toPage(page, PRIMARY);
  await expect(async () => {
    await page.mouse.click(next.x, next.y);
    await expect(ariaLine(page)).toHaveText(/^Level 1 of \d+/, {
      timeout: 400,
    });
  }).toPass({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('?unlock=all resumes the pack on its last level', async ({ page }) => {
  await page.goto('/?screen=game&unlock=all');
  await expect(ariaLine(page)).toHaveText(/^Level (\d+) of \1\./, {
    timeout: 20_000,
  });
});
