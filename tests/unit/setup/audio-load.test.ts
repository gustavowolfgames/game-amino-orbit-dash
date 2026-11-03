/**
 * Background audio load (src/game/setup/audioLoad.ts): the first call starts it, later calls
 * do nothing, and `whenAudioLoaded` settles when it finishes, even when it fails.
 */

import { describe, expect, it, vi } from 'vitest';

/** A fresh copy of the module per test: its state is module-scoped by design. */
async function freshModule() {
  vi.resetModules();
  return import('~/game/setup/audioLoad');
}

describe('loadAudioInBackground', () => {
  it('starts the load once and settles whenAudioLoaded when it finishes', async () => {
    const { loadAudioInBackground, whenAudioLoaded } = await freshModule();
    let finish!: () => void;
    const load = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    let settled = false;
    void whenAudioLoaded().then(() => {
      settled = true;
    });
    loadAudioInBackground(load);
    loadAudioInBackground(load); // the title and Play both ask: one load
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    finish();
    await whenAudioLoaded();
    expect(settled).toBe(true);
  });

  it('a failed load is logged and still settles, so nothing waits forever', async () => {
    const { loadAudioInBackground, whenAudioLoaded } = await freshModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loadAudioInBackground(() => Promise.reject(new Error('404')));
    await whenAudioLoaded();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('whenAudioLoaded stays pending until a load starts', async () => {
    const { whenAudioLoaded } = await freshModule();
    const result = await Promise.race([
      whenAudioLoaded().then(() => 'settled'),
      new Promise((r) => setTimeout(() => r('pending'), 20)),
    ]);
    expect(result).toBe('pending');
  });
});
