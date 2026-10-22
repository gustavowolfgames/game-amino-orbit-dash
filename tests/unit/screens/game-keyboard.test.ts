// @vitest-environment happy-dom
/**
 * ENG-4797: Space must never toggle the scaffold pause during gameplay.
 *
 * Installs the real global Space listener from src/core/systems/pause/keyboard.ts, mounts
 * the game screen's keyboard hook (the one GameScreen.tsx calls) in a Solid root with a
 * stub controller, and checks the pause state and the intents the controller receives.
 */

import { createRoot } from 'solid-js';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initPauseKeyboard, pauseState } from '~/core/systems/pause';
import type { GameIntent } from '~/game/mygame-contract';
import { useGameKeyboard } from '~/game/screens/useGameKeyboard';
import { setSettingsOpen } from '~/game/settingsOpen';

const press = (code: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
};

describe('game screen keyboard (useGameKeyboard)', () => {
  let intents: GameIntent[];
  let dispose: () => void;
  let cardOpen = false;

  beforeAll(() => {
    // The scaffold's global listener, as app.tsx installs it.
    initPauseKeyboard();
  });

  beforeEach(() => {
    intents = [];
    cardOpen = false;
    pauseState.resume();
    setSettingsOpen(false);
    createRoot((d) => {
      dispose = d;
      useGameKeyboard({
        input: (intent) => intents.push(intent),
        endScreenOpen: () => cardOpen,
      });
    });
  });

  afterEach(() => {
    dispose();
    pauseState.resume();
    setSettingsOpen(false);
  });

  it('control: without the hook, Space toggles the scaffold pause', () => {
    dispose();
    press('Space');
    expect(pauseState.paused()).toBe(true);
  });

  it('Space during gameplay does not pause, and is the primary action', () => {
    const event = press('Space');
    expect(pauseState.paused()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(intents).toEqual([{ type: 'action' }]);
  });

  it('a held Space (key repeat) sends no extra action', () => {
    press('Space');
    press('Space', { repeat: true });
    expect(intents).toEqual([{ type: 'action' }]);
    expect(pauseState.paused()).toBe(false);
  });

  it('Escape and P pause; Space resumes', () => {
    press('Escape');
    expect(pauseState.paused()).toBe(true);
    press('Space');
    expect(pauseState.paused()).toBe(false);
    press('KeyP');
    expect(pauseState.paused()).toBe(true);
    press('KeyP');
    expect(pauseState.paused()).toBe(false);
    expect(intents).toEqual([]);
  });

  it('maps arrows and WASD to move intents', () => {
    press('ArrowLeft');
    press('KeyD');
    press('ArrowUp');
    press('KeyS');
    press('Enter');
    expect(intents).toEqual([
      { type: 'move', dir: 'left' },
      { type: 'move', dir: 'right' },
      { type: 'move', dir: 'up' },
      { type: 'move', dir: 'down' },
      { type: 'action' },
    ]);
  });

  it('sends no intents while paused', () => {
    pauseState.pause();
    press('ArrowLeft');
    press('Enter');
    expect(intents).toEqual([]);
  });

  it('does nothing while the settings menu is open', () => {
    setSettingsOpen(true);
    press('Space');
    press('Escape');
    press('ArrowLeft');
    expect(pauseState.paused()).toBe(false);
    expect(intents).toEqual([]);
  });

  it('removes its listeners on cleanup', () => {
    dispose();
    press('ArrowLeft');
    expect(intents).toEqual([]);
  });

  describe("the game's end card", () => {
    it("Escape is the card's Main menu (a back intent), not a pause", () => {
      cardOpen = true;
      press('Escape');
      expect(pauseState.paused()).toBe(false);
      expect(intents).toEqual([{ type: 'back' }]);
    });

    it("Enter is the card's primary button (the action intent)", () => {
      cardOpen = true;
      press('Enter');
      expect(intents).toEqual([{ type: 'action' }]);
    });

    it('without the card, Escape still pauses', () => {
      press('Escape');
      expect(pauseState.paused()).toBe(true);
      expect(intents).toEqual([]);
    });
  });
});
