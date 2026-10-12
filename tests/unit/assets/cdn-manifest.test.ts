import type { Manifest } from '@wolfgames/components/core';
import { describe, expect, it } from 'vitest';
import {
  type AssetResolver,
  resolveManifestWithClient,
  splitAssetUrl,
} from '~/core/systems/assets/cdn-manifest';

/** Structural stand-in mirroring AssetClient.url(): `<base>/<bucket>/<file>`. */
function stubResolver(
  base: string,
  files: Record<string, string>,
): AssetResolver {
  const bucketFor = (file: string) =>
    file.toLowerCase().endsWith('.json') ? 'json-data' : 'assets';
  return {
    list: () => Object.keys(files),
    has: (name: string) => name.replace(/^\/+/, '') in files,
    url: (name: string) => {
      const file = files[name.replace(/^\/+/, '')] ?? name;
      return `${base}/${bucketFor(file)}/${file}`;
    },
  };
}

const manifest: Manifest = {
  cdnBase: '/assets',
  localBase: '/assets',
  bundles: [
    {
      name: 'boot-splash',
      assets: [{ alias: 'splash-hero', src: 'bg-splash.webp' }],
    },
    {
      name: 'scene-tiles',
      assets: [
        { alias: 'scene-tiles', src: 'json-data/atlas-tiles.json' },
        { alias: 'bg-forest', src: 'bg-forest_day.webp' },
      ],
    },
  ],
};

describe('splitAssetUrl', () => {
  it('splits at the bucket segment', () => {
    expect(
      splitAssetUrl('https://media.wolf.games/games/g/data/assets/x-abc.webp'),
    ).toEqual({
      base: 'https://media.wolf.games/games/g/data',
      rel: 'assets/x-abc.webp',
    });
    expect(
      splitAssetUrl(
        'https://media.wolf.games/games/g/data/json-data/a-abc.json',
      ),
    ).toEqual({
      base: 'https://media.wolf.games/games/g/data',
      rel: 'json-data/a-abc.json',
    });
  });

  it('splits at the LAST bucket segment (frozen localAssetBase contains /assets/)', () => {
    expect(splitAssetUrl('/assets/cdn/assets/x-abc.webp')).toEqual({
      base: '/assets/cdn',
      rel: 'assets/x-abc.webp',
    });
  });

  it('returns null when no bucket segment exists', () => {
    expect(splitAssetUrl('/somewhere/else.webp')).toBeNull();
  });
});

describe('resolveManifestWithClient', () => {
  const CDN = 'https://media.wolf.games/games/mygame/data';

  it('returns the manifest untouched when nothing is published (fresh scaffold)', () => {
    const resolved = resolveManifestWithClient(manifest, stubResolver(CDN, {}));
    expect(resolved).toBe(manifest);
  });

  it('rewrites published srcs to bucket-relative hashed paths and adopts the client base', () => {
    const resolved = resolveManifestWithClient(
      manifest,
      stubResolver(CDN, {
        'json-data/atlas-tiles.json': 'atlas-tiles-aaaa1111ffff.json',
        'bg-forest_day.webp': 'bg-forest_day-bbbb2222ffff.webp',
      }),
    );
    expect(resolved.cdnBase).toBe(CDN);
    const scene = resolved.bundles.find((b) => b.name === 'scene-tiles');
    expect(scene?.assets.map((a) => a.src)).toEqual([
      'json-data/atlas-tiles-aaaa1111ffff.json',
      'assets/bg-forest_day-bbbb2222ffff.webp',
    ]);
  });

  it('leaves bundled chrome (not in the lockfile) untouched for the localBase fallback', () => {
    const resolved = resolveManifestWithClient(
      manifest,
      stubResolver(CDN, {
        'bg-forest_day.webp': 'bg-forest_day-bbbb2222ffff.webp',
      }),
    );
    const boot = resolved.bundles.find((b) => b.name === 'boot-splash');
    expect(boot?.assets[0]?.src).toBe('bg-splash.webp');
    expect(resolved.localBase).toBe('/assets');
  });

  it('does not mutate the input manifest', () => {
    resolveManifestWithClient(
      manifest,
      stubResolver(CDN, {
        'bg-forest_day.webp': 'bg-forest_day-bbbb2222ffff.webp',
      }),
    );
    expect(manifest.cdnBase).toBe('/assets');
    expect(manifest.bundles[1]?.assets[1]?.src).toBe('bg-forest_day.webp');
  });
});
