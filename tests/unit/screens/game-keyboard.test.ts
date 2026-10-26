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

/** A keydown aimed at `el` (dispatched on it, so it bubbles to document and window). */
const pressOn = (el: Element, code: string) => {
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
};

describe('game screen keyboard (useGameKeyboard)', () => {
  let intents: GameIntent[];
  let dispose: () => void;

  beforeAll(() => {
    // The scaffold's global listener, as app.tsx installs it.
    initPauseKeyboard();
  });

  beforeEach(() => {
    intents = [];
    pauseState.resume();
    setSettingsOpen(false);
    createRoot((d) => {
      dispose = d;
      useGameKeyboard({ input: (intent) => intents.push(intent) });
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

  describe('a focused control keeps its keys', () => {
    let field: HTMLInputElement;
    let button: HTMLButtonElement;
    beforeEach(() => {
      field = document.createElement('input');
      button = document.createElement('button');
      document.body.append(field, button);
    });
    afterEach(() => {
      field.remove();
      button.remove();
    });

    it('typing W A S D or arrows in a text field sends no intent and is not cancelled', () => {
      for (const code of [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowLeft',
        'Enter',
      ]) {
        expect(pressOn(field, code).defaultPrevented).toBe(false);
      }
      expect(intents).toEqual([]);
    });

    it('P in a text field does not pause', () => {
      pressOn(field, 'KeyP');
      expect(pauseState.paused()).toBe(false);
    });

    it('Space on a focused button presses the button, and still never pauses', () => {
      const event = pressOn(button, 'Space');
      expect(event.defaultPrevented).toBe(false); // native activation stays
      expect(pauseState.paused()).toBe(false); // the core listener never saw it
      expect(intents).toEqual([]);
    });

    it('a button left focused by a click does not eat the game keys (the settings gear)', () => {
      pressOn(button, 'ArrowLeft');
      pressOn(button, 'KeyW');
      expect(intents).toEqual([
        { type: 'move', dir: 'left' },
        { type: 'move', dir: 'up' },
      ]);
      pressOn(button, 'KeyP');
      expect(pauseState.paused()).toBe(true); // P and Escape still pause
    });

    it('paused, Space on a focused button resumes instead of pressing it', () => {
      pauseState.pause();
      const event = pressOn(button, 'Space');
      expect(event.defaultPrevented).toBe(true);
      expect(pauseState.paused()).toBe(false);
    });

    it('paused, Space in a text field still types a space', () => {
      pauseState.pause();
      expect(pressOn(field, 'Space').defaultPrevented).toBe(false);
      expect(pauseState.paused()).toBe(true);
    });

    it('Space with the settings menu open reaches its focused control', () => {
      setSettingsOpen(true);
      expect(pressOn(button, 'Space').defaultPrevented).toBe(false);
      expect(pauseState.paused()).toBe(false);
    });

    /** Focus `el` the way a mouse click does: pointerdown, then focus. */
    const clickFocus = (el: HTMLElement) => {
      el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      el.focus();
    };

    it('a button focused by a click gives Space and Enter to the game (the gear does not reopen settings)', () => {
      clickFocus(button);
      expect(pressOn(button, 'Space').defaultPrevented).toBe(true); // no native click
      expect(pressOn(button, 'Enter').defaultPrevented).toBe(true);
      expect(intents).toEqual([{ type: 'action' }, { type: 'action' }]);
      expect(pauseState.paused()).toBe(false);
    });

    it('a click on a button that already had keyboard focus still counts as a click', () => {
      press('Tab');
      button.focus();
      button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(pressOn(button, 'Space').defaultPrevented).toBe(true);
      expect(intents).toEqual([{ type: 'action' }]);
    });

    it('a button reached with Tab keeps Space and Enter', () => {
      clickFocus(button);
      button.blur();
      press('Tab');
      button.focus();
      expect(pressOn(button, 'Space').defaultPrevented).toBe(false);
      expect(pressOn(button, 'Enter').defaultPrevented).toBe(false);
      expect(intents).toEqual([]);
    });

    it('with the settings menu open, a clicked control keeps its Space', () => {
      clickFocus(button);
      setSettingsOpen(true);
      expect(pressOn(button, 'Space').defaultPrevented).toBe(false);
    });

    it('paused with the settings menu open, Space reaches its focused control and stays paused', () => {
      pauseState.pause();
      setSettingsOpen(true);
      expect(pressOn(button, 'Space').defaultPrevented).toBe(false);
      expect(pauseState.paused()).toBe(true); // neither resumed nor toggled by the core listener
      expect(intents).toEqual([]);
    });
  });
});
