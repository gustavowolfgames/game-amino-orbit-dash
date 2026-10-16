/**
 * audioSettings — apply the settings menu's audio choices to the audio engine.
 *
 * The gear menu (GameSettingsMenu) writes the saved settings — core
 * `audioState` via `useAudio()`: `volume()` 0–1 and `musicEnabled()` — and
 * GameScreen passes that state to `setupGame` as `deps.audio`. Nothing applies
 * them on its own: this binding does, with two Solid effects that run now and
 * on every change:
 *
 *   volume       → the engine's master volume (every sound and the music)
 *   music on/off → play or stop the music channel, once the game says ready
 *
 * Call it inside `setupGame` (it runs in GameScreen's reactive owner, so the
 * effects are disposed with the screen). Start music with `startMusic()` once
 * the scene is up, never by playing the music channel directly, so the toggle
 * is respected; `stopMusic()` on destroy.
 */

import { createEffect, createSignal } from 'solid-js';

/** The slice of the coordinator's audio API this needs. */
export interface AudioEngine {
  play: (channel: string, sprite?: string) => unknown;
  stop: (channel: string) => void;
  setMasterVolume?: (volume: number) => void;
}

/** The saved settings (core audioState). */
export interface AudioSettings {
  volume: () => number;
  musicEnabled: () => boolean;
}

/** Audio is optional: a missing engine or channel is a no-op, never a crash. */
const quietly = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* audio optional */
  }
};

export function bindAudioSettings(
  engine: () => AudioEngine | undefined,
  settings: AudioSettings | undefined,
  musicChannel = 'audio-music',
): { startMusic: () => void; stopMusic: () => void } {
  const [ready, setReady] = createSignal(false);
  let playing = false;

  createEffect(() => {
    const volume = settings?.volume() ?? 1;
    quietly(() => engine()?.setMasterVolume?.(volume));
  });

  createEffect(() => {
    const want = ready() && (settings?.musicEnabled() ?? true);
    if (want && !playing) quietly(() => engine()?.play(musicChannel, 'loop'));
    if (!want && playing) quietly(() => engine()?.stop(musicChannel));
    playing = want;
  });

  return {
    startMusic: () => setReady(true),
    stopMusic: () => setReady(false),
  };
}
