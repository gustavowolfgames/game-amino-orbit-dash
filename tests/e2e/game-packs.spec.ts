import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * Game Packs end to end, in a real browser: the Dynamic Data CDN is intercepted and serves what
 * the Game Manager would publish, so the boot path (pack + brand fetch, fallback, apply) runs
 * exactly as on QA. Run with `bun run test:e2e`.
 */

const SCHEMAS = path.resolve(import.meta.dirname, '../../schemas');
const PACKS = path.resolve(import.meta.dirname, '../../src/game/content/packs');
const json = (p: string) =>
  JSON.parse(readFileSync(path.join(SCHEMAS, p), 'utf8'));

type AuthoredPack = {
  id: string;
  blocks: { id: string; name: string; levels: unknown[] }[];
};

/** A Content Pack bundle as the CDN serves it: `blocks` + `levels` entries, optionally a `brand`. */
function packBundle(packFile: string, brandFile?: string) {
  const pack = JSON.parse(
    readFileSync(path.join(PACKS, packFile), 'utf8'),
  ) as AuthoredPack;
  const blocks: Record<string, object> = {};
  const levels: Record<string, unknown> = {};
  pack.blocks.forEach((block, i) => {
    const keys = block.levels.map((_, n) => `${block.id}-${n + 1}`);
    blocks[block.id] = {
      id: block.id,
      name: block.name,
      order: i + 1,
      levels: keys,
    };
    keys.forEach((k, n) => {
      levels[k] = block.levels[n];
    });
  });
  return {
    packKey: pack.id,
    schemas: {
      blocks: { version: 1, entries: blocks },
      levels: { version: 1, entries: levels },
      ...(brandFile
        ? {
            brand: {
              version: 1,
              entries: { theme: json(`brand/examples/${brandFile}`) },
            },
          }
        : {}),
    },
  };
}

const PUBLIC_ASSETS = path.resolve(import.meta.dirname, '../../public/assets');

/**
 * With a slug set, the asset client asks the media CDN for lockfile names (`bg-splash-<hash>.webp`)
 * that are not published for this slug. Serve the local originals instead, so this suite tests
 * Dynamic Data rather than the asset publish (docs/recipes/asset-pipeline.md).
 */
async function serveLocalArt(page: Page) {
  await page.route(
    /media\.[a-z.]*wolf\.games\/games\/[^/]+\/data\/assets\//,
    (route) => {
      const file = route.request().url().split('/').pop() ?? '';
      const original = file.replace(/-[0-9a-f]{12}(\.\w+)$/, '$1');
      try {
        return route.fulfill({
          body: readFileSync(path.join(PUBLIC_ASSETS, original)),
        });
      } catch {
        return route.fulfill({ status: 404, body: 'not found' });
      }
    },
  );
}

/** Serve `packs` by key and the deployment `brand/theme` entry; everything else 404s. */
async function serveDynamicData(
  page: Page,
  packs: Record<string, object>,
  theme?: object,
) {
  await serveLocalArt(page);
  await page.route('**/dynamic-data/**', (route) => {
    const url = decodeURIComponent(route.request().url());
    const pack = url.match(/\/packs\/([^/[@]+?)(\[?@[^\]]+\]?)?\.json/)?.[1];
    if (pack && packs[pack]) return route.fulfill({ json: packs[pack] });
    // A single entry file is an envelope; a pack bundle (above) is not.
    if (theme && /\/brand(\[@[^\]]+\]|@[^/]+)?\/theme\.json/.test(url)) {
      return route.fulfill({ json: { schemaVersion: 1, data: theme } });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
}

const brandGround = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--brand-ground'),
  );

/** Boot straight into the game screen and return its screen-reader line. */
async function playingLine(page: Page, query: string) {
  await page.goto(`/?screen=game${query}`);
  const line = page
    .locator('[aria-live="polite"]')
    .filter({ hasText: /^Level \d+ of \d+/ });
  await expect(line).toHaveText(/^Level \d+ of \d+/, { timeout: 20_000 });
  return (await line.textContent()) ?? '';
}

test.describe('game packs', () => {
  test('nothing published: plays the bundled pack in the build brand', async ({
    page,
  }) => {
    await serveDynamicData(page, {});
    expect(await playingLine(page, '')).toMatch(/^Level 1 of 3\./);
    expect(await brandGround(page)).toBe('#141821');
  });

  test('?wolfPack= plays that pack and wears the brand it carries', async ({
    page,
  }) => {
    await serveDynamicData(page, {
      'edition-2026-10-08': packBundle(
        'edition-2026-10-08.json',
        'us-weekly.json',
      ),
    });
    expect(await playingLine(page, '&wolfPack=edition-2026-10-08')).toMatch(
      /^Level 1 of 2\./,
    );
    expect(await brandGround(page)).toBe('#323232'); // Us Weekly dark Base
  });

  test('switching brand data changes the look — same build, same pack', async ({
    page,
  }) => {
    await serveDynamicData(page, {}, json('brand/examples/law-and-crime.json'));
    expect(await playingLine(page, '')).toMatch(/^Level 1 of 3\./);
    expect(await brandGround(page)).toBe('#111C39'); // Law & Crime pins its Secondary as the page
  });

  test('a broken pack falls back to the bundled one and still plays', async ({
    page,
  }) => {
    const broken = packBundle('edition-2026-10-08.json');
    delete (broken.schemas.levels.entries as Record<string, unknown>)[
      'edition-2026-10-08-1'
    ];
    await serveDynamicData(page, { 'edition-2026-10-08': broken });
    expect(await playingLine(page, '&wolfPack=edition-2026-10-08')).toMatch(
      /^Level 1 of 3\./,
    );
  });
});
