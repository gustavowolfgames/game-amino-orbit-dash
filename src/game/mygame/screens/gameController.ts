/**
 * Game Controller — the minimal ECS demo (Pixi).
 *
 * Real-time (guardrail: the orbiter ring and the movers advance every frame with
 * no input, so this runs the per-frame schedule, NOT the turn-based path). ECS is
 * the single source of truth — the orbiters, the movers, score, phase — and the
 * renderer is a pure projection of it. The sim advances on a FIXED timestep
 * (`startFixedStepLoop` → `stepWorld` → `SYSTEM_ORDER`) so it's deterministic and
 * framerate-independent; the renderer paints the latest ECS state each frame.
 *
 * The loop:
 *   • A ring of collectible orbs circles the centre (systemOrbit).
 *   • Drifting orbs bounce off the design-box walls (systemMovement).
 *   • A tap collects the nearest orb within reach and spawns a mover (input as
 *     intent → `submitTap`; `systemInput` drains it next step).
 *   • Collect every orb → win → hand off to the results screen.
 *
 * Content: each run plays one level of the active Content Pack (`levelAt`,
 * src/game/content) — the bundled pack, or a published one (`?wolfPack=`, a
 * Vault edition). Winning advances to the pack's next level; winning its last
 * level hands off to the Vault served mode (`completeActivePack`, src/game/setup/
 * served-session.ts): report the run, load the next unlocked edition, or exit a daily.
 *
 * Rendering: a fixed design box (DESIGN_W×DESIGN_H) scaled to fit the viewport
 * ("contain"), with a cover-fit background. Every orb is the neutral `piece-orb`
 * sprite tinted by its colour index, mapped onto the brand theme's piece
 * colours (`getTheme()`, src/game/brand) — a partner sheet recolours the scene. The art is
 * placeholder .webp committed under mygame/assets/generated/ and loaded via Vite
 * ?url + Pixi Assets (see render/textures.ts) — self-contained, resolves the same
 * in dev and the production build. Swap the art, keep the code.
 *
 * Lifecycle (world owned by world.ts, never disposed here):
 *   init:    getGameWorld() → build Pixi → start the fixed-step loop → startDemo
 *   destroy: destroyed flag → stop loop → engine.destroy → kill tweens →
 *            renderer teardown → setActiveInspectorActions([])
 */

import gsap from 'gsap';
import { Application, Container, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';
import { createSignal } from 'solid-js';

import { ParticleBurst } from '@wolfgames/components/modules/primitives/particle-burst';

import { setActiveInspectorActions } from '~/core/systems/ecs';
import { getTheme } from '~/game/brand';
import { getActivePack, isLastLevel, levelAt } from '~/game/content';
import { recordLevelWon, resumeLevel, saveProgress } from '~/game/setup/progress';
import { createRunAnalytics } from '~/game/setup/edition-analytics';
import { completeActivePack } from '~/game/setup/served-session';
import type { Entity } from '~/core/systems/ecs';
import type { GameController, GameControllerDeps, SetupGame } from '~/game/mygame-contract';
import { loadGameTextures, type GameTextures } from '../render/textures';
import { DESIGN_H, DESIGN_W, ORB_RADIUS } from '../demo/config';
import { createTickerEngine, startFixedStepLoop } from '../engine';
import type { EngineHandle } from '../engine';
import type { GameDatabase, GamePhase } from '../ecs/gamePlugin';
import { readMovers, readOrbiters } from '../ecs/readStateFromEcs';
import { stepWorld } from '../ecs/schedule';
import { getGameWorld } from '../world';
import { exposePixiApp } from '~/core/dev/pixiDevtools';

// ── Layout ─────────────────────────────────────────────────────────────────
/** Delay (s) before handing off to results after a win, so the last pop reads. */
const WIN_PAUSE = 0.9;

/** Deps optionally carry `goto` (GameScreen injects it) for the results hop. */
type Deps = GameControllerDeps & { goto?: (screen: string) => void };

/** One orb view — the neutral orb sprite tinted by colour index. */
interface Dot {
  container: Container;
  body: Sprite;
  colorIndex: number;
}

export const setupGame: SetupGame = (rawDeps: GameControllerDeps): GameController => {
  const deps = rawDeps as Deps;
  const [ariaText, setAriaText] = createSignal('Loading…');
  // Settled by the loading screen before this screen exists; read once per run.
  const theme = getTheme();
  const tint = (colorIndex: number) => theme.pieces[colorIndex % theme.pieces.length];
  // level_* + edition_* events (src/game/setup/edition-analytics.ts); no-ops without a service.
  const runAnalytics = createRunAnalytics(deps.analytics);

  let app: Application | null = null;
  let releasePixiApp: (() => void) | null = null;
  let db: GameDatabase | null = null;
  let textures: GameTextures | null = null;
  let engine: EngineHandle | null = null;
  let stopSim: (() => void) | null = null;
  let stopRender: (() => void) | null = null;
  let destroyed = false;
  let initPromise: Promise<void> | null = null;

  // Stage layers (design space).
  let root: Container | null = null;
  let moverLayer: Container | null = null;
  let orbiterLayer: Container | null = null;
  let hud: Text | null = null;
  let banner: Text | null = null;
  let fieldBg: Sprite | null = null; // full-bleed background (screen space)
  let popFx: ParticleBurst | null = null;

  const orbiterViews = new Map<Entity, Dot>();
  const moverViews = new Map<Entity, Dot>();

  /** Guard so a terminal phase only triggers one transition. */
  let handledPhase: GamePhase | null = null;

  // ── View helpers ─────────────────────────────────────────────────────────
  const makeDot = (layer: Container, colorIndex: number, radius: number, x: number, y: number): Dot => {
    const container = new Container();
    container.position.set(x, y);
    const body = new Sprite((textures as GameTextures).orb);
    body.anchor.set(0.5);
    body.width = radius * 2;
    body.height = radius * 2;
    body.tint = tint(colorIndex);
    container.addChild(body);
    layer.addChild(container);
    // Spawn pop.
    container.scale.set(0.4);
    gsap.to(container.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2)', overwrite: 'auto' });
    return { container, body, colorIndex };
  };

  const destroyDot = (dot: Dot) => {
    gsap.killTweensOf(dot.container);
    gsap.killTweensOf(dot.container.scale);
    dot.container.destroy({ children: true });
  };

  /** Pop-and-fade a collected orb, then destroy its view. */
  const popDot = (dot: Dot) => {
    dot.container.eventMode = 'none';
    gsap.killTweensOf(dot.container);
    gsap.killTweensOf(dot.container.scale);
    gsap.to(dot.container.scale, { x: 1.6, y: 1.6, duration: 0.22, ease: 'power2.out' });
    gsap.to(dot.container, {
      alpha: 0,
      duration: 0.22,
      ease: 'power2.out',
      onComplete: () => dot.container.destroy({ children: true }),
    });
  };

  // ── Per-frame render (projection of ECS) ───────────────────────────────────
  const render = (dtSec: number) => {
    if (!db || destroyed) return;

    // Movers — reconcile, track sim position directly (fixed-step sim ≈ frame rate).
    const movers = readMovers(db);
    const liveMovers = new Set<Entity>();
    for (const m of movers) {
      liveMovers.add(m.entity);
      let view = moverViews.get(m.entity);
      if (!view) {
        view = makeDot(moverLayer as Container, m.color, ORB_RADIUS, m.position[0], m.position[1]);
        moverViews.set(m.entity, view);
      }
      view.container.position.set(m.position[0], m.position[1]);
    }
    for (const [entity, view] of moverViews) {
      if (!liveMovers.has(entity)) {
        destroyDot(view); // recycled by the spawn cap
        moverViews.delete(entity);
      }
    }

    // Orbiters — reconcile; a removed one was collected → pop + particle burst.
    const orbiters = readOrbiters(db);
    const liveOrbiters = new Set<Entity>();
    for (const o of orbiters) {
      liveOrbiters.add(o.entity);
      let view = orbiterViews.get(o.entity);
      if (!view) {
        view = makeDot(orbiterLayer as Container, o.color, ORB_RADIUS, o.position[0], o.position[1]);
        orbiterViews.set(o.entity, view);
      }
      view.container.position.set(o.position[0], o.position[1]);
    }
    let collected = 0;
    for (const [entity, view] of orbiterViews) {
      if (!liveOrbiters.has(entity)) {
        collected++;
        popFx?.burst(view.container.x, view.container.y, {
          count: 22,
          colors: [tint(view.colorIndex), 0xfff2c4],
          lifetime: 0.7,
        });
        popDot(view);
        orbiterViews.delete(entity);
      }
    }
    if (collected > 0) tryPlay('sfx-pop');
    popFx?.update(dtSec);

    // HUD.
    if (hud) {
      const total = getActivePack().levels.length;
      hud.text = `LEVEL ${db.resources.level + 1}/${total}    SCORE ${db.resources.score}    ORBS ${db.resources.remaining}`;
    }

    // Terminal transition (won → results).
    handlePhase(db.resources.phase);
  };

  const handlePhase = (phase: GamePhase) => {
    if (phase === 'playing' || phase === handledPhase) return;
    handledPhase = phase;
    if (phase === 'won') {
      const last = !!db && isLastLevel(db.resources.level);
      if (db) runAnalytics.levelWon(db.resources.level, db.resources.score);
      if (last) completeActivePack(); // the Vault served mode decides what a finished pack means
      if (db) recordLevelWon(db.resources.packId, db.resources.level, last); // reload resumes the next level
      tryPlay('sfx-clear');
      showBanner('YOU WIN!');
      setAriaText('You collected every orb.');
      gsap.delayedCall(WIN_PAUSE, () => {
        if (!destroyed) deps.goto?.('results');
      });
    }
  };

  const showBanner = (text: string) => {
    if (!banner) return;
    banner.text = text;
    banner.alpha = 0;
    banner.scale.set(0.7);
    gsap.to(banner, { alpha: 1, duration: 0.3, overwrite: 'auto' });
    gsap.to(banner.scale, { x: 1, y: 1, duration: 0.4, ease: 'back.out(1.7)', overwrite: 'auto' });
  };

  /**
   * Start (or restart) a run on the right level of the active pack: the next one after a win,
   * the same one on a restart, the first one when the pack changed (a Vault edition arrived).
   * The level index and pack id live in ECS so the run's progress survives screen changes; the
   * first run after a reload resumes the saved level (src/game/setup/progress.ts).
   */
  const startDemo = () => {
    if (!db) return;
    handledPhase = null;
    if (banner) banner.alpha = 0;
    const pack = getActivePack();
    const prev = db.resources;
    // Read before the transaction: `prev` is the live resource object.
    const fresh = prev.packId !== pack.id || prev.phase === 'idle';
    const entry = fresh ? 'fresh' : prev.phase === 'won' ? 'next' : 'restart';
    // A fresh start resumes saved progress; otherwise the next level or the same one again.
    const next = fresh ? resumeLevel(pack) : prev.level + (entry === 'next' ? 1 : 0);
    const index = next % pack.levels.length;
    const level = levelAt(index);
    db.transactions.startDemo({ ...level, level: index, packId: pack.id });
    saveProgress(pack.id, index);
    runAnalytics.levelStarted(index, entry);
    setAriaText(`Level ${index + 1} of ${pack.levels.length}. Tap the drifting orbs to collect them.`);
  };

  /** Play a sound if the audio bundle provides it; silently no-op otherwise. */
  const tryPlay = (channel: string) => {
    try {
      (deps.coordinator.audio as { play: (c: string) => void } | undefined)?.play(channel);
    } catch {
      /* audio optional */
    }
  };

  const startMusic = () => {
    try {
      (deps.coordinator.audio as { play: (c: string, s?: string) => void } | undefined)?.play(
        'audio-music',
        'loop',
      );
    } catch {
      /* audio optional */
    }
  };

  const stopMusic = () => {
    try {
      (deps.coordinator.audio as { stop: (c: string) => void } | undefined)?.stop('audio-music');
    } catch {
      /* audio optional */
    }
  };

  // ── Input (input as intent) ────────────────────────────────────────────────
  const onTap = (e: FederatedPointerEvent) => {
    if (!db || !root || db.resources.phase !== 'playing') return;
    const p = root.toLocal(e.global);
    db.transactions.submitTap({ x: p.x, y: p.y });
  };

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

  // ── Scene construction ─────────────────────────────────────────────────────
  const buildScene = (stage: Container) => {
    root = new Container();

    // Input on the STAGE, over the whole canvas (hitArea = app.screen), so a tap
    // ANYWHERE registers — including the letterbox bars. Fire on `pointerdown`
    // (not `pointertap`, which drops fast clicks or the slightest drag).
    stage.eventMode = 'static';
    stage.hitArea = (app as Application).screen;
    stage.on('pointerdown', onTap);

    // Field background — added to the STAGE (screen space) and cover-fit in
    // layout(). Non-interactive.
    fieldBg = new Sprite((textures as GameTextures).field);
    fieldBg.anchor.set(0.5);
    fieldBg.eventMode = 'none';
    stage.addChild(fieldBg);
    stage.addChild(root);

    // Movers under orbiters so the collectibles read on top.
    moverLayer = new Container();
    moverLayer.eventMode = 'none';
    orbiterLayer = new Container();
    orbiterLayer.eventMode = 'none';
    root.addChild(moverLayer, orbiterLayer);

    // Particle bursts ride above the orbs in design space. Non-interactive.
    popFx = new ParticleBurst();
    popFx.eventMode = 'none';
    root.addChild(popFx);

    // HUD (top-left).
    hud = new Text({
      text: '',
      style: { fill: theme.text, fontFamily: theme.fonts.numeric, fontSize: 30, fontWeight: '700' },
    });
    hud.position.set(24, 20);
    root.addChild(hud);

    // Centre banner (win).
    banner = new Text({
      text: '',
      style: { fill: theme.text, fontFamily: theme.fonts.display, fontSize: 72, fontWeight: '800', align: 'center' },
    });
    banner.anchor.set(0.5);
    banner.position.set(DESIGN_W / 2, DESIGN_H * 0.28);
    banner.alpha = 0;
    root.addChild(banner);
  };

  return {
    gameMode: 'pixi',

    init(container: HTMLDivElement) {
      // 1. App-scoped ECS world — single source of truth.
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
          application.stage.eventMode = 'static';

          // Gameplay art — bundled .webp loaded via Vite ?url + Pixi Assets.
          textures = await loadGameTextures();
          if (destroyed || !db) return;

          buildScene(application.stage);
          layout();
          application.renderer.on('resize', layout);

          // 3. Start the run, then drive the fixed-step sim + per-frame render.
          startDemo();
          startMusic(); // looping ambience (audio unlocked on the start-screen tap)

          engine = createTickerEngine();
          stopSim = startFixedStepLoop(engine, (dt) => {
            if (db && !destroyed) stepWorld(db, dt);
          });
          stopRender = engine.onFrame((dtMs) => render(dtMs / 1000));

          // Dev/bot surface — restart the demo.
          setActiveInspectorActions([
            { id: 'restart-demo', label: () => '↻ Restart demo', run: () => startDemo() },
          ]);
        });
    },

    destroy() {
      destroyed = true;
      stopMusic();
      stopSim?.();
      stopRender?.();
      stopSim = stopRender = null;
      engine?.destroy();
      engine = null;

      for (const view of orbiterViews.values()) destroyDot(view);
      for (const view of moverViews.values()) destroyDot(view);
      orbiterViews.clear();
      moverViews.clear();
      if (banner) gsap.killTweensOf(banner);

      const teardown = () => {
        releasePixiApp?.();
        releasePixiApp = null;
        app?.destroy(true, { children: true });
        app = null;
        root = moverLayer = orbiterLayer = null;
        hud = banner = null;
        fieldBg = null;
        popFx = null;
        // Textures live in Pixi's global Assets cache (keyed by URL) and are
        // reused across screens — just drop our reference, don't destroy them.
        textures = null;
        setActiveInspectorActions([]);
        db = null;
      };
      void (initPromise ? initPromise.then(teardown, teardown) : teardown());
    },

    ariaText,
  };
};
