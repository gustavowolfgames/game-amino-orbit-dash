/**
 * textures — load the template's placeholder art for the Pixi renderers.
 *
 * The art comes through the asset manifest (`scene-title`, `scene-game` in
 * src/game/asset-manifest.ts), so it resolves against the lockfile like every
 * other asset: the CDN once published, `public/assets/` when the lockfile does
 * not list it (a new game that emptied the template's lockfile).
 *
 * This is a NEUTRAL template placeholder set — publish your game's art under the
 * same names and everything downstream keeps working. Gameplay sprites belong in
 * a `scene-*` atlas from the asset pipeline (`.agents/recipes/assets.md`).
 */

import { Assets, type ResolvedAsset, Texture } from 'pixi.js';
import { captureException } from '~/core/lib/sentry';
import type { AssetCoordinatorFacade } from '~/core/systems/assets';

export interface GameTextures {
  /** Full-bleed game background. */
  field: Texture;
}

export interface StartTextures {
  title: Texture;
  play: Texture;
  splash: Texture;
}

type Coordinator = Pick<AssetCoordinatorFacade, 'loadScene' | 'getGpuLoader'>;

/** Files already reported, so each missing one is logged and reported once. */
const reported = new Set<string>();

function reportMissingArt(error: Error, asset: string | ResolvedAsset) {
  const src = typeof asset === 'string' ? asset : (asset.src ?? '');
  if (reported.has(src)) return;
  reported.add(src);
  if (import.meta.env.DEV)
    console.warn(`Art failed to load; drawing without it: ${src}`, error);
  captureException(new Error(`Asset failed to load: ${src}`), {
    asset: src,
    cause: String(error),
  });
}

/**
 * A file that fails to load (a 404: a lockfile entry never published under this game's slug)
 * is skipped instead of failing its whole bundle, which left the loader stuck and the game
 * unable to start. It is logged once in dev and reported to Sentry; `texture` then hands back
 * an empty texture for it. Call after `initGpu()`; safe to call again. [ENG-5189]
 */
export function skipMissingArt(): void {
  Assets.loader.loadOptions = {
    ...Assets.loader.loadOptions,
    strategy: 'skip',
    onError: reportMissingArt,
  };
}

function texture(coordinator: Coordinator, alias: string): Texture {
  const tex = coordinator.getGpuLoader()?.get<Texture>(alias);
  if (tex) return tex;
  // Loaded but skipped (skipMissingArt): draw nothing in its place.
  if (Assets.cache.has(alias)) return Texture.EMPTY;
  throw new Error(`texture "${alias}" is not in a loaded scene bundle`);
}

/** Load the gameplay textures. Needs `initGpu()` first. */
export async function loadGameTextures(
  coordinator: Coordinator,
): Promise<GameTextures> {
  skipMissingArt();
  await coordinator.loadScene('game');
  return { field: texture(coordinator, 'bg-game') };
}

/** Load the start-screen textures. Needs `initGpu()` first. */
export async function loadStartTextures(
  coordinator: Coordinator,
): Promise<StartTextures> {
  skipMissingArt();
  await coordinator.loadScene('title');
  return {
    title: texture(coordinator, 'ui-title'),
    play: texture(coordinator, 'ui-button_play'),
    splash: texture(coordinator, 'bg-title'),
  };
}
