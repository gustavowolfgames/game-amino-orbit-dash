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

import type { Texture } from 'pixi.js';
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

function texture(coordinator: Coordinator, alias: string): Texture {
  const tex = coordinator.getGpuLoader()?.get<Texture>(alias);
  if (!tex)
    throw new Error(`texture "${alias}" is not in a loaded scene bundle`);
  return tex;
}

/** Load the gameplay textures. Needs `initGpu()` first. */
export async function loadGameTextures(
  coordinator: Coordinator,
): Promise<GameTextures> {
  await coordinator.loadScene('game');
  return { field: texture(coordinator, 'bg-game') };
}

/** Load the start-screen textures. Needs `initGpu()` first. */
export async function loadStartTextures(
  coordinator: Coordinator,
): Promise<StartTextures> {
  await coordinator.loadScene('title');
  return {
    title: texture(coordinator, 'ui-title'),
    play: texture(coordinator, 'ui-button_play'),
    splash: texture(coordinator, 'bg-title'),
  };
}
