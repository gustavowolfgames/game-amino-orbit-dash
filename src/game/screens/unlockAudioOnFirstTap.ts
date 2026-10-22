/**
 * unlockAudioOnFirstTap — unlock audio on the player's first gesture.
 *
 * When the start screen is skipped (the Vault always skips it), nothing the player taps
 * calls `unlockAudio()`: the loading screen calls it at boot, which only works when the
 * page already has user activation. Without one the browser keeps the AudioContext
 * suspended. This listens on the window, in the capture phase, so the first tap anywhere
 * (canvas, menu, host overlay) resumes it. It calls `unlock` on press and on release
 * (iOS Safari counts the release as the gesture) and removes itself after the first
 * release or key press (not Escape, which browsers do not count as one). It outlives
 * the loading screen on purpose: the first tap lands on the game screen.
 */

const PRESS = ['pointerdown'] as const;
const END = ['pointerup', 'keydown'] as const;

/** Returns a function that removes the listeners early (they also remove themselves). */
export function unlockAudioOnFirstTap(
  unlock: () => unknown,
  target: EventTarget = window,
): () => void {
  const opts = { capture: true } as const;
  const onPress = () => {
    unlock();
  };
  const onEnd = (e: Event) => {
    // Escape is not a user activation (HTML spec): unlocking on it fails, and removing the
    // listeners would leave the real first tap with nothing to retry on.
    if ((e as KeyboardEvent).key === 'Escape') return;
    unlock();
    remove();
  };
  const remove = () => {
    for (const type of PRESS) target.removeEventListener(type, onPress, opts);
    for (const type of END) target.removeEventListener(type, onEnd, opts);
  };
  for (const type of PRESS) target.addEventListener(type, onPress, opts);
  for (const type of END) target.addEventListener(type, onEnd, opts);
  return remove;
}
