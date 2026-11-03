/**
 * Game audio (src/game/mygame/screens/gameAudio.ts): typed sounds and music
 * over the coordinator's engine. The settings menu's volume → master volume and
 * music toggle → play/stop, on load and on every change. Errors never throw.
 */

import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import {
  type AudioEngine,
  createGameAudio,
} from '~/game/mygame/screens/gameAudio';

function fakeEngine(loaded = true) {
  const calls: string[] = [];
  const engine: AudioEngine = {
    play: (channel, sprite, opts) => {
      calls.push(
        `play ${channel}${sprite ? ` ${sprite}` : ''}${opts?.volume != null ? ` @${opts.volume}` : ''}`,
      );
      return loaded ? 1 : -1;
    },
    stop: (channel) => calls.push(`stop ${channel}`),
    setMasterVolume: (v) => calls.push(`volume ${v}`),
  };
  return { engine, calls };
}

const SOUNDS = {
  sfx: ['sfx-pop', 'sfx-clear'],
  music: ['audio-music'],
} as const;

/** Solid effects settle on a microtask in tests. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** Create inside a reactive owner, as setupGame runs inside GameScreen's. */
function withSettings(
  engine: AudioEngine | undefined,
  volume: () => number,
  musicEnabled: () => boolean,
) {
  let audio:
    | ReturnType<typeof createGameAudio<'sfx-pop' | 'sfx-clear', 'audio-music'>>
    | undefined;
  const dispose = createRoot((d) => {
    audio = createGameAudio(() => engine, {
      ...SOUNDS,
      settings: { volume, musicEnabled },
    });
    return d;
  });
  if (!audio) throw new Error('not created');
  return { audio, dispose };
}

describe('createGameAudio', () => {
  it('plays a sound effect, with its own volume when given', () => {
    const { engine, calls } = fakeEngine();
    const audio = createGameAudio(() => engine, SOUNDS);
    audio.play('sfx-pop');
    audio.play('sfx-clear', { volume: 0.5 });
    expect(calls).toEqual(['play sfx-pop', 'play sfx-clear @0.5']);
  });

  it('applies the saved volume at once and on every change', async () => {
    const { engine, calls } = fakeEngine();
    const [volume, setVolume] = createSignal(0.5);
    const { dispose } = withSettings(engine, volume, () => true);
    await settle();
    expect(calls).toContain('volume 0.5');
    setVolume(0.3);
    await settle();
    expect(calls.at(-1)).toBe('volume 0.3');
    dispose();
  });

  it('plays music only once asked, and follows the toggle', async () => {
    const { engine, calls } = fakeEngine();
    const [musicEnabled, setMusicEnabled] = createSignal(true);
    const { audio, dispose } = withSettings(engine, () => 1, musicEnabled);
    await settle();
    expect(calls.filter((c) => c.startsWith('play'))).toEqual([]);
    audio.music('audio-music');
    await settle();
    expect(calls.at(-1)).toBe('play audio-music loop');
    setMusicEnabled(false);
    await settle();
    expect(calls.at(-1)).toBe('stop audio-music');
    setMusicEnabled(true);
    await settle();
    expect(calls.at(-1)).toBe('play audio-music loop');
    audio.music(null);
    await settle();
    expect(calls.at(-1)).toBe('stop audio-music');
    dispose();
  });

  it('never starts music that is switched off', async () => {
    const { engine, calls } = fakeEngine();
    const { audio, dispose } = withSettings(
      engine,
      () => 1,
      () => false,
    );
    audio.music('audio-music');
    await settle();
    expect(calls.filter((c) => c.startsWith('play'))).toEqual([]);
    dispose();
  });

  it('stopAll stops the music at once and every sound channel', async () => {
    const { engine, calls } = fakeEngine();
    const audio = createGameAudio(() => engine, SOUNDS); // no settings: direct
    audio.music('audio-music');
    expect(calls).toEqual(['play audio-music loop']);
    audio.stopAll();
    expect(calls.slice(1)).toEqual([
      'stop audio-music',
      'stop sfx-pop',
      'stop sfx-clear',
    ]);
  });

  it('a missing engine is a no-op, not a crash', async () => {
    const { audio, dispose } = withSettings(
      undefined,
      () => 1,
      () => true,
    );
    expect(() => {
      audio.play('sfx-pop');
      audio.music('audio-music');
      audio.stopAll();
    }).not.toThrow();
    await settle();
    dispose();
  });

  it('an engine error or an unloaded channel is logged once, never thrown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwing: AudioEngine = {
      play: () => {
        throw new Error('boom');
      },
      stop: () => {},
    };
    const audio = createGameAudio(() => throwing, SOUNDS);
    expect(() => {
      audio.play('sfx-pop');
      audio.play('sfx-pop');
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);

    const { engine } = fakeEngine(false); // play returns -1: not loaded
    const quiet = createGameAudio(() => engine, SOUNDS);
    quiet.play('sfx-clear');
    quiet.play('sfx-clear');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[1][0])).toContain('not loaded');
    warn.mockRestore();
  });

  it('music asked for while audio is still loading starts once the load settles', async () => {
    let loaded = false;
    const calls: string[] = [];
    const engine: AudioEngine = {
      play: (channel, sprite) => {
        calls.push(`play ${channel} ${sprite}`);
        return loaded ? 1 : -1;
      },
      stop: (channel) => calls.push(`stop ${channel}`),
    };
    let finish!: () => void;
    const done = new Promise<void>((r) => {
      finish = r;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const audio = createGameAudio(() => engine, {
      ...SOUNDS,
      whenLoaded: () => done,
    });
    audio.music('audio-music'); // the game screen asks before the file has arrived
    expect(calls).toEqual(['play audio-music loop']);
    loaded = true;
    finish();
    await settle();
    expect(calls).toEqual(['play audio-music loop', 'play audio-music loop']);
    expect(warn).not.toHaveBeenCalled(); // not loaded *yet* is not an error
    warn.mockRestore();
  });

  it('a track stopped before its load settles does not start', async () => {
    let loaded = false;
    const calls: string[] = [];
    const engine: AudioEngine = {
      play: (channel) => {
        calls.push(`play ${channel}`);
        return loaded ? 1 : -1;
      },
      stop: (channel) => calls.push(`stop ${channel}`),
    };
    let finish!: () => void;
    const done = new Promise<void>((r) => {
      finish = r;
    });
    const audio = createGameAudio(() => engine, {
      ...SOUNDS,
      whenLoaded: () => done,
    });
    audio.music('audio-music');
    audio.stopAll(); // the player left the game screen first
    loaded = true;
    finish();
    await settle();
    expect(calls.filter((c) => c.startsWith('play audio-music'))).toHaveLength(
      1,
    );
    expect(calls).not.toContain('stop audio-music'); // it never played, nothing to stop
  });
});
