/**
 * gameAudio — the game's sounds and music, typed and safe.
 *
 * One object per game screen wraps the coordinator's audio engine:
 *
 *   const audio = createGameAudio(() => deps.coordinator.audio, {
 *     sfx: ['sfx-pop', 'sfx-clear'],
 *     music: ['audio-music'],
 *     settings: deps.audio as AudioSettings | undefined,
 *   });
 *   audio.play('sfx-pop');        // typed: only a listed channel compiles
 *   audio.music('audio-music');   // the track to loop while the toggle is on
 *   audio.stopAll();              // in destroy()
 *
 * Channel names are the aliases of the `audio-*` bundles in
 * `src/game/asset-manifest.ts`. Audio is optional: a missing engine is a no-op,
 * and an engine error or an unloaded channel is logged once in dev, never
 * thrown.
 *
 * `settings` is the gear menu's saved choices (core `audioState`, passed to
 * `setupGame` as `deps.audio`): volume becomes the engine's master volume, and
 * the music toggle plays or stops the current track, now and on every change.
 * Those two are Solid effects, so create this inside `setupGame` (GameScreen's
 * reactive owner disposes them with the screen). No DOM.
 */

import { createEffect, createSignal } from 'solid-js';

/** The slice of the coordinator's audio API this needs (`deps.coordinator.audio`). */
export interface AudioEngine {
  /** Returns the sound id, or -1 when the channel is not loaded. */
  play: (
    channel: string,
    sprite?: string,
    opts?: { volume?: number; loop?: boolean },
  ) => unknown;
  stop: (channel: string) => void;
  setMasterVolume?: (volume: number) => void;
}

/** The saved settings (core audioState). */
export interface AudioSettings {
  volume: () => number;
  musicEnabled: () => boolean;
}

export interface GameAudioOptions<S extends string, M extends string> {
  /** Sound-effect channels the game plays. */
  sfx: readonly S[];
  /** Music channels; each loops through its sidecar's `loop` sprite. */
  music?: readonly M[];
  /** The gear menu's volume and music toggle. Without it: full volume, music on. */
  settings?: AudioSettings;
}

export interface GameAudio<S extends string, M extends string> {
  /** Play a sound effect once. `volume` (0–1) is this sound's loudness. */
  play: (id: S, opts?: { volume?: number }) => void;
  /** Loop this track (null: silence). The music toggle still applies. */
  music: (id: M | null) => void;
  /** Stop the music and every sound effect (call in `destroy`). */
  stopAll: () => void;
}

/** The sidecar sprite a music track loops (`[0, duration, true]`). */
const MUSIC_SPRITE = 'loop';

export function createGameAudio<
  const S extends string,
  const M extends string = never,
>(
  engine: () => AudioEngine | undefined,
  options: GameAudioOptions<S, M>,
): GameAudio<S, M> {
  const { sfx, settings } = options;
  const warned = new Set<string>();

  const warnOnce = (key: string, message: string, err?: unknown) => {
    if (!import.meta.env.DEV || warned.has(key)) return;
    warned.add(key);
    console.warn(`[gameAudio] ${message}`, ...(err === undefined ? [] : [err]));
  };

  /** Run one engine call; never throw. */
  const safely = (key: string, fn: (e: AudioEngine) => unknown) => {
    const e = engine();
    if (!e) return;
    try {
      if (fn(e) === -1)
        warnOnce(
          `missing:${key}`,
          `channel "${key}" is not loaded (an audio-* bundle in asset-manifest.ts?)`,
        );
    } catch (err) {
      warnOnce(`error:${key}`, `"${key}" failed`, err);
    }
  };

  // ── Music: the wanted track, gated by the toggle ──────────────────────────
  let current: M | null = null;
  const apply = (target: M | null) => {
    if (target === current) return;
    const prev = current;
    current = target;
    if (prev) safely(prev, (e) => e.stop(prev));
    if (target) safely(target, (e) => e.play(target, MUSIC_SPRITE));
  };

  const [wanted, setWanted] = createSignal<M | null>(null);
  if (settings) {
    createEffect(() => {
      const volume = settings.volume();
      safely('volume', (e) => e.setMasterVolume?.(volume));
    });
    createEffect(() => apply(settings.musicEnabled() ? wanted() : null));
  }

  return {
    play: (id, opts) =>
      safely(id, (e) =>
        e.play(id, undefined, opts?.volume == null ? undefined : opts),
      ),
    music: (id) => {
      if (settings) setWanted(() => id);
      else apply(id);
    },
    stopAll: () => {
      setWanted(null);
      apply(null);
      for (const id of sfx) safely(id, (e) => e.stop(id));
    },
  };
}
