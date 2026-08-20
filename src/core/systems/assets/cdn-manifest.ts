/**
 * CDN-first manifest resolution: published srcs become
 * `<bucket>/<content-hashed-name>` paths and cdnBase becomes the client's
 * base; srcs absent from the lockfile (bundled boot chrome) pass through and
 * resolve via the loaders' localBase fallback.
 *
 * Kept free of solid-js/JSX so tests can exercise it under plain Node.
 */
import type { AssetClient } from '@wolfgames/client';
import type { Manifest } from '@wolfgames/components/core';

/** The slice of AssetClient this module reads — structural, for testability. */
export type AssetResolver = Pick<AssetClient<string>, 'list' | 'url' | 'has'>;

/**
 * Split an AssetClient url at the LAST bucket segment. `url()` always emits
 * `<base>/<assets|json-data>/<file>`; matching the last occurrence keeps the
 * split correct when the base itself contains `/assets/` (the frozen
 * localAssetBase does).
 */
export function splitAssetUrl(url: string): { base: string; rel: string } | null {
  const i = Math.max(url.lastIndexOf('/assets/'), url.lastIndexOf('/json-data/'));
  if (i < 0) return null;
  return { base: url.slice(0, i), rel: url.slice(i + 1) };
}

/**
 * Resolve a manifest against the client's active map (baked seed or pinned
 * release — whichever init() adopted). With nothing published (fresh scaffold)
 * the manifest is returned untouched, so boot stays fully local with zero CDN
 * requests.
 */
export function resolveManifestWithClient(manifest: Manifest, client: AssetResolver): Manifest {
  const names = client.list();
  const probe = names.length > 0 ? splitAssetUrl(client.url(names[0] as string)) : null;
  if (!probe) return manifest;
  return {
    ...manifest,
    cdnBase: probe.base,
    bundles: manifest.bundles.map((bundle) => ({
      ...bundle,
      assets: bundle.assets.map((asset) => {
        if (!client.has(asset.src)) return asset;
        const split = splitAssetUrl(client.url(asset.src));
        return split ? { ...asset, src: split.rel } : asset;
      }),
    })),
  };
}
