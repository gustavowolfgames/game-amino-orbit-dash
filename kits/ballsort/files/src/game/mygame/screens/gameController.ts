/**
 * Game Controller — the frame a game plugs into (Pixi).
 *
 * This is the template core, not a game. It owns the renderer lifecycle and the
 * wiring every game needs, and draws only the background and the HUD:
 *
 *   • Pixi app + a fixed design box (DESIGN_W×DESIGN_H) scaled to fit
 *     ("contain"), with a cover-fit background in screen space.
 *   • Input as intent (`../input/pointer.ts`): a tap queues `submitTap`; a system
 *     in `../sim/systems/` drains it next step.
 *   • The fixed-step sim (`startFixedStepLoop` → `stepWorld` → `SYSTEM_ORDER`)
 *     plus a per-frame `render` where the game projects ECS into its views
 *     (`../render/`).
 *   • Content: each run plays one level of the active Content Pack (`levelAt`,
 *     src/game/content). Winning moves to the pack's next level; winning its last
 *     level reports the edition complete to the Vault.
 *   • The sim and input stop while the settings menu is open (`settingsOpen`,
 *     set by `GameSettingsMenu`, the one menu on every screen) or the game is
 *     paused (space bar, core pause state).
 *   • A terminal phase (`won` / `lost`) hands off to the results screen.
 *
 * Keep this file thin (`bun run check:agent` caps it): game views, rules and
 * input live in their own folders. A turn-based game drops the frame loop and
 * resolves turns on input instead.
 *
 * Lifecycle (world owned by world.ts, never disposed here):
 *   init:    getGameWorld() → build Pixi → startRun → start the fixed-step loop
 *   destroy: destroyed flag → stop loop → engine.destroy → kill tweens →
 *            renderer teardown → setActiveInspectorActions([])
 */

import gsap from 'gsap';
import { Application, Container, Sprite, type Texture } from 'pixi.js';
import { createSignal } from 'solid-js';
import { exposePixiApp } from '~/core/dev/pixiDevtools';
import type { PixiLoader } from '~/core/systems/assets';
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
import { createRunAnalytics } from '~/game/setup/edition-analytics';
import {
  recordLevelWon,
  resumeLevel,
  saveProgress,
} from '~/game/setup/progress';
import { completeActivePack } from '~/game/setup/served-session';
import { DESIGN_H, DESIGN_W } from '../config';
import type { EngineHandle } from '../engine';
import { createTickerEngine, startFixedStepLoop } from '../engine';
import { bindTapInput } from '../input/pointer';
import { BoardView } from '../render/BoardView';
import { Controls } from '../render/Controls';
import { loadGameTextures } from '../render/textures';
import type { Command, GameDatabase, GamePhase } from '../sim/plugin';
import { stepWorld } from '../sim/schedule';
import { getGameWorld } from '../world';
import { type AudioSettings, bindAudioSettings } from './audioSettings';

/** Delay (s) before handing off to results, so the last frame reads. */
const END_PAUSE = 0.9;

/** Deps optionally carry `goto` (GameScreen injects it) for the results hop. */
type Deps = GameControllerDeps & { goto?: (screen: string) => void };

export const setupGame: SetupGame = (
  rawDeps: GameControllerDeps,
): GameController => {
  const deps = rawDeps as Deps;
  const [ariaText, setAriaText] = createSignal('Loading…');
  // Settled by the loading screen before this screen exists; read once per run.
  const theme = getTheme();
  // level_* + edition_* events (src/game/setup/edition-analytics.ts); no-ops without a service.
  const runAnalytics = createRunAnalytics(deps.analytics);

  let app: Application | null = null;
  let releasePixiApp: (() => void) | null = null;
  let db: GameDatabase | null = null;
  let engine: EngineHandle | null = null;
  let stopSim: (() => void) | null = null;
  let stopRender: (() => void) | null = null;
  let unbindInput: (() => void) | null = null;
  let destroyed = false;
  let initPromise: Promise<void> | null = null;

  /** Design-space root: the game's views go in here. */
  let root: Container | null = null;
  /** Full-bleed background (screen space). */
  let fieldBg: Sprite | null = null;
  let board: BoardView | null = null;
  let controls: Controls | null = null;

  /** Guard so a terminal phase only triggers one transition. */
  let handledPhase: GamePhase | null = null;

  // ── Per-frame render (projection of ECS) ───────────────────────────────────
  // The game reconciles its views against ECS here (read via ../sim/readStateFromEcs).
  const render = (_dtSec: number) => {
    if (!db || destroyed) return;
    board?.update(db);
    controls?.update(db);
    handlePhase(db.resources.phase);
  };

  const handlePhase = (phase: GamePhase) => {
    if (phase === 'playing' || phase === 'idle' || phase === handledPhase) {
      return;
    }
    handledPhase = phase;
    const last = !!db && isLastLevel(db.resources.level);
    if (phase === 'won') {
      if (db) runAnalytics.levelWon(db.resources.level, db.resources.score);
      if (last) completeActivePack(); // the Vault served mode decides what a finished pack means
      if (db) recordLevelWon(db.resources.packId, db.resources.level, last); // reload resumes the next level
    }
    setAriaText(phase === 'won' ? 'Level complete.' : 'Run over.');
    // A won level goes straight to the next one; the last one (or a loss) to results.
    gsap.delayedCall(END_PAUSE, () => {
      if (destroyed) return;
      if (phase === 'won' && !last) startRun();
      else deps.goto?.('results');
    });
  };

  /**
   * Start (or restart) a run on the right level of the active pack: the next one after a win,
   * the same one on a restart, the first one when the pack changed (a Vault edition arrived).
   * The level index and pack id live in ECS so the run's progress survives screen changes.
   */
  const startRun = () => {
    if (!db) return;
    handledPhase = null;
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
    saveProgress(pack.id, index);
    runAnalytics.levelStarted(index, entry);
    setAriaText(`Level ${index + 1} of ${pack.levels.length}.`);
  };

  // ── Audio (optional: a missing channel is a no-op) ─────────────────────────
  type Audio = {
    play: (channel: string, mode?: string) => void;
    stop: (channel: string) => void;
  };
  const audio = () => deps.coordinator.audio as Audio | undefined;
  // The settings menu's volume and music toggle, applied to the engine
  // (./audioSettings.ts). Music starts through it, never by playing directly.
  const music = bindAudioSettings(
    audio,
    deps.audio as AudioSettings | undefined,
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  const layout = () => {
    if (!app || !root) return;
    const w = app.screen.width;
    const h = app.screen.height;
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    root.scale.set(scale);
    root.position.set((w - DESIGN_W * scale) / 2, (h - DESIGN_H * scale) / 2);
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

  /** Input is off while a menu owns the screen or a ball is moving. */
  const accepting = () =>
    !(pauseState.paused() || settingsOpen() || board?.busy);
  /** A button press becomes an intent the input system resolves next step. */
  const queueCommand = (command: Command) => {
    if (db?.resources.phase === 'playing' && accepting())
      db.transactions.submitCommand(command);
  };

  // ── Scene construction ─────────────────────────────────────────────────────
  const buildScene = (stage: Container, field: Texture) => {
    root = new Container();
    root.eventMode = 'passive';

    fieldBg = new Sprite(field);
    fieldBg.anchor.set(0.5);
    fieldBg.eventMode = 'none';
    stage.addChild(fieldBg);
    stage.addChild(root);

    board = new BoardView();
    controls = new Controls(
      app as Application,
      deps.coordinator.getLoader<PixiLoader>('gpu') as PixiLoader,
      () => getActivePack().levels.length,
      queueCommand,
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
          background: theme.ground,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        })
        .then(async () => {
          if (destroyed || !db) return;
          releasePixiApp = exposePixiApp(application);
          container.appendChild(application.canvas as HTMLCanvasElement);

          const { field } = await loadGameTextures();
          if (destroyed || !db) return;

          buildScene(application.stage, field);
          layout();
          application.renderer.on('resize', layout);
          unbindInput = bindTapInput(
            application,
            root as Container,
            db,
            accepting,
          );

          // 3. Start the run, then drive the fixed-step sim + per-frame render.
          startRun();
          music.startMusic(); // audio unlocked on the start-screen tap; respects the toggle

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
      music.stopMusic();
      stopSim?.();
      stopRender?.();
      stopSim = stopRender = null;
      engine?.destroy();
      engine = null;
      unbindInput?.();
      unbindInput = null;

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
