/**
 * Start Screen View — Pixi mode
 *
 * Composes the start screen from three @wolfgames/components primitives:
 *   DynamicBackground  — parallax / Ken Burns background layer
 *   SpriteLogoTitle    — logo slot with optional ambient motion
 *   SpriteButton       — interactive Play button with hover/press GSAP
 *
 * Art is the NEUTRAL template placeholder set (title wordmark, round play
 * button, title background), the `scene-title` bundle loaded in
 * render/textures.ts. Publishing your game's art under the same names swaps it.
 *
 * The loader (IntroSting, reveal mode) ends on this screen's first frame: the
 * background and logo are already up when it mounts, and only the play button
 * pops in. The layout both share lives in screens/components/titleFrame.ts.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { MOTION_PRESETS } from '@wolfgames/components/modules/logic/motion-presets';
import { DynamicBackground } from '@wolfgames/components/modules/primitives/dynamic-background';
import { SpriteButton } from '@wolfgames/components/modules/primitives/sprite-button';
import { SpriteLogoTitle } from '@wolfgames/components/modules/primitives/sprite-logo-title';
import { DesignLayer, trackHostBox } from '@wolfgames/components/pixi';
import gsap from 'gsap';
import { Application, Container, type Ticker } from 'pixi.js';
import { exposePixiApp } from '~/core/dev/pixiDevtools';
import type { PixiLoader } from '~/core/systems/assets';
import { getTheme } from '~/game/brand';
import type {
  SetupStartScreen,
  StartScreenController,
  StartScreenDeps,
} from '~/game/mygame-contract';
import { whenContentSettled } from '~/game/setup/content';
import type { GameTuning } from '~/game/tuning/types';
import {
  TITLE_BG,
  TITLE_BUTTON,
  TITLE_LOGO,
} from '../../screens/components/titleFrame';
import { createPixiBackdrop } from '../../screens/PixiBackdrop';
import { loadStartTextures } from '../render/textures';

/* Layout is design px on the library standard canvas (DESIGN_CANVAS, 390×844).
   Converted from the old local 430×932 canvas by the ENG-3804 rule: absolute
   positions scale by s = 844/932 ≈ 0.9056, bottom-anchored positions keep their
   bottom offset, and the scale math itself now lives in the one place that owns
   it. See docs/standards/components.md §9. */
const LOGO_Y = TITLE_LOGO.y; // 180 × s — logo centre from canvas top (shared with the loader: titleFrame)
const BTN_Y = TITLE_BUTTON.y; // 152 px from the bottom (shared with the loader: titleFrame)
const LOGO_WIDTH = TITLE_LOGO.width; // the wordmark's width — set it in titleFrame
// The play button art is a complete round disc with its own play glyph —
// render it square at natural aspect, no 9-slice, no label.
const BUTTON_SIZE = TITLE_BUTTON.size;

export const setupStartScreen: SetupStartScreen = (
  deps: StartScreenDeps,
): StartScreenController => {
  let app: Application | null = null;
  let releasePixiApp: (() => void) | null = null;
  let bg: DynamicBackground | null = null;
  let logo: SpriteLogoTitle | null = null;
  let playBtn: SpriteButton | null = null;
  let btnHolder: Container | null = null;
  let root: DesignLayer | null = null;
  let cleanupResize: (() => void) | null = null;
  /** The play button's action, once init has built it (keyboard start goes through it too). */
  let playNow: (() => void) | null = null;

  return {
    backgroundColor: getTheme().ground,

    play() {
      playNow?.();
    },

    init(container: HTMLDivElement) {
      let loading = false;

      const onPlay = async () => {
        if (loading) return;
        loading = true;
        const tl = gsap.timeline({
          onComplete: async () => {
            deps.unlockAudio();
            await deps.loadCore();
            try {
              await deps.loadAudio();
            } catch {
              /* audio optional */
            }
            // A Vault edition selected while the title was up: play it, not the boot pack.
            await whenContentSettled();
            deps.analytics.trackGameStart({
              start_source: 'play_button',
              is_returning_player: false,
            });
            deps.goto('game');
          },
        });
        if (logo)
          tl.to(
            logo,
            { alpha: 0, y: logo.y - 60, duration: 0.35, ease: 'power2.in' },
            0,
          );
        if (btnHolder)
          tl.to(
            btnHolder,
            { alpha: 0, y: btnHolder.y + 60, duration: 0.3, ease: 'power2.in' },
            0.05,
          );
        if (bg) tl.to(bg, { alpha: 0, duration: 0.5, ease: 'power2.in' }, 0.1);
      };
      playNow = () => {
        void onPlay();
      };

      void (async () => {
        try {
          await deps.initGpu();
          const gpuLoader = deps.coordinator.getLoader<PixiLoader>('gpu')!;
          const {
            title: logoTex,
            play: btnTex,
            splash: bgTex,
          } = await loadStartTextures(deps.coordinator);

          app = new Application();
          await app.init({
            resizeTo: container,
            backgroundAlpha: 0,
            resolution: Math.min(window.devicePixelRatio, 2),
            autoDensity: true,
          });
          if (!app) return;
          releasePixiApp = exposePixiApp(app);

          createPixiBackdrop({
            app,
            container,
            zIndex: 0,
          });

          // ── DynamicBackground ──────────────────────────────────────────────
          bg = new DynamicBackground({
            width: app.screen.width,
            height: app.screen.height,
            layers: [
              {
                texture: bgTex,
                depth: 0.2,
                // Phase −π/2: the zoom starts at zero, so the first frame is the one the
                // loader's reveal ends on (screens/components/titleFrame.ts: TITLE_BG).
                motion: {
                  type: 'kenBurns',
                  zoom: 0.08,
                  panX: 30,
                  panY: TITLE_BG.panY,
                  period: 20,
                  phase: -Math.PI / 2,
                },
              },
            ],
            overscan: TITLE_BG.overscan,
          });
          app.stage.addChild(bg as any);

          // ── Design-scale root and layers ───────────────────────────────────
          // Children below are positioned in design px on the 390×844 canvas;
          // the layer owns the one transform that maps them onto the screen.
          root = new DesignLayer();
          app.stage.addChild(root);

          // Explicit layer setup to prevent interaction bugs
          const backgroundLayer = new Container();
          backgroundLayer.eventMode = 'none'; // Kills all pointer events, saving CPU

          const uiLayer = new Container();
          uiLayer.eventMode = 'passive'; // Allows events to "pass through" to interactive children

          root.addChild(backgroundLayer);
          root.addChild(uiLayer);

          const sc = (deps.tuning.game as GameTuning).startScreen;

          // ── SpriteLogoTitle ────────────────────────────────────────────────
          // A breath starts at its smallest (−amount); phase π/2 starts it at rest size, the
          // size the loader's reveal ends on, so the logo doesn't snap smaller at the handoff.
          const logoMotion = MOTION_PRESETS[sc.logoMotion];
          logo = new SpriteLogoTitle({
            source: { type: 'sprite', texture: logoTex },
            width: LOGO_WIDTH,
            motion: logoMotion.breathe
              ? {
                  ...logoMotion,
                  breathe: { ...logoMotion.breathe, phase: Math.PI / 2 },
                }
              : logoMotion,
          });
          // Already in place: the loader's reveal ends on this frame (IntroSting, reveal mode).
          logo.x = DESIGN_CANVAS.width / 2;
          logo.y = LOGO_Y;
          backgroundLayer.addChild(logo as any);

          // ── SpriteButton ───────────────────────────────────────────────────
          playBtn = new SpriteButton(gpuLoader, {
            texture: btnTex,
            // Complete round-disc art with a baked-in triangle — render whole, no
            // 9-slice stretch and no text label overlay.
            use9Slice: false,
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            onClick: () => {
              void onPlay();
            },
            idleMotion: sc.buttonMotion,
          });
          // The button pops in place at the spot the loader parked the WolfGames logo while
          // loading (titleFrame: TITLE_BUTTON), so the player's eye is already on it. It sits in
          // a holder: its idle motion owns its own scale, the entrance scales the holder.
          btnHolder = new Container();
          btnHolder.x = TITLE_BUTTON.x;
          btnHolder.y = BTN_Y;
          btnHolder.alpha = 0;
          btnHolder.scale.set(0.6);
          btnHolder.addChild(playBtn as any);
          uiLayer.addChild(btnHolder);

          // ── Entrance animation ─────────────────────────────────────────────
          const tl = gsap.timeline();
          // The background and logo are already up (the loader revealed them); only the
          // play button pops in.
          tl.to(btnHolder, { alpha: 1, duration: 0.2, ease: 'power1.out' }, 0);
          tl.to(
            btnHolder.scale,
            { x: 1, y: 1, duration: 0.45, ease: 'back.out(1.8)' },
            0,
          );
          // The host shows a stand-in of this frame until Pixi has drawn it once.
          // (Two ticks: listeners run before that tick's render.)
          app.ticker.addOnce(() => app?.ticker.addOnce(() => deps.onReady?.()));

          // ── Ticker + resize ────────────────────────────────────────────────
          app.ticker.add((ticker: Ticker) => bg?.tick(ticker.deltaMS / 1000));

          /* trackHostBox observes the container element, so it catches the frame
           tweening between viewport presets — which Pixi's own `resizeTo`
           (window-resize based) misses. The background is `fluid`: it takes the
           raw box, not the design canvas. */
          cleanupResize = trackHostBox(app, container, [root], (w, h) => {
            bg?.resize(w, h);
          });
        } catch (err) {
          console.error('[startView] init failed:', err);
        }
      })();
    },

    destroy() {
      playNow = null;
      cleanupResize?.();
      cleanupResize = null;
      gsap.killTweensOf(logo);
      gsap.killTweensOf(playBtn);
      if (btnHolder) {
        gsap.killTweensOf(btnHolder);
        gsap.killTweensOf(btnHolder.scale);
      }
      gsap.killTweensOf(bg);
      logo?.destroy();
      logo = null;
      playBtn?.destroy();
      playBtn = null;
      btnHolder?.destroy();
      btnHolder = null;
      bg?.destroy();
      bg = null;
      root?.destroy({ children: true });
      root = null;

      releasePixiApp?.();
      releasePixiApp = null;
      if (app) {
        if (app.canvas && app.canvas.parentNode) {
          app.canvas.parentNode.removeChild(app.canvas);
        }
        app.destroy(true, { children: true });
        app = null;
      }
    },
  };
};
