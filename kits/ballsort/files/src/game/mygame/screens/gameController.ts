/**
 * Game Controller — ball sort on the template's frame (Pixi).
 *
 * Owns the renderer lifecycle and the wiring; the game lives in its own folders:
 *
 *   • Pixi app + a `DesignLayer` on `DESIGN_CANVAS` (390×844), fitted by
 *     `trackHostBox`, with a cover-fit background in screen space.
 *   • Views (`../render/`): `BoardView` (tubes, balls, the keyboard cursor) and
 *     `Controls` (HUD, Undo / Restart, the "No moves left" Retry).
 *   • Input (`../input/pointer.ts`): a tap calls the `tap` transaction, which
 *     hit-tests the tubes. Buttons call `undo` / `restartLevel`. Keyboard
 *     intents arrive through `input` (`useGameKeyboard`): arrows move the tube
 *     cursor, Space / Enter taps the tube under it. Nothing is accepted while
 *     a ball is moving (`BoardView.busy`), paused, or the settings menu is open.
 *   • The fixed-step sim (`startFixedStepLoop` → `stepWorld`) keeps time; ball
 *     sort resolves every move in a transaction, so `SYSTEM_ORDER` is empty.
 *   • Feedback: `render` drains the sim's events (`drainEvents`) once a frame
 *     and runs them through the cue table (`./feedback.ts`, built on `./cues.ts`):
 *     sound through `./gameAudio.ts`, the screen-reader line through `ariaText`.
 *   • Content: each run plays one level of the active Content Pack (`levelAt`).
 *     A won level goes straight to the next; the pack's last level (reported
 *     complete to the Vault) goes to results (`./endOfPlay.ts`). A run restarted
 *     during the end pause cancels that hand-off.
 *   • Agent: while this screen is up, the live world's agent `start` runs `startRun`
 *     (`setLiveStart`, once any new Vault edition has loaded); destroy withdraws it.
 *
 * Keep this file thin (`bun run check:agent` caps it).
 *
 * Lifecycle (world owned by world.ts, never disposed here):
 *   init:    getGameWorld() → build Pixi → startRun → start the fixed-step loop
 *   destroy: destroyed flag → stop loop → engine.destroy → kill tweens →
 *            renderer teardown → setActiveInspectorActions([])
 */

import { DesignLayer, trackHostBox } from '@wolfgames/components/pixi';
import { Application, type Container, Sprite, type Texture } from 'pixi.js';
import { createSignal } from 'solid-js';
import { exposePixiApp } from '~/core/dev/pixiDevtools';
import type { PixiLoader } from '~/core/systems/assets';
import { setActiveInspectorActions } from '~/core/systems/ecs';
import { pauseState } from '~/core/systems/pause';
import { getActivePack, levelAt } from '~/game/content';
import type {
  GameController,
  GameControllerDeps,
  GameIntent,
  SetupGame,
} from '~/game/mygame-contract';
import { settingsOpen } from '~/game/settingsOpen';
import { whenContentSettled } from '~/game/setup/content';
import { createRunAnalytics } from '~/game/setup/edition-analytics';
import { resumeLevel, saveProgress } from '~/game/setup/progress';
import { setLiveStart } from '../agent/agentPlugin';
import type { EngineHandle } from '../engine';
import { createTickerEngine, startFixedStepLoop } from '../engine';
import { bindTapInput } from '../input/pointer';
import { BoardView } from '../render/BoardView';
import { type Command, Controls } from '../render/Controls';
import { loadGameTextures } from '../render/textures';
import { drainEvents } from '../sim/events';
import type { GameDatabase } from '../sim/plugin';
import { stepWorld } from '../sim/schedule';
import { getGameWorld } from '../world';
import { createEndOfPlay } from './endOfPlay';
import { createFeedback, SOUNDS } from './feedback';
import { type AudioSettings, createGameAudio } from './gameAudio';
import { createSettledStart } from './settledStart';

/** Deps optionally carry `goto` (GameScreen injects it) for the results hop. */
type Deps = GameControllerDeps & { goto?: (screen: string) => void };

export const setupGame: SetupGame = (
  rawDeps: GameControllerDeps,
): GameController => {
  const deps = rawDeps as Deps;
  const [ariaText, setAriaText] = createSignal('Loading…');
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
  let board: BoardView | null = null;
  let controls: Controls | null = null;

  // ── Audio + feedback ───────────────────────────────────────────────────────
  // The gear menu's volume and music toggle apply through `settings`; a missing
  // engine or channel is a no-op (./gameAudio.ts).
  const audio = createGameAudio(() => deps.coordinator?.audio, {
    ...SOUNDS,
    settings: deps.audio as AudioSettings | undefined,
  });
  /** What each sim event sounds like and says (./feedback.ts). */
  const cues = createFeedback({ play: audio.play, say: setAriaText });

  // ── Per-frame render (projection of ECS) ───────────────────────────────────
  // The views reconcile against ECS here, then the frame's events play.
  const render = (_dtSec: number) => {
    if (!db || destroyed) return;
    board?.update(db);
    controls?.update(db);
    cues(drainEvents(db), db.resources.elapsedMs);
    endOfPlay.handlePhase(db.resources.phase);
  };

  /** Analytics and progress at a level's end, then the next level or results
   *  (./endOfPlay.ts). A run restarted during the pause cancels the hand-off. */
  const endOfPlay = createEndOfPlay({
    world: () => db,
    analytics: runAnalytics,
    next: () => startRun(),
    toResults: () => deps.goto?.('results'),
  });

  /** Runs started on this screen, so a deferred start can tell another one beat it. */
  let runsStarted = 0;

  /**
   * Start (or restart) a run on the right level of the active pack: the next one after a win,
   * the same one on a restart, the first one when the pack changed (a Vault edition arrived).
   * The level index and pack id live in ECS so the run's progress survives screen changes.
   */
  const startRun = () => {
    if (!db) return;
    endOfPlay.reset();
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
    const { seed, goal, colors, par } = levelAt(index);
    db.transactions.startRun({
      seed,
      goal,
      colors,
      par,
      level: index,
      packId: pack.id,
    });
    runsStarted++;
    saveProgress(pack.id, index);
    runAnalytics.levelStarted(index, entry);
    setAriaText(`Level ${index + 1} of ${pack.levels.length}.`);
  };

  /** An agent's `start`: the next run, once any new Vault edition has loaded (./settledStart.ts). */
  const startWhenSettled = createSettledStart({
    settled: whenContentSettled,
    runsStarted: () => runsStarted,
    alive: () => !destroyed,
    start: startRun,
  });

  // ── Input ─────────────────────────────────────────────────────────────────
  /** Input is off while a menu owns the screen or a ball is moving. */
  const accepting = () =>
    !(pauseState.paused() || settingsOpen() || board?.busy);
  /** A button press becomes its transaction. */
  const command = (c: Command) => {
    if (!db || !accepting()) return;
    if (c === 'undo') {
      db.transactions.undo();
      return;
    }
    // Restart / Retry: the transaction refuses outside play; a rebuild bumps runId.
    const before = db.resources.runId;
    db.transactions.restartLevel();
    if (db.resources.runId !== before)
      runAnalytics.levelStarted(db.resources.level, 'restart');
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
  const buildScene = (
    application: Application,
    stage: Container,
    field: Texture,
  ) => {
    root = new DesignLayer();
    root.eventMode = 'passive';

    fieldBg = new Sprite(field);
    fieldBg.anchor.set(0.5);
    fieldBg.eventMode = 'none';
    stage.addChild(fieldBg);
    stage.addChild(root);

    board = new BoardView();
    controls = new Controls(
      application,
      deps.coordinator.getGpuLoader() as PixiLoader,
      () => getActivePack().levels.length,
      command,
    );
    root.addChild(board.container, controls.container);
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
          // Transparent, like the title's: the host's stand-in of the background shows
          // through until the scene's own background draws over it.
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        })
        .then(async () => {
          if (destroyed || !db) return;
          releasePixiApp = exposePixiApp(application);

          const { field } = await loadGameTextures(deps.coordinator);
          if (destroyed || !db) return;

          // The canvas goes in once it has a scene to draw.
          container.appendChild(application.canvas as HTMLCanvasElement);
          buildScene(application, application.stage, field);
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
            accepting,
          );

          // 3. Start the run, then drive the fixed-step sim + per-frame render.
          startRun();
          // An agent's `start` takes the same level flow as the player's.
          setLiveStart(world, startWhenSettled);
          audio.music('audio-music'); // plays once loaded and unlocked (./gameAudio.ts); respects the toggle

          engine = createTickerEngine();
          stopSim = startFixedStepLoop(engine, (dt) => {
            if (db && !destroyed && !(pauseState.paused() || settingsOpen()))
              stepWorld(db, dt);
          });
          stopRender = engine.onFrame((dtMs) => render(dtMs / 1000));
          // The host shows a stand-in of this frame until Pixi has drawn it once.
          // (Two ticks: listeners run before that tick's render.)
          application.ticker.addOnce(() =>
            application.ticker.addOnce(() => deps.onReady?.()),
          );

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

    /** Keyboard (useGameKeyboard): arrows move the tube cursor, Space / Enter taps that tube. */
    input(intent: GameIntent) {
      if (!db || !accepting()) return;
      if (intent.type === 'move')
        db.transactions.moveCursor({ dir: intent.dir });
      else db.transactions.pressCursor();
    },

    destroy() {
      destroyed = true;
      if (db) setLiveStart(db, null); // no agent restarts under another screen
      endOfPlay.destroy();
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
        board?.destroy();
        controls?.destroy();
        board = controls = null;
        releasePixiApp?.();
        releasePixiApp = null;
        app?.destroy(true, { children: true });
        app = null;
        root = null;
        // Textures live in Pixi's global Assets cache (keyed by URL) and are
        // reused across screens: just drop our reference, don't destroy them.
        fieldBg = null;
        setActiveInspectorActions([]);
        db = null;
      };
      void (initPromise ? initPromise.then(teardown, teardown) : teardown());
    },

    ariaText,
  };
};
