/**
 * useGameKeyboard — keyboard input for the game screen, turned into controller intents.
 *
 * Keyboard keys are DOM events, so they are wired here in the Solid screen (not in game code)
 * and handed to `controller.input` as typed `GameIntent`s. The controller turns an intent into
 * a transaction; input never writes state directly. Pointer input on the canvas stays in the
 * game's Pixi input (`src/game/mygame/input/`).
 *
 *   ← → ↑ ↓ / W A S D   { type: 'move', dir }
 *   Space / Enter        { type: 'action' }   (Space also resumes when paused)
 *   Escape / P           toggle the scaffold pause
 *   Escape               { type: 'back' } instead, while the game's end screen is up
 *
 * Space never toggles the scaffold's pause during play (ENG-4797): `useSpaceKey` catches it
 * before the global listener in `src/core/systems/pause/keyboard.ts` (read-only) sees it. While
 * paused, Space resumes, which keeps the core overlay's "Press SPACE to resume" true.
 *
 * Nothing fires while the settings menu is open (the menu owns the keyboard then), or for a key
 * a focused control owns: any key in a text field (the Inspector's filter), the arrows on a
 * slider, Space / Enter on a button. Other keys on a focused button are still the game's. Listeners run
 * in the capture phase so an Escape that closes the menu is seen while the menu is still open,
 * and does not also pause the game.
 *
 * Change the key map (and `GameIntent` in `src/game/mygame-contract.ts`) for your game.
 */

import { onCleanup, onMount } from 'solid-js';

import { pauseState } from '~/core/systems/pause';
import type { GameController, GameIntent } from '~/game/mygame-contract';
import { controlOwnsKey, useSpaceKey } from '~/game/screens/useSpaceKey';
import { settingsOpen } from '~/game/settingsOpen';

/** Key code → intent. Space is handled through `useSpaceKey`. */
const GAME_KEYS: Readonly<Record<string, GameIntent>> = {
  ArrowLeft: { type: 'move', dir: 'left' },
  KeyA: { type: 'move', dir: 'left' },
  ArrowRight: { type: 'move', dir: 'right' },
  KeyD: { type: 'move', dir: 'right' },
  ArrowUp: { type: 'move', dir: 'up' },
  KeyW: { type: 'move', dir: 'up' },
  ArrowDown: { type: 'move', dir: 'down' },
  KeyS: { type: 'move', dir: 'down' },
  Enter: { type: 'action' },
  NumpadEnter: { type: 'action' },
};

/** Keys that toggle the scaffold pause on the game screen. */
const PAUSE_KEYS: ReadonlySet<string> = new Set(['Escape', 'KeyP']);

export function useGameKeyboard(
  controller: Pick<GameController, 'input' | 'endScreenOpen'>,
): void {
  const send = (intent: GameIntent) => {
    if (pauseState.paused()) return;
    controller.input?.(intent);
  };

  // Space: never the scaffold pause. Resumes when paused, otherwise the primary action.
  useSpaceKey(() => {
    if (settingsOpen()) return;
    if (pauseState.paused()) pauseState.resume();
    else send({ type: 'action' });
  });

  const onKey = (e: KeyboardEvent) => {
    if (settingsOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (controlOwnsKey(e.target, e.code)) return; // typing, or Enter on a focused button
    // Paused over the card, Escape resumes first (the pause overlay is on top).
    if (
      e.code === 'Escape' &&
      controller.endScreenOpen?.() &&
      !pauseState.paused()
    ) {
      e.preventDefault();
      if (!e.repeat) send({ type: 'back' }); // the end card's Main menu, not a pause
      return;
    }
    if (PAUSE_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) pauseState.toggle();
      return;
    }
    const intent = GAME_KEYS[e.code];
    if (!intent) return;
    e.preventDefault();
    if (intent.type === 'action' && e.repeat) return;
    send(intent);
  };

  onMount(() => {
    window.addEventListener('keydown', onKey, { capture: true });
  });
  onCleanup(() => {
    window.removeEventListener('keydown', onKey, { capture: true });
  });
}
