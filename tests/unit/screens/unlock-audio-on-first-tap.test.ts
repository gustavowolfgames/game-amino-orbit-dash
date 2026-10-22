/**
 * Skipped start screen (the Vault): audio unlocks on the player's first gesture
 * (src/game/screens/unlockAudioOnFirstTap.ts), then the listeners go away.
 */

import { describe, expect, it, vi } from 'vitest';
import { unlockAudioOnFirstTap } from '~/game/screens/unlockAudioOnFirstTap';

const fire = (t: EventTarget, type: string) => t.dispatchEvent(new Event(type));

describe('unlockAudioOnFirstTap', () => {
  it('unlocks on press and release of the first tap, then stops listening', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockAudioOnFirstTap(unlock, target);
    expect(unlock).not.toHaveBeenCalled();

    fire(target, 'pointerdown');
    fire(target, 'pointerup');
    expect(unlock).toHaveBeenCalledTimes(2);

    fire(target, 'pointerdown');
    fire(target, 'pointerup');
    fire(target, 'keydown');
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it('a key press counts as the first gesture', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockAudioOnFirstTap(unlock, target);
    fire(target, 'keydown');
    fire(target, 'pointerup');
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('the returned function removes the listeners early', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockAudioOnFirstTap(unlock, target)();
    fire(target, 'pointerdown');
    fire(target, 'pointerup');
    expect(unlock).not.toHaveBeenCalled();
  });
});
