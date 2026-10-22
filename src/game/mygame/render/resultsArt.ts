/**
 * resultsArt — PLACEHOLDER art for the end card, until the game publishes its own.
 *
 * The card (`./endScreen.ts`) reads its stars and character from the `core-results`
 * atlas. A game that has published that atlas (wolf-game-kit, `.agents/recipes/assets.md`)
 * never runs this. Without one, the card wears the catalog's own proxy art, the Figma
 * stars and the grey detective dog that ship inside `screen-results`, registered under
 * the atlas name so the card cannot tell the difference. Nothing is committed and
 * nothing goes to the CDN; the files load only on this fallback path.
 *
 * Replace it: publish a `core-results` atlas with the frames in `RESULTS_FRAMES`.
 */

import characterUrl from '@wolfgames/components/modules-src/prefabs/screen-results/proxy/character.unmasked.png?url';
import characterLoseUrl from '@wolfgames/components/modules-src/prefabs/screen-results/proxy/character-lose.png?url';
import starUrl from '@wolfgames/components/modules-src/prefabs/screen-results/proxy/star-middle.svg?url';
import starEmptyUrl from '@wolfgames/components/modules-src/prefabs/screen-results/proxy/star-middle-empty.svg?url';
import { Assets, type Texture } from 'pixi.js';
import { RESULTS_ATLAS, RESULTS_FRAMES } from './endScreen';

const PLACEHOLDER: Partial<Record<keyof typeof RESULTS_FRAMES, string>> = {
  star: starUrl,
  starEmpty: starEmptyUrl,
  character: characterUrl,
  characterLose: characterLoseUrl,
  // icon: none; the button draws without one.
};

/** Register the placeholder under `RESULTS_ATLAS` unless the game's own atlas is loaded. */
export async function ensureResultsArt(): Promise<void> {
  if (Assets.cache.has(RESULTS_ATLAS)) return;
  const entries = Object.entries(PLACEHOLDER) as [
    keyof typeof RESULTS_FRAMES,
    string,
  ][];
  const loaded = await Assets.load<Texture>(entries.map(([, url]) => url));
  const textures: Record<string, Texture> = {};
  for (const [key, url] of entries) textures[RESULTS_FRAMES[key]] = loaded[url];
  // The shape the GPU loader reads a sheet as (`Assets.get(sheet).textures[frame]`).
  if (!Assets.cache.has(RESULTS_ATLAS))
    Assets.cache.set(RESULTS_ATLAS, { textures });
}
