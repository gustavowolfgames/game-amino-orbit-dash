/**
 * useSpaceKey — Space belongs to the game, not the scaffold's pause toggle.
 *
 * `src/core/systems/pause/keyboard.ts` (read-only) toggles a global pause on every Space press,
 * which left a "PAUSED — Press SPACE to resume" overlay over a run that had just started. This
 * hook catches Space in the capture phase, before that window listener sees it, hands it to
 * `onSpace` (the start screen uses it to start the game), and clears any pause left over from
 * before the screen mounted.
 */

import { onCleanup, onMount } from 'solid-js';

import { pauseState } from '~/core/systems/pause';

export function useSpaceKey(onSpace?: () => void): void {
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) onSpace?.();
  };

  onMount(() => {
    pauseState.resume();
    window.addEventListener('keydown', onKey, { capture: true });
  });
  onCleanup(() =>
    window.removeEventListener('keydown', onKey, { capture: true }),
  );
}
