import { expect, type Page, test } from '@playwright/test';

/**
 * Audio loads last, in the background, and no screen waits for it (ENG-5188,
 * src/game/setup/audioLoad.ts). With the music slow to arrive, Play still opens the game at
 * once, and the game screen's track starts when its file lands. Run with `bun run test:e2e`.
 */

const DESIGN = { width: 390, height: 844 };
/** The title's Play button centre in design px (titleFrame TITLE_BUTTON). */
const PLAY = { x: 195, y: 844 - 152 };
/** How late the music file arrives: far longer than Play is allowed to take. */
const MUSIC_DELAY_MS = 6_000;

test.use({ viewport: DESIGN });

/** Serve the music from here, `MUSIC_DELAY_MS` late (the CDN copy 404s without a .env). */
async function slowMusic(page: Page) {
  await page.route(/music-ambience[^/]*\.json/, (route) =>
    route.fulfill({
      json: { urls: ['music-slow.mp3'], sprite: { loop: [0, 300, true] } },
    }),
  );
  await page.route(/music-slow\.mp3/, async (route) => {
    await new Promise((r) => setTimeout(r, MUSIC_DELAY_MS));
    await route.fulfill({
      path: 'public/assets/sfx-pop.mp3',
      contentType: 'audio/mpeg',
    });
  });
}

const levelLine = (page: Page) =>
  page.locator('[aria-live="polite"]').filter({ hasText: /^Level \d+ of \d+/ });

/** True once a Howl whose source is the music is playing. */
const musicPlaying = (page: Page) =>
  page.evaluate(() =>
    (
      (
        window as unknown as {
          Howler?: { _howls: { _src: unknown; playing(): boolean }[] };
        }
      ).Howler?._howls ?? []
    ).some((h) => String(h._src).includes('music-slow') && h.playing()),
  );

/** Design px → page px: the title's DesignLayer contain-fits DESIGN in the canvas. */
async function toPage(page: Page, p: { x: number; y: number }) {
  const box = await page.locator('#app canvas').first().boundingBox();
  if (!box) throw new Error('no canvas');
  const scale = Math.min(box.width / DESIGN.width, box.height / DESIGN.height);
  return {
    x: box.x + (box.width - DESIGN.width * scale) / 2 + p.x * scale,
    y: box.y + (box.height - DESIGN.height * scale) / 2 + p.y * scale,
  };
}

test('Play opens the game without waiting for the music, which starts once it lands', async ({
  page,
}) => {
  await slowMusic(page);
  await page.goto('/');
  await expect(page.locator('[data-intro-sting]')).toHaveCount(0, {
    timeout: 25_000,
  });
  await page.waitForTimeout(500); // the Play button's pop-in
  const play = await toPage(page, PLAY);
  const tapped = Date.now();
  await page.mouse.click(play.x, play.y);
  await expect(levelLine(page)).toHaveText(/^Level \d+ of \d+/, {
    timeout: MUSIC_DELAY_MS - 1_000,
  });
  expect(Date.now() - tapped).toBeLessThan(MUSIC_DELAY_MS - 1_000);
  await expect.poll(() => musicPlaying(page), { timeout: 15_000 }).toBe(true);
});

test('with the title skipped, the game screen still starts its music once it lands', async ({
  page,
}) => {
  await slowMusic(page);
  await page.goto('/?screen=game');
  await expect(levelLine(page)).toHaveText(/^Level \d+ of \d+/, {
    timeout: 15_000,
  });
  // The first tap on the board unlocks audio where the browser asks for a gesture.
  const board = await toPage(page, { x: 195, y: 422 });
  await page.mouse.click(board.x, board.y);
  await expect.poll(() => musicPlaying(page), { timeout: 15_000 }).toBe(true);
});
