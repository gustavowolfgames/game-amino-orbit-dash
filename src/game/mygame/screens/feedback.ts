/**
 * feedback — what each sim event sounds like, says, and does on screen.
 *
 * The controller drains the sim's events once a frame and runs them through this cue
 * table (`./cues.ts`): a sound, a screen-reader line, and a `run` hook that plays the
 * juice kit (`../render/juice.ts`). Nothing here writes game state, and nothing diffs
 * counters: every effect hangs off an event the sim emitted.
 *
 * `on()` is the Carina switch (src/game/setup/carina.ts): off, the hooks do nothing and
 * the game plays with sound and the HUD only, for a side-by-side.
 */

import type { Container } from 'pixi.js';
import type { GameTheme } from '~/game/brand';
import type { JuiceConfig } from '~/game/tuning';
import type { Juice } from '../render/juice';
import type { GameEvent } from '../sim/plugin';
import { createCues } from './cues';

/** The audio channels this game plays (aliases in src/game/asset-manifest.ts). */
export const SOUNDS = {
  sfx: ['sfx-pop', 'sfx-clear'],
  music: ['audio-music'],
} as const;
export type Sfx = (typeof SOUNDS.sfx)[number];

const WHITE = 0xffffff;
const hex = (css: string) => Number.parseInt(css.replace('#', ''), 16);

export interface FeedbackDeps {
  juice: () => Juice | null;
  /** The HUD (punched on a score) and the design root (shaken on the win). */
  hud: () => Container | null;
  root: () => Container | null;
  /** The theme in force (a Vault edition can bring another). */
  theme: () => GameTheme;
  tuning: () => JuiceConfig;
  /** Carina juice on? Read per event, so a tuning change applies at once. */
  on: () => boolean;
  play: (id: Sfx, opts?: { volume?: number }) => void;
  say: (text: string) => void;
}

export function createFeedback(d: FeedbackDeps) {
  return createCues<GameEvent, Sfx>(
    {
      scored: {
        sfx: 'sfx-pop',
        gapMs: 60, // one pop per 60 ms of sim time (Carina: patterns/merge-same-sound-same-frame)
        run: (e) => {
          const j = d.juice();
          if (!j || !d.on()) return;
          const t = d.tuning();
          const theme = d.theme();
          const accent = hex(theme.accent);
          // The reaction starts on the tap's own frame: no wind-up (Carina: patterns/no-wind-up-on-player-input).
          j.burst(e.x, e.y, [accent, WHITE], t.tapSparks);
          j.sparkle(e.x, e.y, 44, accent);
          j.fly(e.x, e.y, '+1', {
            fill: theme.accent,
            fontFamily: theme.fonts.numeric,
            peak: t.flyPeak,
            endScale: t.flyEndScale,
          });
          const hud = d.hud();
          if (hud) j.pop(hud, t.hudPopPeak, t.hudPopSec);
        },
      },
      phase: {
        sfx: (e) => (e.phase === 'won' ? 'sfx-clear' : null),
        aria: (e) =>
          e.phase === 'won'
            ? 'Level complete.'
            : e.phase === 'lost'
              ? 'Run over.'
              : null,
        run: (e) => {
          const j = d.juice();
          if (e.phase !== 'won' || !j || !d.on()) return;
          const t = d.tuning();
          const theme = d.theme();
          const palette = [...theme.pieces, hex(theme.accent), WHITE];
          // Hold a beat, then the payoff in layers: contrast frame, flash, shake, confetti
          // (Carina: patterns/freeze-frame-before-impact, patterns/layered-explosion).
          j.freeze(t.winFreezeFrames, () => {
            j.flash(WHITE, t.winFlashAlpha, true);
            const root = d.root();
            if (root) j.shake(root, 'medium');
            const hud = d.hud();
            if (hud) j.pop(hud, t.hudPopPeak + 0.2, t.hudPopSec * 1.5);
            for (let i = 0; i < t.winCascades; i++) {
              const x = ((i + 1) * 390) / (t.winCascades + 1);
              j.cascade(x, 330 + (i % 2) * 60, palette, t.winCascadeSparks);
            }
          });
        },
      },
    },
    { play: d.play, say: d.say },
  );
}
