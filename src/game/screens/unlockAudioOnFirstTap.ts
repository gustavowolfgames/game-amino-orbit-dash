/**
 * unlockAudioOnFirstTap — unlock audio on the player's first gesture.
 *
 * When the start screen is skipped (the Vault always skips it), nothing the player taps
 * calls `unlockAudio()`: the loading screen calls it at boot, which only works when the
 * page already has user activation. Without one the browser keeps the AudioContext
 * suspended. This listens on the window, in the capture phase, so a tap anywhere (canvas,
 * menu, host overlay) resumes it. It calls `unlock` on press and on release (iOS Safari counts
 * the release as the gesture), and keeps listening until `isRunning` says the audio is
 * actually running: a tap while the loader is still going comes before Howler has made any
 * audio, so that unlock does nothing and the next tap has to try again. Escape is skipped;
 * browsers do not count it as a gesture. It outlives the loading screen on purpose: the first
 * tap usually lands on the game screen.
 */

const PRESS = ['pointerdown'] as const;
const END = ['pointerup', 'keydown'] as const;

/** Returns a function that removes the listeners early (they also remove themselves). */
export function unlockAudioOnFirstTap(
  unlock: () => unknown,
  isRunning: () => boolean,
  target: EventTarget = window,
): () => void {
  const opts = { capture: true } as const;
  let removed = false;
  const tryUnlock = async (e: Event) => {
    // Escape is not a user activation (HTML spec): unlocking on it cannot work.
    if ((e as KeyboardEvent).key === 'Escape') return;
    await unlock();
    if (isRunning()) remove();
  };
  const remove = () => {
    if (removed) return;
    removed = true;
    for (const type of [...PRESS, ...END])
      target.removeEventListener(type, tryUnlock, opts);
  };
  if (isRunning()) return remove; // the boot-time unlock already worked
  for (const type of [...PRESS, ...END])
    target.addEventListener(type, tryUnlock, opts);
  return remove;
}
