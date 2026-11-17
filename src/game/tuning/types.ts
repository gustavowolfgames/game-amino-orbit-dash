import type { MotionPresetName } from '@wolfgames/components/modules/logic/motion-presets';
import type { GameTuningBase } from '~/core/systems/tuning/types';

// ============================================
// GAME TUNING TYPES — Template
//
// Add your game-specific tuning interfaces here.
// Each section maps to a Tweakpane folder in dev mode.
// ============================================

export interface DevModeConfig {
  /** Skip the start screen and go directly into gameplay */
  skipStartScreen: boolean;
}

export interface GameScreensConfig {
  startBackgroundColor: string;
  loadingBackgroundColor: string;
}

export interface StartScreenConfig {
  /** Ambient motion preset for the title logo (SpriteLogoTitle). */
  logoMotion: MotionPresetName;
  /** Idle motion preset for the Play button (SpriteButton). */
  buttonMotion: MotionPresetName;
}

/**
 * Game feel: the numbers the juice kit (src/game/mygame/render/juice.ts) plays with. Each one
 * comes from the Carina pattern named beside it (.agents/recipes/feel.md); retune here, not in
 * the verbs. `carina: false` (or `?carina=0`, read in src/game/setup/carina.ts) turns the kit off
 * so the same build can be compared with and without it.
 */
export interface JuiceConfig {
  /** Play the Carina juice on events. `?carina=0|1` overrides it for one page load. */
  carina: boolean;
  /** Sparks per tap (Carina: patterns/effects-budget-drop-the-least-noticed, 50–80 live cap). */
  tapSparks: number;
  switchSparks: number;
  switchPopPeak: number;
  switchRecoverSec: number;
  hitSparks: number;
  hitFlashAlpha: number;
  /** "+1" scale on its first frame, settling to `flyEndScale` (Carina: patterns/take-hit-first-frame-strongest). */
  flyPeak: number;
  flyEndScale: number;
  /** HUD punch on a score: peak scale and recovery seconds (Carina: patterns/take-hit-first-frame-strongest). */
  hudPopPeak: number;
  hudPopSec: number;
  /** Frames held before the win payoff; 3–5 for a finisher (Carina: patterns/freeze-frame-before-impact). */
  winFreezeFrames: number;
  /** White flash peak alpha on the win (Carina: patterns/layered-explosion). */
  winFlashAlpha: number;
  /** Confetti showers on the win, and sparks in each (kept under the 80-particle budget). */
  winCascades: number;
  winCascadeSparks: number;
  /** Seconds the win moment holds before the end card, so the payoff reads. */
  winHoldSec: number;
}

export interface GameTuning extends GameTuningBase {
  devMode: DevModeConfig;
  screens: GameScreensConfig;
  startScreen: StartScreenConfig;
  juice: JuiceConfig;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const GAME_DEFAULTS: GameTuning = {
  version: '1.0.0',
  devMode: {
    skipStartScreen: false,
  },
  screens: {
    startBackgroundColor: '#BCE083',
    loadingBackgroundColor: '#BCE083',
  },
  startScreen: {
    logoMotion: 'breathe', // scale pulse only — no tilt/sway
    buttonMotion: 'gentle', // float + breathe
  },
  juice: {
    carina: true,
    tapSparks: 14,
    switchSparks: 7,
    switchPopPeak: 1.18,
    switchRecoverSec: 0.12,
    hitSparks: 18,
    hitFlashAlpha: 0.28,
    flyPeak: 1.9,
    flyEndScale: 0.9,
    hudPopPeak: 1.22,
    hudPopSec: 0.4,
    winFreezeFrames: 5,
    winFlashAlpha: 0.6,
    winCascades: 3,
    winCascadeSparks: 26,
    winHoldSec: 1.7,
  },
};

// ============================================
// HELPERS
// ============================================

/** Parse theme from URL params — override in your game if needed */
export function getThemeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('theme') ?? null;
}
