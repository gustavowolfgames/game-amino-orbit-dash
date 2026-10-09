/**
 * The brand seam (src/game/brand): partner reskin is data. The Us Weekly and Law & Crime sheets
 * proven in Tier A validate unchanged, layer over the build's Wolf sheet, and resolve to a
 * visibly different theme — and anything missing or malformed leaves the build's brand in force.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import lawAndCrime from '../../../schemas/brand/examples/law-and-crime.json';
import usWeekly from '../../../schemas/brand/examples/us-weekly.json';
import {
  BUILD_SHEET,
  getTheme,
  loadBrand,
  mergeOverride,
  resetBrand,
  resolveTheme,
  validateOverride,
} from '~/game/brand';
import type { KitLike } from '~/game/content';
import type { PackBundle } from '~/game/content/dynamic-client';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0').toUpperCase()}`;

function fakeKit(opts: { pack?: () => Promise<PackBundle>; entry?: (schema: string, key: string) => unknown }): KitLike {
  const client = {
    getPack: opts.pack ?? (() => Promise.reject(Object.assign(new Error('none'), { code: 'PACK_NOT_FOUND' }))),
    getEntry: async (schema: string, key: string) => opts.entry?.(schema, key) ?? null,
  };
  return { execute: () => ({ promise: Promise.resolve(client) }) };
}

afterEach(() => {
  resetBrand();
  vi.restoreAllMocks();
});

describe('partner sheets', () => {
  it('validate unchanged against the brand schema', () => {
    expect(validateOverride(usWeekly)).not.toBeNull();
    expect(validateOverride(lawAndCrime)).not.toBeNull();
  });

  it('refuse a non-https link (the trust boundary)', () => {
    expect(validateOverride({ link: 'javascript:alert(1)' })).toBeNull();
  });

  it('reskin the build: Us Weekly orbs take its accents (its null palette clears Wolf\'s)', () => {
    const theme = resolveTheme(mergeOverride(BUILD_SHEET, validateOverride(usWeekly)!));
    expect(theme.displayName).toBe('Us Weekly');
    expect(theme.pieces.map(hex)).toEqual(['#EC2A8C', '#F9A5C6', '#8ED1FC']);
    expect(theme.ground).toBe('#323232'); // its dark Base
  });

  it('honour role pins: Law & Crime paints its Secondary as the page', () => {
    const theme = resolveTheme(mergeOverride(BUILD_SHEET, validateOverride(lawAndCrime)!));
    expect(theme.ground).toBe('#111C39');
    expect(theme.surface).toBe('#000000');
    expect(theme.accent).toBe('#AF8F53');
  });

  it('look different from each other and from the build', () => {
    const grounds = [BUILD_SHEET, usWeekly, lawAndCrime].map(
      (s) => resolveTheme(mergeOverride(BUILD_SHEET, validateOverride(s)!)).ground,
    );
    expect(new Set(grounds).size).toBe(3);
  });
});

describe('mergeOverride', () => {
  it('keeps absent keys, clears null ones, replaces roles whole', () => {
    const base = { ...BUILD_SHEET, roles: { ground: 'secondary' as const } };
    const out = mergeOverride(base, { primaryAccent: '#000000', extraColors: null, roles: {} });
    expect(out.primaryAccent).toBe('#000000');
    expect(out.secondaryAccent).toBe(BUILD_SHEET.secondaryAccent);
    expect(out.extraColors).toBeUndefined();
    expect(out.roles).toEqual({});
  });
});

describe('loadBrand — never breaks the boot', () => {
  it('keeps the build brand with no GameSDK or nothing published', async () => {
    const before = getTheme();
    expect(await loadBrand(null)).toBeNull();
    expect(await loadBrand(fakeKit({}))).toBeNull();
    expect(getTheme()).toEqual(before);
  });

  it('applies the deployment theme entry', async () => {
    const kit = fakeKit({ entry: (schema, key) => (schema === 'brand' && key === 'theme' ? lawAndCrime : null) });
    expect((await loadBrand(kit))?.displayName).toBe('Law & Crime');
    expect(getTheme().displayName).toBe('Law & Crime');
  });

  it('prefers the sheet a Content Pack carries over the deployment entry', async () => {
    const kit = fakeKit({
      pack: async () => ({ packKey: 'ed', schemas: { brand: { entries: { theme: usWeekly } } } }),
      entry: () => lawAndCrime,
    });
    expect((await loadBrand(kit, 'ed'))?.displayName).toBe('Us Weekly');
  });

  it('refuses a malformed sheet and keeps the build brand', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kit = fakeKit({ entry: () => ({ primaryAccent: 'pink' }) });
    expect(await loadBrand(kit)).toBeNull();
    expect(getTheme().displayName).toBe(BUILD_SHEET.displayName);
  });
});
