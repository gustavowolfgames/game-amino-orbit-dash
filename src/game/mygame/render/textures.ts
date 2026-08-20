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
 * (same filenames) and everything downstream keeps working. A single neutral orb
 * is tinted per colour index (COLORS in demo/config.ts); replace it with one
 * sprite per index when the art count grows (pack into a `scene-*` atlas then).
 */

import { Assets, type Texture } from 'pixi.js';

// Gameplay art — one neutral orb (tinted per colour index at render time) and
// the game-field background.
import orbUrl from '../assets/generated/piece-orb.webp?url';
import fieldUrl from '../assets/generated/bg-game.webp?url';

// Start-screen art — the title wordmark, the round play button, and the
// title-screen background.
import titleUrl from '../assets/generated/ui-title.webp?url';
import playUrl from '../assets/generated/ui-button_play.webp?url';
import titleBgUrl from '../assets/generated/bg-title.webp?url';

export interface GameTextures {
  /** Neutral orb, tinted per colour index (COLORS order) by the renderer. */
  orb: Texture;
  /** Full-bleed game background. */
  field: Texture;
}

export interface StartTextures {
  title: Texture;
  play: Texture;
  splash: Texture;
}

/** Load every gameplay texture the board needs. Resolves once all are decoded. */
export async function loadGameTextures(): Promise<GameTextures> {
  const [orb, field] = await Promise.all([
    Assets.load<Texture>(orbUrl),
    Assets.load<Texture>(fieldUrl),
  ]);
  return { orb, field };
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
