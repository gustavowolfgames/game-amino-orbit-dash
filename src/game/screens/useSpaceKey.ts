/**
 * useSpaceKey — Space belongs to the game, not the scaffold's pause toggle.
 *
 * `src/core/systems/pause/keyboard.ts` (read-only) toggles a global pause on every Space press,
 * which left a "PAUSED — Press SPACE to resume" overlay over a run that had just started. This
 * hook catches Space in the capture phase, before that window listener sees it, hands it to
 * `onSpace` (the start screen uses it to start the game), and clears any pause left over from
 * before the screen mounted.
 *
 * A focused control (a text field, a button, a menu toggle) keeps its Space: it types the space
 * or presses the button, `onSpace` does not run, and the event is stopped at `document` (after
 * the control and Solid's delegated handlers saw it) so the core listener still never pauses.
 */

import { onCleanup, onMount } from 'solid-js';

import { pauseState } from '~/core/systems/pause';

const CONTROLS =
  'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [role="button"], [role="textbox"], [role="switch"], [role="checkbox"], [role="slider"]';

/** True when a key event is aimed at a focused control that has its own use for the key. */
export function isFocusedControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    ((target instanceof HTMLElement && target.isContentEditable) ||
      target.closest(CONTROLS) !== null)
  );
}

export function useSpaceKey(onSpace?: () => void): void {
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || isFocusedControl(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) onSpace?.();
  };
  // A control's Space: let the control have it, but keep it from the core pause on `window`.
  const onControlSpace = (e: KeyboardEvent) => {
    if (e.code === 'Space' && isFocusedControl(e.target)) e.stopPropagation();
  };

  onMount(() => {
    pauseState.resume();
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('keydown', onControlSpace);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', onKey, { capture: true });
    document.removeEventListener('keydown', onControlSpace);
  });
}
