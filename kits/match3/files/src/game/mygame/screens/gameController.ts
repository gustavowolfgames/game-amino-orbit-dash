/**
 * Game Controller — the frame the match-3 plugs into (Pixi).
 *
 * It owns the renderer lifecycle and the wiring; the board, the HUD, the rules
 * and the input live in their own folders:
 *
 *   • Pixi app + a `DesignLayer` on `DESIGN_CANVAS` (390×844, the canvas the
 *     title screen uses), fitted by `trackHostBox`, with a cover-fit background
 *     in screen space.
 *   • Match-3 is turn-based: a drag, tap-tap (`../input/swap.ts`) or a key
 *     (`input(intent)`, from `useGameKeyboard`) calls the turn function
 *     `applySwap` (`../sim/turn.ts`), and the board view
 *     (`../render/BoardView.ts`) animates the returned ruling. Input is ignored
 *     while the board settles.
 *   • The fixed-step sim (`startFixedStepLoop` → `stepWorld`, no systems yet)
 *     plus a per-frame `render` where the views project ECS (`../render/`).
 *   • Feedback: `render` drains the sim's events (`drainEvents`) once a frame
 *     and runs them through the cue table (`./cues.ts`): sound through
 *     `./gameAudio.ts`, the screen-reader line through `ariaText`.
 *   • Content: each run plays one level of the active Content Pack (`levelAt`,
 *     src/game/content). Winning moves straight on to the pack's next level;
 *     winning its last level reports the edition complete and shows results.
 *     Losing shows results with Retry.
 *   • The sim and input stop while the settings menu is open (`settingsOpen`,
 *     set by `GameSettingsMenu`, the one menu on every screen) or the game is
 *     paused (core pause state).
 *
 * Keep this file thin (`bun run check:agent` caps it): game views, rules and
 * input live in their own folders.
 *
 * Lifecycle (world owned by world.ts, never disposed here):
 *   init:    getGameWorld() → build Pixi → startRun → start the fixed-step loop
 *   destroy: destroyed flag → stop loop → engine.destroy → kill tweens →
 *            renderer teardown → setActiveInspectorActions([])
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { DesignLayer, trackHostBox } from '@wolfgames/components/pixi';
import gsap from 'gsap';
import { Application, type Container, Sprite, type Texture } from 'pixi.js';
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
import { createRunAnalytics } from '~/game/setup/edition-analytics';
import {
  recordLevelWon,
  resumeLevel,
  saveProgress,
} from '~/game/setup/progress';
import { completeActivePack } from '~/game/setup/served-session';
import type { EngineHandle } from '../engine';
import { createTickerEngine, startFixedStepLoop } from '../engine';
import { bindSwapInput, type SwapInput } from '../input/swap';
import { BoardView } from '../render/BoardView';
import { GameHud } from '../render/GameHud';
import { loadGameTextures } from '../render/textures';
import { drainEvents } from '../sim/events';
import type { GameDatabase, GameEvent, GamePhase } from '../sim/plugin';
import { COLOR_NAMES } from '../sim/rules/board';
import { stepWorld } from '../sim/schedule';
import { applySwap } from '../sim/turn';
import { getGameWorld } from '../world';
import { createCues } from './cues';
import { type AudioSettings, createGameAudio } from './gameAudio';

/** Delay (s) before handing off to results, so the last frame reads. */
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
  let swapInput: SwapInput | null = null;
  let stopResize: (() => void) | null = null;
  let destroyed = false;
  let initPromise: Promise<void> | null = null;

  /** Design-space root on DESIGN_CANVAS: the game's views go in here. */
  let root: DesignLayer | null = null;
  /** Full-bleed background (screen space). */
  let fieldBg: Sprite | null = null;
  let hud: GameHud | null = null;
  let board: BoardView | null = null;

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
      // One pop per move: a move's cascade steps share one sim instant.
      scored: {
        sfx: 'sfx-pop',
        gapMs: 60,
        aria: (e) =>
          e.chain > 1 ? `Chain ×${e.chain}, ${e.score} points.` : null,
      },
      rejected: { aria: 'No match. Swap undone.' },
      reshuffled: { aria: 'No moves left. New board.' },
      phase: {
        sfx: (e) => (e.phase === 'won' ? 'sfx-clear' : null),
        aria: (e) =>
          e.phase === 'won'
            ? 'Level complete.'
            : e.phase === 'lost'
              ? 'Out of moves.'
              : null,
      },
    },
    { play: audio.play, say: setAriaText },
  );

  // ── Per-frame render (projection of ECS) ───────────────────────────────────
  // The views reconcile against ECS here, then the frame's events play.
  const render = (dtSec: number) => {
    if (!db || destroyed) return;
    board?.update(db, dtSec);
    hud?.update(db, dtSec);
    cues(drainEvents(db), db.resources.elapsedMs);
    // Let the last move finish animating before the level ends.
    if (!board?.busy) handlePhase(db.resources.phase);
  };

  const handlePhase = (phase: GamePhase) => {
    if (phase === 'playing' || phase === 'idle' || phase === handledPhase) {
      return;
    }
    handledPhase = phase;
    const won = phase === 'won';
    const advance = won && !!db && !isLastLevel(db.resources.level);
    if (won && db) {
      const last = isLastLevel(db.resources.level);
      runAnalytics.levelWon(db.resources.level, db.resources.score);
      if (last) completeActivePack(); // the Vault served mode decides what a finished pack means
      recordLevelWon(db.resources.packId, db.resources.level, last); // reload resumes the next level
      hud?.announce(
        `LEVEL ${db.resources.level + 1} CLEAR!`,
        DESIGN_CANVAS.height / 2,
      );
    } else {
      hud?.announce('OUT OF MOVES', DESIGN_CANVAS.height / 2);
    }
    gsap.delayedCall(END_PAUSE * (advance ? 1.6 : 1), () => {
      if (destroyed) return;
      // Between levels play straight on; the last win and a loss go to results.
      if (advance) startRun();
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
    const { seed, goal, goalColor, moves } = levelAt(index);
    db.transactions.startRun({
      seed,
      goal,
      goalColor: Math.max(0, COLOR_NAMES.indexOf(goalColor)),
      moves,
      level: index,
      packId: pack.id,
      entry,
    });
    saveProgress(pack.id, index);
    runAnalytics.levelStarted(index, entry);
    setAriaText(
      `Level ${index + 1} of ${pack.levels.length}. Clear ${goal} ${goalColor} in ${moves} moves.`,
    );
  };

  /** Input is live only on a settled board in a live run with nothing over the game. */
  const accepting = () =>
    db?.resources.phase === 'playing' &&
    !board?.busy &&
    !(pauseState.paused() || settingsOpen());

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

    board = new BoardView();
    board.container.position.set(
      (DESIGN_CANVAS.width - board.width) / 2,
      (DESIGN_CANVAS.height - board.height) / 2 + 20,
    );
    root.addChild(board.container);

    hud = new GameHud(theme, getActivePack().levels.length);
    root.addChild(hud.container);
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

          // The canvas goes in once it has a scene to draw: an empty one would cover the
          // host's stand-in with the bare ground colour.
          container.appendChild(application.canvas as HTMLCanvasElement);
          buildScene(application.stage, field);
          stopResize = trackHostBox(
            application,
            container,
            [root as DesignLayer],
            fitBackground,
          );
          swapInput = bindSwapInput(
            application,
            board as BoardView,
            (a, b) => {
              if (!db || !board) return;
              board.play(applySwap(db, a, b), db);
            },
            accepting,
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

    /** Keyboard (useGameKeyboard): arrows move the cursor or swap a picked tile. */
    input(intent) {
      swapInput?.key(intent);
    },

    destroy() {
      destroyed = true;
      audio.stopAll();
      stopSim?.();
      stopRender?.();
      stopSim = stopRender = null;
      engine?.destroy();
      engine = null;
      swapInput?.unbind();
      swapInput = null;
      stopResize?.();
      stopResize = null;

      const teardown = () => {
        releasePixiApp?.();
        releasePixiApp = null;
        hud?.destroy();
        hud = null;
        board?.destroy(); // kills its tweens before the app tears the scene down
        board = null;
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
