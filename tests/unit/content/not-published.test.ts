/**
 * "Nothing published yet" is the ordinary state of every new game (ENG-5190): the default pack
 * and the `brand/theme` entry 404 on the CDN until a content person publishes them. Those 404s
 * must fall back to the bundled pack and the build's brand without a warning or an error, while
 * a real failure (a 5xx, a network error, a payload that is not a pack or a sheet) still warns.
 *
 * These run the real SDK `DynamicDataClient` against a stubbed `fetch`, so the 404 → "not found"
 * mapping is the SDK's own, not a fake's.
 */

import { DynamicDataClient } from '@wolfgames/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBrand, resetBrand } from '~/game/brand';
import {
  DEFAULT_PACK_KEY,
  getActivePack,
  type KitLike,
  loadActivePack,
  seedActivePack,
} from '~/game/content';
import { registry } from '../../../schemas/registry';

const CDN = 'https://cdn.test';

/** A GameKIT whose Dynamic Data client is the SDK's own, reading from `CDN`. */
function sdkKit(): KitLike {
  const client = new DynamicDataClient({
    cdnBaseUrl: CDN,
    gameSlug: 'newgame',
    registry,
    releaseName: 'main',
  } as ConstructorParameters<typeof DynamicDataClient>[0]);
  return { execute: () => ({ promise: Promise.resolve(client) }) };
}

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Stub `fetch` with one reply per request, recording the URLs asked for. */
function stubFetch(answer: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return answer(url);
    }),
  );
  return urls;
}

/** The boot: pack and brand side by side, as `src/game/setup/content.ts` runs them. */
const boot = (kit: KitLike) =>
  Promise.all([
    loadActivePack(kit, DEFAULT_PACK_KEY),
    loadBrand(kit, DEFAULT_PACK_KEY),
  ]);

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  seedActivePack(null);
  resetBrand();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('nothing published (404) — a quiet fallback', () => {
  it('plays the bundled pack and the build brand without a warning or an error', async () => {
    stubFetch(() => reply(404));
    expect(await boot(sdkKit())).toEqual([null, null]);
    expect(getActivePack().source).toBe('bundled');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('asks the CDN for the default pack once, though the levels and the brand both want it', async () => {
    const urls = stubFetch(() => reply(404));
    await boot(sdkKit());
    const packs = urls.filter((u) => u.includes('/packs/default'));
    const theme = urls.filter((u) => u.includes('/brand[@main]/theme.json'));
    expect(packs).toEqual([
      `${CDN}/dynamic-data/newgame/packs/default[@main].json`,
    ]);
    expect(theme).toHaveLength(1);
  });
});

describe('a real failure — still warns', () => {
  it('warns for a 5xx on the pack and on the brand entry', async () => {
    stubFetch(() => reply(503));
    expect(await boot(sdkKit())).toEqual([null, null]);
    expect(getActivePack().source).toBe('bundled');
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.startsWith('[content] pack "default"'))).toBe(
      true,
    );
    expect(lines.some((l) => l.startsWith('[brand]'))).toBe(true);
  });

  it('warns when the network itself fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await boot(sdkKit())).toEqual([null, null]);
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.startsWith('[content]'))).toBe(true);
    expect(lines.some((l) => l.startsWith('[brand]'))).toBe(true);
  });

  it('warns for a published payload that is not a pack or not a sheet', async () => {
    stubFetch((url) =>
      url.includes('/packs/')
        ? reply(200, { packKey: 'default', schemas: { blocks: 'nonsense' } })
        : reply(200, { schemaVersion: 1, data: { primaryAccent: 'pink' } }),
    );
    expect(await boot(sdkKit())).toEqual([null, null]);
    expect(getActivePack().source).toBe('bundled');
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('refused'))).toBe(true);
    expect(lines.some((l) => l.startsWith('[brand] theme sheet refused'))).toBe(
      true,
    );
  });
});
