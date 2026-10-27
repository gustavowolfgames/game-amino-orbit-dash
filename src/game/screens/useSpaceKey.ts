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
 * While paused, only a text field keeps it: elsewhere Space resumes. A button focused by a click
 * keeps neither Space nor Enter outside the settings menu, so the gear does not reopen it.
 */

import { onCleanup, onMount } from 'solid-js';

import { pauseState } from '~/core/systems/pause';
import { settingsOpen } from '~/game/settingsOpen';

/** Typing targets: every key is theirs. */
const TEXT_ENTRY =
  'textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], input:not([type="button"], [type="submit"], [type="reset"], [type="checkbox"], [type="radio"], [type="range"])';
/** Sliders: the arrows (and Space / Enter) are theirs. */
const SLIDER = 'input[type="range"], [role="slider"]';
/** Pressables: only Space and Enter are theirs. Arrows, WASD, P and Escape stay the game's, so a
 *  button left focused by a click (Chrome keeps focus on the settings gear) does not eat them. */
const PRESSABLE =
  'button, a[href], input, [role="button"], [role="switch"], [role="checkbox"], [role="radio"]';

const PRESS_KEYS: ReadonlySet<string> = new Set([
  'Space',
  'Enter',
  'NumpadEnter',
]);
const ARROWS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]);

/** Controls that took focus from a pointer press. Chrome leaves a clicked button focused (the
 *  settings gear, after it opens and closes the menu); such a button does not take Space or
 *  Enter from the game. A button reached with Tab does. */
const pointerFocused = new WeakSet<Element>();
let pointerPressed = false;
/** Mounted `useSpaceKey`s sharing the tracker; its listeners go when the last one does. */
let trackers = 0;

const onPointerDown = (e: PointerEvent) => {
  pointerPressed = true;
  // A press on a control that already has focus (no focusin follows).
  const active = document.activeElement;
  if (active && e.target instanceof Node && active.contains(e.target))
    pointerFocused.add(active);
};
const onAnyKey = () => {
  pointerPressed = false;
};
const onFocusIn = (e: FocusEvent) => {
  if (!(e.target instanceof Element)) return;
  if (pointerPressed) pointerFocused.add(e.target);
  else pointerFocused.delete(e.target);
};

/** Start tracking how controls get focus; returns the release for this mount. */
function trackFocusOrigin(): () => void {
  if (trackers++ === 0) {
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onAnyKey, { capture: true });
    window.addEventListener('focusin', onFocusIn, { capture: true });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--trackers > 0) return;
    window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    window.removeEventListener('keydown', onAnyKey, { capture: true });
    window.removeEventListener('focusin', onFocusIn, { capture: true });
    pointerPressed = false;
  };
}

/** True when the focused element a key event is aimed at has its own use for that key. */
export function controlOwnsKey(
  target: EventTarget | null,
  code: string,
): boolean {
  if (!(target instanceof Element)) return false;
  if (
    (target instanceof HTMLElement && target.isContentEditable) ||
    target.closest(TEXT_ENTRY)
  )
    return true;
  if (ARROWS.has(code)) return target.closest(SLIDER) !== null;
  if (!PRESS_KEYS.has(code) || target.closest(PRESSABLE) === null) return false;
  // Inside the open menu its controls keep their keys however they were focused.
  return settingsOpen() || !pointerFocused.has(target);
}

/** A control keeps its Space, except a pressable while paused: there Space resumes the game
 *  (the core overlay's "Press SPACE to resume"), not a click on whatever button kept focus.
 *  With the settings menu open over the pause, its controls keep Space and the game stays paused. */
const yieldsSpace = (target: EventTarget | null) =>
  controlOwnsKey(target, 'Space') &&
  !(
    pauseState.paused() &&
    !settingsOpen() &&
    !(target instanceof Element && target.closest(TEXT_ENTRY))
  );

export function useSpaceKey(onSpace?: () => void): void {
  let releaseTracker: (() => void) | null = null;
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || yieldsSpace(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) onSpace?.();
  };
  // A control's Space: let the control have it, but keep it from the core pause on `window`.
  const onControlSpace = (e: KeyboardEvent) => {
    if (e.code === 'Space' && yieldsSpace(e.target)) e.stopPropagation();
  };

  onMount(() => {
    releaseTracker = trackFocusOrigin();
    pauseState.resume();
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('keydown', onControlSpace);
  });
  onCleanup(() => {
    releaseTracker?.();
    releaseTracker = null;
    window.removeEventListener('keydown', onKey, { capture: true });
    document.removeEventListener('keydown', onControlSpace);
  });
}
