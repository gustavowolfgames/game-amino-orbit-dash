/**
 * audioLoad — audio loads last, in the background, and no screen waits for it.
 *
 * The loader and the title wait for art only. Once their art is up they call
 * `loadAudioInBackground(assets.loadAudio)`: the first call starts the load, later calls do
 * nothing. The music belongs to the game, not to a button: the game screen asks for its
 * track when it starts, and `gameAudio` plays it once `whenAudioLoaded()` settles. Howler
 * holds a play until the first tap unlocks audio, so a track asked for on a path with no tap
 * yet (`?screen=game`, the Vault) starts on that tap (.agents/recipes/guardrails.md).
 *
 * A failed load is logged once and still settles `whenAudioLoaded`: audio is optional, and a
 * channel that never loaded is a no-op in `gameAudio`.
 */

let started = false;
let settle!: () => void;
const loaded = new Promise<void>((resolve) => {
  settle = resolve;
});

/** Start loading every audio bundle in the background (once). Never throws, never blocks. */
export function loadAudioInBackground(load: () => Promise<unknown>): void {
  if (started) return;
  started = true;
  Promise.resolve()
    .then(load)
    .catch((err) =>
      console.warn('Loading audio failed; the game plays silent:', err),
    )
    .finally(settle);
}

/** Settles once the background load has finished (or failed). Pending until it starts. */
export function whenAudioLoaded(): Promise<void> {
  return loaded;
}
