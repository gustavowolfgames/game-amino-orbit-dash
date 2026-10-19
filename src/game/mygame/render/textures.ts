/**
 * textures — load the template's placeholder art for the Pixi renderers.
 *
 * The art is committed under `../assets/generated/`. We import each `.webp` with
 * Vite's `?url` so it resolves in both the dev server and the production build,
 * then hand the URLs to Pixi's `Assets.load`. Self-contained: no CDN round-trip,
 * no AssetClient env config, works identically everywhere.
 *
 * The same files are ALSO published to the CDN (assets/asset-manifest.cdn.json)
 * for the deployed pipeline; these bundled copies are what dev + build load.
 *
 * This is a NEUTRAL template placeholder set — swap the .webp for your game's art
 * (same filenames) and everything downstream keeps working. Gameplay sprites
 * belong in a `scene-*` atlas from the asset pipeline (`.agents/recipes/assets.md`),
 * not in this folder.
 */

import { Assets, type Texture } from 'pixi.js';
import fieldUrl from '../assets/generated/bg-game.webp?url';
import titleBgUrl from '../assets/generated/bg-title.webp?url';
import playUrl from '../assets/generated/ui-button_play.webp?url';
// Start-screen art — the title wordmark, the round play button, and the
// title-screen background.
import titleUrl from '../assets/generated/ui-title.webp?url';

export interface GameTextures {
  /** Full-bleed game background. */
  field: Texture;
}

export interface StartTextures {
  title: Texture;
  play: Texture;
  splash: Texture;
}

/** Load the gameplay textures. Resolves once all are decoded. */
export async function loadGameTextures(): Promise<GameTextures> {
  return { field: await Assets.load<Texture>(fieldUrl) };
}

/** Load the start-screen textures. Resolves once all are decoded. */
export async function loadStartTextures(): Promise<StartTextures> {
  const [title, play, splash] = await Promise.all([
    Assets.load<Texture>(titleUrl),
    Assets.load<Texture>(playUrl),
    Assets.load<Texture>(titleBgUrl),
  ]);
  return { title, play, splash };
}
