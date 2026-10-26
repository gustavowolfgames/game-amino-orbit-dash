/**
 * Skipped start screen (the Vault): audio unlocks on the player's gestures
 * (src/game/screens/unlockAudioOnFirstTap.ts) until it is actually running, then the
 * listeners go away.
 */

import { describe, expect, it, vi } from 'vitest';
import { unlockAudioOnFirstTap } from '~/game/screens/unlockAudioOnFirstTap';

const fire = (t: EventTarget, type: string) => t.dispatchEvent(new Event(type));
const key = (t: EventTarget, k: string) => {
  const e = new Event('keydown');
  Object.defineProperty(e, 'key', { value: k });
  t.dispatchEvent(e);
};
/** Let the awaited `unlock()` settle. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** An audio engine that starts running when `unlock` is called after `ready`. */
function engine() {
  const state = { ready: false, running: false };
  const unlock = vi.fn(() => {
    if (state.ready) state.running = true;
  });
  return { state, unlock, isRunning: () => state.running };
}

describe('unlockAudioOnFirstTap', () => {
  it('unlocks on the first tap, then stops listening once audio runs', async () => {
    const target = new EventTarget();
    const a = engine();
    a.state.ready = true;
    unlockAudioOnFirstTap(a.unlock, a.isRunning, target);
    expect(a.unlock).not.toHaveBeenCalled();

    fire(target, 'pointerdown');
    await settle();
    expect(a.state.running).toBe(true);
    fire(target, 'pointerup');
    fire(target, 'keydown');
    await settle();
    expect(a.unlock).toHaveBeenCalledTimes(1);
  });

  it('a tap before the audio exists (loader still running) does not use the listener up', async () => {
    const target = new EventTarget();
    const a = engine(); // not ready: Howler has made no audio yet
    unlockAudioOnFirstTap(a.unlock, a.isRunning, target);
    fire(target, 'pointerdown');
    fire(target, 'pointerup');
    await settle();
    expect(a.state.running).toBe(false);

    a.state.ready = true; // the loader finished
    fire(target, 'pointerdown');
    await settle();
    expect(a.state.running).toBe(true);
  });

  it('Escape is not a gesture: it does not try, and the next tap still unlocks', async () => {
    const target = new EventTarget();
    const a = engine();
    a.state.ready = true;
    unlockAudioOnFirstTap(a.unlock, a.isRunning, target);
    key(target, 'Escape');
    await settle();
    expect(a.unlock).not.toHaveBeenCalled();
    fire(target, 'pointerup');
    await settle();
    expect(a.state.running).toBe(true);
  });

  it('a key press counts as a gesture', async () => {
    const target = new EventTarget();
    const a = engine();
    a.state.ready = true;
    unlockAudioOnFirstTap(a.unlock, a.isRunning, target);
    key(target, 'Enter');
    await settle();
    expect(a.state.running).toBe(true);
  });

  it('adds nothing when the boot-time unlock already worked', () => {
    const target = new EventTarget();
    const a = engine();
    a.state.running = true;
    unlockAudioOnFirstTap(a.unlock, a.isRunning, target);
    fire(target, 'pointerdown');
    expect(a.unlock).not.toHaveBeenCalled();
  });

  it('the returned function removes the listeners early', async () => {
    const target = new EventTarget();
    const a = engine();
    unlockAudioOnFirstTap(a.unlock, a.isRunning, target)();
    fire(target, 'pointerdown');
    await settle();
    expect(a.unlock).not.toHaveBeenCalled();
  });
});
