/**
 * The settings menu's audio choices reach the audio engine
 * (src/game/mygame/screens/audioSettings.ts): volume → master volume, music
 * on/off → play/stop, on load and on every change.
 */

import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';
import {
  type AudioEngine,
  bindAudioSettings,
} from '~/game/mygame/screens/audioSettings';

function fakeEngine() {
  const calls: string[] = [];
  const engine: AudioEngine = {
    play: (channel, sprite) => calls.push(`play ${channel} ${sprite}`),
    stop: (channel) => calls.push(`stop ${channel}`),
    setMasterVolume: (v) => calls.push(`volume ${v}`),
  };
  return { engine, calls };
}

/** Solid effects settle on a microtask in tests. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('bindAudioSettings', () => {
  it('applies the saved volume at once and on every change', async () => {
    const { engine, calls } = fakeEngine();
    const [volume, setVolume] = createSignal(0.5);
    const [musicEnabled] = createSignal(true);
    const dispose = createRoot((d) => {
      bindAudioSettings(() => engine, { volume, musicEnabled });
      return d;
    });
    await settle();
    expect(calls).toContain('volume 0.5');
    setVolume(0.3);
    await settle();
    expect(calls.at(-1)).toBe('volume 0.3');
    dispose();
  });

  it('plays music only once the game says ready, and follows the toggle', async () => {
    const { engine, calls } = fakeEngine();
    const [volume] = createSignal(1);
    const [musicEnabled, setMusicEnabled] = createSignal(true);
    let music: ReturnType<typeof bindAudioSettings> | undefined;
    const dispose = createRoot((d) => {
      music = bindAudioSettings(() => engine, { volume, musicEnabled });
      return d;
    });
    await settle();
    expect(calls.filter((c) => c.startsWith('play'))).toEqual([]);
    music?.startMusic();
    await settle();
    expect(calls.at(-1)).toBe('play audio-music loop');
    setMusicEnabled(false);
    await settle();
    expect(calls.at(-1)).toBe('stop audio-music');
    setMusicEnabled(true);
    await settle();
    expect(calls.at(-1)).toBe('play audio-music loop');
    music?.stopMusic();
    await settle();
    expect(calls.at(-1)).toBe('stop audio-music');
    dispose();
  });

  it('never starts music that is switched off', async () => {
    const { engine, calls } = fakeEngine();
    const [volume] = createSignal(1);
    const [musicEnabled] = createSignal(false);
    const dispose = createRoot((d) => {
      bindAudioSettings(() => engine, { volume, musicEnabled }).startMusic();
      return d;
    });
    await settle();
    expect(calls.filter((c) => c.startsWith('play'))).toEqual([]);
    dispose();
  });

  it('a missing engine is a no-op, not a crash', async () => {
    const [volume] = createSignal(1);
    const [musicEnabled] = createSignal(true);
    expect(() =>
      createRoot((d) => {
        bindAudioSettings(() => undefined, {
          volume,
          musicEnabled,
        }).startMusic();
        return d;
      }),
    ).not.toThrow();
    await settle();
  });
});
