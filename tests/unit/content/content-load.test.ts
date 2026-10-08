/**
 * The content seam (src/game/content): which pack is asked for, how a Content Pack bundle joins
 * into playable levels, and the one promise that matters most — a missing, failing or malformed
 * pack never breaks the boot; the bundled pack keeps playing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assemblePack,
  BUNDLED_PACK,
  DEFAULT_PACK_KEY,
  decomposePack,
  getActivePack,
  isLastLevel,
  type KitLike,
  LEVEL_DEFAULTS,
  levelAt,
  loadActivePack,
  packLevels,
  loadCatalog,
  resolvePackKey,
  seedActivePack,
  toEditions,
} from '~/game/content';
import type { PackBundle } from '~/game/content/dynamic-client';
import { GAME_SLUG } from '~/game/config/identity';

/** A GameKIT whose Dynamic Data client serves `getPack` from the given function. */
function fakeKit(getPack: (key: string) => Promise<PackBundle>): KitLike {
  const client = { getPack, getEntry: async () => null };
  return { execute: () => ({ promise: Promise.resolve(client) }) };
}

const packNotFound = () => Object.assign(new Error('no pack'), { code: 'PACK_NOT_FOUND' });

/** A published one-block pack as the CDN serves it. */
const bundleOf = (id: string, levels: unknown[]) =>
  decomposePack({ id, blocks: [{ id, name: id, levels: levels as never }] });

afterEach(() => {
  seedActivePack(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolvePackKey', () => {
  it('prefers ?wolfPack=, then the Vault selection, then the default key', () => {
    expect(resolvePackKey()).toBe(DEFAULT_PACK_KEY);
    expect(resolvePackKey('edition-2026-10-08')).toBe('edition-2026-10-08');
    vi.stubGlobal('location', { search: '?wolfPack=qa-pack' });
    expect(resolvePackKey('edition-2026-10-08')).toBe('qa-pack');
  });
});

describe('assemble / decompose', () => {
  it('round-trips an authored pack through the entries a publish creates', () => {
    const bundle = decomposePack(BUNDLED_PACK);
    expect(Object.keys(bundle.schemas.blocks?.entries ?? {})).toEqual(['orbits']);
    expect(Object.keys(bundle.schemas.levels?.entries ?? {})).toEqual(['orbits-1', 'orbits-2', 'orbits-3']);
    expect(assemblePack(bundle)).toEqual(BUNDLED_PACK);
  });

  it('plays blocks by `order`, whatever order the bundle lists them in', () => {
    const bundle = decomposePack({
      id: 'p',
      blocks: [
        { id: 'a', name: 'A', levels: [{ orbiterCount: 1 }] },
        { id: 'b', name: 'B', levels: [{ orbiterCount: 2 }, { orbiterCount: 3 }] },
      ],
    });
    const { a, b } = bundle.schemas.blocks?.entries as Record<string, object>;
    bundle.schemas.blocks = { entries: { b: { ...b, order: 1 }, a: { ...a, order: 2 } } };
    const out = assemblePack(bundle);
    expect(typeof out === 'string' ? out : packLevels(out)).toEqual([
      { orbiterCount: 2 },
      { orbiterCount: 3 },
      { orbiterCount: 1 },
    ]);
  });

  it('refuses a pack whose level key is missing from the bundle', () => {
    const bundle = bundleOf('p', [{ orbiterCount: 2 }]);
    delete bundle.schemas.levels?.entries['p-1'];
    expect(assemblePack(bundle)).toMatch(/level "p-1" of block "p" is not in the bundle/);
  });

  it('refuses a pack with no block, or a malformed one', () => {
    expect(assemblePack({ packKey: 'p', schemas: {} })).toMatch(/no block entry/);
    const bundle = bundleOf('p', [{ orbiterCount: 2 }]);
    bundle.schemas.blocks = { entries: { p: { id: 'p', levels: ['p-1'] } } };
    expect(assemblePack(bundle)).toMatch(/block "p" is not a block entry/);
  });
});

describe('loadActivePack — never breaks the boot', () => {
  it('plays the bundled pack with no GameSDK', async () => {
    expect(await loadActivePack(null, DEFAULT_PACK_KEY)).toBeNull();
    expect(getActivePack()).toMatchObject({ id: BUNDLED_PACK.id, source: 'bundled' });
  });

  it('is silent when nothing is published under the default key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kit = fakeKit(() => Promise.reject(packNotFound()));
    expect(await loadActivePack(kit, DEFAULT_PACK_KEY)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(getActivePack().source).toBe('bundled');
  });

  it('warns when a requested key (?wolfPack= / Vault) is not bound', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kit = fakeKit(() => Promise.reject(packNotFound()));
    expect(await loadActivePack(kit, 'typo-pack')).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('keeps the bundled pack when the network fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kit = fakeKit(() => Promise.reject(new Error('offline')));
    expect(await loadActivePack(kit, DEFAULT_PACK_KEY)).toBeNull();
    expect(getActivePack().source).toBe('bundled');
  });

  it('seeds a published pack, filling optional level fields from the defaults', async () => {
    const kit = fakeKit(async () => bundleOf('edition', [{ orbiterCount: 3, orbitSpeed: 1.4 }, { orbiterCount: 12 }]));
    const pack = await loadActivePack(kit, 'edition', 'edition');
    expect(pack).toMatchObject({ id: 'edition', source: 'published', contentId: 'edition' });
    expect(levelAt(0)).toEqual({ ...LEVEL_DEFAULTS, orbiterCount: 3, orbitSpeed: 1.4 });
    expect(levelAt(1)).toEqual({ ...LEVEL_DEFAULTS, orbiterCount: 12 });
  });

  it('drops a level this game cannot play, keeping the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kit = fakeKit(async () => bundleOf('mixed', [{ orbiterCount: 999 }, 'CRANE', { orbiterCount: 5 }]));
    const pack = await loadActivePack(kit, 'mixed');
    expect(pack?.levels).toHaveLength(1);
    expect(levelAt(0).orbiterCount).toBe(5);
  });

  it('refuses a pack with no playable level and keeps the one in play', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kit = fakeKit(async () => bundleOf('words', ['CRANE', 'SLATE']));
    expect(await loadActivePack(kit, 'words')).toBeNull();
    expect(getActivePack().source).toBe('bundled');
  });
});

describe('catalog (Daily Editions harvest)', () => {
  it('answers the schedule oldest first, in the wire shape', () => {
    expect(toEditions({ b: '2026-10-09', a: '2026-10-08', c: '2026-10-08' })).toEqual([
      { contentId: 'a', availableFrom: '2026-10-08' },
      { contentId: 'c', availableFrom: '2026-10-08' },
      { contentId: 'b', availableFrom: '2026-10-09' },
    ]);
  });

  it('answers no editions for a malformed entry or no GameSDK', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(toEditions({ a: 'tomorrow' })).toBeNull();
    expect(await loadCatalog(null, GAME_SLUG)).toEqual([]);
    const kit: KitLike = {
      execute: () => ({ promise: Promise.resolve({ getPack: async () => ({}), getEntry: async () => ({ a: 'x' }) }) }),
    };
    expect(await loadCatalog(kit, GAME_SLUG)).toEqual([]);
  });
});

describe('active pack', () => {
  it('wraps level indices so "play again" past the end loops the pack', () => {
    const n = getActivePack().levels.length;
    expect(levelAt(n)).toEqual(levelAt(0));
    expect(isLastLevel(n - 1)).toBe(true);
    expect(isLastLevel(0)).toBe(n === 1);
  });

  it('seeding null restores the bundled pack', () => {
    seedActivePack({ id: 'x', levels: [levelAt(0)], source: 'published', contentId: 'x' });
    expect(getActivePack().id).toBe('x');
    seedActivePack(null);
    expect(getActivePack()).toMatchObject({ id: BUNDLED_PACK.id, source: 'bundled', contentId: null });
  });
});
