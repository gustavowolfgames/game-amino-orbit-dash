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
 * Audio loads last, in the background (src/game/setup/audioLoad.ts), so the game can start
 * before its track has arrived: `music(id)` sets the track the game wants, and it starts as
 * soon as its file has loaded and the first tap has unlocked audio, whichever comes last.
 *
 * `settings` is the gear menu's saved choices (core `audioState`, passed to
 * `setupGame` as `deps.audio`): volume becomes the engine's master volume, and
 * the music toggle plays or stops the current track, now and on every change.
 * Those two are Solid effects, so create this inside `setupGame` (GameScreen's
 * reactive owner disposes them with the screen). No DOM.
 */

import { createEffect, createSignal } from 'solid-js';
import { whenAudioLoaded } from '~/game/setup/audioLoad';

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
  /** Settles when the background audio load finishes; a track asked for before then starts
   *  at that point. Default: `whenAudioLoaded` (src/game/setup/audioLoad.ts). */
  whenLoaded?: () => Promise<unknown>;
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
  const { sfx, settings, whenLoaded = whenAudioLoaded } = options;
  const warned = new Set<string>();

  const warnOnce = (key: string, message: string, err?: unknown) => {
    if (!import.meta.env.DEV || warned.has(key)) return;
    warned.add(key);
    console.warn(`[gameAudio] ${message}`, ...(err === undefined ? [] : [err]));
  };

  /** Run one engine call; never throw. False when it failed or the channel is not loaded. */
  const safely = (
    key: string,
    fn: (e: AudioEngine) => unknown,
    quiet = false,
  ): boolean => {
    const e = engine();
    if (!e) return false;
    try {
      if (fn(e) !== -1) return true;
      if (!quiet)
        warnOnce(
          `missing:${key}`,
          `channel "${key}" is not loaded (an audio-* bundle in asset-manifest.ts?)`,
        );
    } catch (err) {
      warnOnce(`error:${key}`, `"${key}" failed`, err);
    }
    return false;
  };

  // ── Music: the wanted track, gated by the toggle ──────────────────────────
  // `current` is the track the game wants now; `playing` says whether the engine took it.
  // A track asked for before its file has loaded starts when the background load settles.
  let current: M | null = null;
  let playing = false;
  const start = (track: M, quiet: boolean) => {
    playing = safely(track, (e) => e.play(track, MUSIC_SPRITE), quiet);
  };
  const apply = (target: M | null) => {
    if (target === current) return;
    const prev = current;
    current = target;
    if (prev && playing) safely(prev, (e) => e.stop(prev));
    playing = false;
    if (!target) return;
    start(target, true);
    if (!playing)
      void whenLoaded().then(() => {
        if (current === target && !playing) start(target, false);
      });
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
