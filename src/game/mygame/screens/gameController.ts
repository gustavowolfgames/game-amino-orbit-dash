/**
 * Game Controller — the frame a game plugs into (Pixi).
 *
 * This is the template core, not a game. It owns the renderer lifecycle and the
 * wiring every game needs, and draws only the background and the HUD:
 *
 *   • Pixi app + a `DesignLayer` on `DESIGN_CANVAS` (390×844, the canvas the
 *     title screen uses), fitted by `trackHostBox`, with a cover-fit background
 *     in screen space.
 *   • Input (`../input/pointer.ts`): a tap calls the example `tap` transaction.
 *   • The fixed-step sim (`startFixedStepLoop` → `stepWorld` → `SYSTEM_ORDER`)
 *     plus a per-frame `render` where the game projects ECS into its views
 *     (`../render/`).
 *   • Feedback: `render` drains the sim's events (`drainEvents`) once a frame
 *     and runs them through the cue table (`./cues.ts`): sound through
 *     `./gameAudio.ts`, the screen-reader line through `ariaText`.
 *   • Content: each run plays one level of the active Content Pack (`levelAt`,
 *     src/game/content). Winning moves to the pack's next level; winning its last
 *     level reports the edition complete to the Vault.
 *   • The sim and input stop while the settings menu is open (`settingsOpen`,
 *     set by `GameSettingsMenu`, the one menu on every screen) or the game is
 *     paused (space bar, core pause state).
 *   • A terminal phase (`won` / `lost`) ends on the end screen: a win / lose card
 *     over the board (`../render/endScreen.ts`), or the DOM results screen when
 *     `END_SCREEN` is `'dom'`. A pack the Vault takes over shows neither.
 *
 * Keep this file thin (`bun run check:agent` caps it): game views, rules and
 * input live in their own folders. A turn-based game drops the frame loop and
 * resolves turns on input instead.
 *
 * Lifecycle (world owned by world.ts, never disposed here):
 *   init:    getGameWorld() → build Pixi → startRun → start the fixed-step loop
 *   destroy: destroyed flag → stop loop → engine.destroy → kill tweens →
 *            end screen →
 *            renderer teardown → setActiveInspectorActions([])
 */

import type { HudDisplay } from '@wolfgames/components/modules/primitives/hud-display';
import { DesignLayer, trackHostBox } from '@wolfgames/components/pixi';
import gsap from 'gsap';
import {
  Application,
  Color,
  type Container,
  Sprite,
  type Texture,
} from 'pixi.js';
import { createSignal } from 'solid-js';
import { exposePixiApp } from '~/core/dev/pixiDevtools';
import { setActiveInspectorActions } from '~/core/systems/ecs';
import { pauseState } from '~/core/systems/pause';
import { getTheme } from '~/game/brand';
import { getActivePack, isLastLevel, levelAt } from '~/game/content';
import type {
  GameController,
  GameControllerDeps,
  SetupGame,
} from '~/game/mygame-contract';
import { settingsOpen } from '~/game/settingsOpen';
import { whenContentSettled } from '~/game/setup/content';
import { createRunAnalytics } from '~/game/setup/edition-analytics';
import {
  recordLevelWon,
  resumeLevel,
  saveProgress,
} from '~/game/setup/progress';
import { completeActivePack } from '~/game/setup/served-session';
import { END_SCREEN } from '../config';
import type { EngineHandle } from '../engine';
import { createTickerEngine, startFixedStepLoop } from '../engine';
import { bindTapInput } from '../input/pointer';
import { createEndScreen, type EndScreen } from '../render/endScreen';
import { createHud } from '../render/hud';
import { ensureResultsArt } from '../render/resultsArt';
import { loadGameTextures } from '../render/textures';
import { drainEvents } from '../sim/events';
import type { GameDatabase, GameEvent, GamePhase } from '../sim/plugin';
import { stepWorld } from '../sim/schedule';
import { getGameWorld } from '../world';
import { createCues } from './cues';
import { type AudioSettings, createGameAudio } from './gameAudio';

/** Delay (s) before the end screen, so the last frame (and the confetti) reads. */
const END_PAUSE = 0.9;

/** The audio channels this game plays (aliases in src/game/asset-manifest.ts). */
const SOUNDS = {
  sfx: ['sfx-pop', 'sfx-clear'],
  music: ['audio-music'],
} as const;
type Sfx = (typeof SOUNDS.sfx)[number];

/** Deps optionally carry `goto` (GameScreen injects it) for the results hop. */
type Deps = GameControllerDeps & { goto?: (screen: string) => void };

export const setupGame: SetupGame = (
  rawDeps: GameControllerDeps,
): GameController => {
  const deps = rawDeps as Deps;
  const [ariaText, setAriaText] = createSignal('Loading…');
  const [endScreenOpen, setEndScreenOpen] = createSignal(false);
  // Settled by the loading screen before this screen exists; re-read when a Vault edition
  // brings its own brand (`restyle`).
  let theme = getTheme();
  // level_* + edition_* events (src/game/setup/edition-analytics.ts); no-ops without a service.
  const runAnalytics = createRunAnalytics(deps.analytics);

  let app: Application | null = null;
  let releasePixiApp: (() => void) | null = null;
  let db: GameDatabase | null = null;
  let engine: EngineHandle | null = null;
  let stopSim: (() => void) | null = null;
  let stopRender: (() => void) | null = null;
  let unbindInput: (() => void) | null = null;
  let stopResize: (() => void) | null = null;
  let destroyed = false;
  let initPromise: Promise<void> | null = null;

  /** Design-space root on DESIGN_CANVAS: the game's views go in here. */
  let root: DesignLayer | null = null;
  /** Full-bleed background (screen space). */
  let fieldBg: Sprite | null = null;
  let hud: HudDisplay | null = null;
  let endScreen: EndScreen | null = null;

  /** Guard so a terminal phase only triggers one transition. */
  let handledPhase: GamePhase | null = null;

  // ── Audio + feedback ───────────────────────────────────────────────────────
  // The gear menu's volume and music toggle apply through `settings`; a missing
  // engine or channel is a no-op (./gameAudio.ts).
  const audio = createGameAudio(() => deps.coordinator?.audio, {
    ...SOUNDS,
    settings: deps.audio as AudioSettings | undefined,
  });
  /** What each sim event sounds like and says (./cues.ts). */
  const cues = createCues<GameEvent, Sfx>(
    {
      scored: { sfx: 'sfx-pop', gapMs: 60 },
      phase: {
        sfx: (e) => (e.phase === 'won' ? 'sfx-clear' : null),
        aria: (e) =>
          e.phase === 'won'
            ? 'Level complete.'
            : e.phase === 'lost'
              ? 'Run over.'
              : null,
      },
    },
    { play: audio.play, say: setAriaText },
  );

  // ── Per-frame render (projection of ECS) ───────────────────────────────────
  // The game reconciles its views against ECS here, then plays the frame's events.
  const render = (_dtSec: number) => {
    if (!db || destroyed) return;
    hud?.setValues({
      level: `${db.resources.level + 1}/${getActivePack().levels.length}`,
      score: db.resources.score,
    });
    cues(drainEvents(db), db.resources.elapsedMs);
    endScreen?.tick(_dtSec);
    handlePhase(db.resources.phase);
  };

  const handlePhase = (phase: GamePhase) => {
    if (phase === 'playing' || phase === 'idle' || phase === handledPhase) {
      return;
    }
    handledPhase = phase;
    const won = phase === 'won';
    const last = won && !!db && isLastLevel(db.resources.level);
    if (won && db)
      runAnalytics.levelWon(db.resources.level, db.resources.score);
    // The Vault served mode decides what a finished pack means; true = the Vault takes over.
    const handedOver = last && completeActivePack();
    if (won && db) {
      recordLevelWon(db.resources.packId, db.resources.level, last); // reload resumes the next level
      if (END_SCREEN === 'pixi') endScreen?.celebrate();
    }
    if (handedOver) return; // the Vault's end screen, not ours
    const outcome = {
      won,
      packDone: last,
      level: db?.resources.level ?? 0,
      score: db?.resources.score ?? 0,
    };
    gsap.delayedCall(END_PAUSE, () => {
      if (destroyed) return;
      if (END_SCREEN === 'dom') return deps.goto?.('results');
      setAriaText(endScreen?.show(outcome) ?? '');
    });
  };

  /** End screen: Next / Try again / Play again. A finished pack in the Vault's unlocked walk
   *  has started loading the next edition; wait for it (bounded) so the run starts there. */
  const playOn = async () => {
    endScreen?.hide();
    await whenContentSettled();
    if (destroyed) return;
    restyle();
    startRun();
  };

  /** A new edition's brand: the ground and HUD follow it (the end screen reads `theme`). */
  const restyle = () => {
    if (getTheme() === theme) return;
    theme = getTheme();
    if (app) app.renderer.background.color = theme.ground;
    if (root) buildHud(root);
  };

  /**
   * Start (or restart) a run on the right level of the active pack: the next one after a win,
   * the same one on a restart, the first one when the pack changed (a Vault edition arrived).
   * The level index and pack id live in ECS so the run's progress survives screen changes.
   */
  const startRun = () => {
    if (!db) return;
    handledPhase = null;
    if (endScreen?.open) endScreen.hide(); // the Inspector's restart, mid-card
    const pack = getActivePack();
    const prev = db.resources;
    // Read before the transaction: `prev` is the live resource object.
    const fresh = prev.packId !== pack.id || prev.phase === 'idle';
    const entry = fresh ? 'fresh' : prev.phase === 'won' ? 'next' : 'restart';
    // A fresh start resumes saved progress; otherwise the next level or the same one again.
    const next = fresh
      ? resumeLevel(pack)
      : prev.level + (entry === 'next' ? 1 : 0);
    const index = next % pack.levels.length;
    const { seed, goal } = levelAt(index);
    db.transactions.startRun({ seed, goal, level: index, packId: pack.id });
    saveProgress(pack.id, index);
    runAnalytics.levelStarted(index, entry);
    setAriaText(`Level ${index + 1} of ${pack.levels.length}.`);
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  // `trackHostBox` fits the renderer and `root`; this is its callback for the
  // screen-space background, which takes the raw box.
  const fitBackground = (w: number, h: number) => {
    // Cover-fit the background so it always fills the viewport, cropping overflow.
    if (fieldBg) {
      const tw = fieldBg.texture.width;
      const th = fieldBg.texture.height;
      const cover = Math.max(w / tw, h / th);
      fieldBg.width = tw * cover;
      fieldBg.height = th * cover;
      fieldBg.position.set(w / 2, h / 2);
    }
  };

  // ── Scene construction ─────────────────────────────────────────────────────
  const buildScene = (stage: Container, field: Texture) => {
    root = new DesignLayer();
    root.eventMode = 'passive';

    fieldBg = new Sprite(field);
    fieldBg.anchor.set(0.5);
    fieldBg.eventMode = 'none';
    stage.addChild(fieldBg);
    stage.addChild(root);
    buildHud(root);

    const gpu = deps.coordinator.getGpuLoader();
    if (gpu && END_SCREEN === 'pixi')
      endScreen = createEndScreen(root, gpu, {
        palette: () => ({
          colors: theme.pieces,
          flash: new Color(theme.accent).toNumber(),
        }),
        onPrimary: () => void playOn(),
        onSecondary: () => deps.goto?.('start'),
        onOpenChange: setEndScreenOpen,
      });
  };

  /** The level/score HUD in the current theme (replaces the old one on a restyle). */
  const buildHud = (parent: Container) => {
    hud?.destroy();
    hud = createHud(theme);
    parent.addChildAt(hud, 0); // under the end screen
  };

  return {
    gameMode: 'pixi',

    init(container: HTMLDivElement) {
      // 1. App-scoped ECS world: single source of truth.
      db = getGameWorld();

      // 2. Pixi renderer.
      const application = new Application();
      app = application;
      initPromise = application
        .init({
          resizeTo: container,
          background: theme.ground,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        })
        .then(async () => {
          if (destroyed || !db) return;
          releasePixiApp = exposePixiApp(application);
          container.appendChild(application.canvas as HTMLCanvasElement);

          const [{ field }] = await Promise.all([
            loadGameTextures(deps.coordinator),
            END_SCREEN === 'pixi' ? ensureResultsArt() : null, // placeholder until published
          ]);
          if (destroyed || !db) return;

          buildScene(application.stage, field);
          stopResize = trackHostBox(
            application,
            container,
            [root as DesignLayer],
            fitBackground,
          );
          const world = db;
          unbindInput = bindTapInput(
            application,
            root as DesignLayer,
            (point) => world.transactions.tap(point),
            () => !(pauseState.paused() || settingsOpen() || endScreen?.open),
          );

          // 3. Start the run, then drive the fixed-step sim + per-frame render.
          startRun();
          audio.music('audio-music'); // audio unlocked on the start-screen tap; respects the toggle

          engine = createTickerEngine();
          stopSim = startFixedStepLoop(engine, (dt) => {
            if (db && !destroyed && !(pauseState.paused() || settingsOpen()))
              stepWorld(db, dt);
          });
          stopRender = engine.onFrame((dtMs) => render(dtMs / 1000));

          // Dev/bot surface (Inspector, backtick).
          setActiveInspectorActions([
            {
              id: 'restart-run',
              label: () => '↻ Restart level',
              run: () => startRun(),
            },
            {
              id: 'win-run',
              label: () => '✓ Win level',
              run: () => db?.transactions.setPhase('won'),
            },
          ]);
        });
    },

    destroy() {
      destroyed = true;
      audio.stopAll();
      stopSim?.();
      stopRender?.();
      stopSim = stopRender = null;
      engine?.destroy();
      engine = null;
      unbindInput?.();
      unbindInput = null;
      stopResize?.();
      stopResize = null;

      const teardown = () => {
        releasePixiApp?.();
        releasePixiApp = null;
        endScreen?.destroy();
        endScreen = null;
        app?.destroy(true, { children: true });
        app = null;
        hud?.destroy();
        hud = null;
        root = null;
        // Textures live in Pixi's global Assets cache (keyed by URL) and are
        // reused across screens: just drop our reference, don't destroy them.
        fieldBg = null;
        setActiveInspectorActions([]);
        db = null;
      };
      void (initPromise ? initPromise.then(teardown, teardown) : teardown());
    },

    /** Keyboard (useGameKeyboard): the end card's buttons. The template's board takes none. */
    input(intent) {
      if (!endScreen?.open) return;
      if (intent.type === 'action') void playOn();
      else if (intent.type === 'back') deps.goto?.('start');
    },

    ariaText,
    endScreenOpen,
  };
};
