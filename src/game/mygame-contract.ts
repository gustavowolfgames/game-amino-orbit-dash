/**
 * mygame Contract
 *
 * Defines the exact interfaces that `mygame/` must export.
 * When an LLM generates a new game, it must satisfy these types.
 *
 * `mygame/index.ts` must export:
 *   - setupGame: (deps: GameControllerDeps) => GameController
 *   - setupStartScreen: (deps: StartScreenDeps) => StartScreenController
 *
 * Game Mode:
 *   - 'dom'     — DOM/CSS-only game. No GPU init needed, no scene or core bundles.
 *                 Use this when generating games without sprite assets.
 *   - 'pixi'    — PixiJS game. Requires initGpu(), expects core and scene bundles
 *                 in the asset manifest. Use this when sprite/atlas assets are
 *                 available.
 *   - 'layered' — Opt-in: an extra GPU context over one container — either more
 *                 than one stacked render layer (e.g. a Three.js 3D layer over a
 *                 Pixi 2D layer, or a Pixi layer over a DOM layer) or a bounded
 *                 embedded 3D widget (e.g. a dice roller). Every layer/widget is
 *                 an independent read-only projection of the SAME ECS world; call
 *                 `initGpu()` before mount for any GPU-based layer. This is the
 *                 sanctioned exception to guardrail #16 (see
 *                 `docs/standards/guardrails.md` Section 16) — the extra context
 *                 must share ECS as the single source of truth, never a second
 *                 game-state store. The `composeLayers` helper that implements
 *                 the full-layer case is provided per-game (promoted to
 *                 `@wolfgames/components` once proven), not shipped in the
 *                 template.
 *
 * Pixi texture lifecycle:
 *   When calling coordinator.unloadBundle() for a scene-* bundle, ALL Pixi sprites
 *   referencing that bundle's textures MUST be removed from the stage first.
 *   Otherwise Pixi's renderer will crash with "Cannot read properties of null
 *   (reading 'alphaMode')". Pattern: kill GSAP tweens → removeChild → destroy → unloadBundle.
 */

import type { AssetCoordinatorFacade } from '~/core/systems/assets';
import type { ScaffoldTuning } from '~/core/systems/tuning/types';
import type { GameTuningBase } from '~/core/systems/tuning/types';

export type GameMode = 'dom' | 'pixi' | 'layered';

// ---------------------------------------------------------------------------
// Game Controller (used by GameScreen.tsx)
// ---------------------------------------------------------------------------

export interface GameControllerDeps {
  coordinator: AssetCoordinatorFacade;
  tuning: { scaffold: ScaffoldTuning; game: GameTuningBase };
  audio: unknown;
  gameData: unknown;
  analytics: unknown;
  /** Navigate to another screen (e.g. 'results' when the game ends). */
  goto?: (screen: string) => void;
}

export interface GameController {
  /** Mount the game into a container div (Pixi canvas, DOM, etc.) */
  init: (container: HTMLDivElement) => void;
  /** Tear down the game and release resources */
  destroy: () => void;
  /** Reactive accessibility text for screen readers */
  ariaText: () => string;
  /**
   * Rendering mode. When 'dom', the scaffold skips GPU init and core-* bundle
   * loading. When 'pixi', the scaffold ensures GPU is initialised before mount.
   * When 'layered', the controller owns an opt-in extra GPU context (a composed
   * stack of layers or a bounded embedded 3D widget) over the container and is
   * responsible for its own GPU init for any GPU-based layer — the sanctioned
   * exception to guardrail #16 (see `docs/standards/guardrails.md` Section 16).
   * Defaults to 'dom' if omitted.
   */
  gameMode?: GameMode;
}

export type SetupGame = (deps: GameControllerDeps) => GameController;

// ---------------------------------------------------------------------------
// Start Screen Controller (used by StartScreen.tsx)
// ---------------------------------------------------------------------------

export interface StartScreenDeps {
  goto: (screen: string) => void;
  coordinator: AssetCoordinatorFacade;
  initGpu: () => Promise<void>;
  unlockAudio: () => void;
  loadCore: (onProgress?: (p: number) => void) => Promise<void>;
  loadAudio: (onProgress?: (p: number) => void) => Promise<void>;
  loadBundle?: (name: string, onProgress?: (p: number) => void) => Promise<void>;
  tuning: { scaffold: ScaffoldTuning; game: GameTuningBase };
  analytics: { trackGameStart: (params: { start_source: string; is_returning_player: boolean }) => void };
}

export interface StartScreenController {
  /** Mount the start screen into a container div */
  init: (container: HTMLDivElement) => void;
  /** Tear down the start screen */
  destroy: () => void;
  /** Background color for the screen wrapper */
  backgroundColor: string;
}

export type SetupStartScreen = (deps: StartScreenDeps) => StartScreenController;
