/**
 * juice — the game's one kit of feedback verbs (pop, burst, sparkle, fly, flash, shake,
 * cascade, freeze), owned here so every score and win feels the same and retunes in one
 * place (Carina: patterns/feedback-verbs). Design space (DESIGN_CANVAS 390×844).
 *
 * Every verb wraps a `@wolfgames/components` module; nothing here draws its own art. The
 * controller triggers verbs from the cue table's `run` hooks (`../screens/feedback.ts`), never
 * by diffing counters. Numbers live in tuning (`juice` in src/game/tuning/types.ts).
 *
 * Particles come from one pooled `ParticleBurst`, so a busy moment drops the oldest sparks
 * rather than the player's own feedback (Carina: patterns/effects-budget-drop-the-least-noticed).
 */

// catalog: considered particle-burst, particle-vfx, pixel-burst, sprite-vfx, fly-text, screen-flash,
// critical-flash, screen-shake — chose particle-burst (sparks, confetti), pixel-burst (tap sparkle),
// fly-text ("+1"), screen-flash (win flash), screen-shake (win impact); particle-vfx plays authored
// @wolfgames/vfx descriptors and sprite-vfx an atlas, neither of which this template ships.
import { FlyText } from '@wolfgames/components/modules/primitives/fly-text';
import { ParticleBurst } from '@wolfgames/components/modules/primitives/particle-burst';
import { PixelBurst } from '@wolfgames/components/modules/primitives/pixel-burst';
import { ScreenFlash } from '@wolfgames/components/modules/primitives/screen-flash';
import { ScreenShake } from '@wolfgames/components/modules/primitives/screen-shake';
import gsap from 'gsap';
import { Container } from 'pixi.js';

/** Wide enough to cover any letterbox around the 390×844 design canvas. */
const FLASH_SIZE = 2400;
const CENTER = { x: 195, y: 422 };
/** One frame at 60 fps, the unit Carina's timings are written in. */
const FRAME = 1 / 60;
/** Most live sparkles / fly-texts; past it the oldest goes (effects budget). */
const MAX_DECALS = 10;

export interface FlyOptions {
  fill: string;
  fontFamily: string;
  /** Scale on the first frame (the strongest), then settles to `endScale`. */
  peak: number;
  endScale: number;
}

export interface Juice {
  readonly layer: Container;
  /** Advance particles and fly-texts (seconds). Paused while a freeze holds. */
  tick(dt: number): void;
  /** Radial sparks at a point (a tap, an impact). */
  burst(x: number, y: number, colors: readonly number[], count: number): void;
  /** Squares off the edges of a small box (the spot a tap landed). */
  sparkle(x: number, y: number, size: number, color: number): void;
  /** Text that starts at its biggest and drifts up (Carina: patterns/take-hit-first-frame-strongest). */
  fly(x: number, y: number, text: string, o: FlyOptions): void;
  /**
   * Scale punch: the peak on the first frame, no wind-up, then a slow settle
   * (Carina: patterns/no-wind-up-on-player-input, patterns/take-hit-first-frame-strongest).
   * Width and height move opposite ways so the mass reads constant (Carina: patterns/squash-and-stretch-keep-volume).
   */
  pop(target: Container, peak: number, seconds: number): void;
  /** Full-screen flash; `dark` first gives a contrast frame (Carina: glossary/contrast-frame). */
  flash(color: number, alpha: number, contrast?: boolean): void;
  /** Rise-and-shower confetti. */
  cascade(x: number, y: number, colors: readonly number[], count: number): void;
  /** Decaying shake of a container (the win impact; never on every tap). */
  shake(target: Container, strength: 'light' | 'medium' | 'heavy'): void;
  /**
   * Hold the juice still for `frames`, then run `then` (Carina: patterns/freeze-frame-before-impact).
   * Only the kit's own motion pauses, not the HUD, audio or the sim.
   */
  freeze(frames: number, then: () => void): void;
  destroy(): void;
}

export function createJuice(): Juice {
  const layer = new Container();
  layer.eventMode = 'none';
  const particles = new ParticleBurst();
  const decals = new Container();
  const flasher = new ScreenFlash({
    screenWidth: FLASH_SIZE,
    screenHeight: FLASH_SIZE,
  });
  flasher.position.set(CENTER.x - FLASH_SIZE / 2, CENTER.y - FLASH_SIZE / 2);
  layer.addChild(particles, decals, flasher);

  const shaker = new ScreenShake();
  const flies: FlyText[] = [];
  const sparkles: PixelBurst[] = [];
  /** Rest scale per popped target (a sprite sized by width/height is not at 1). */
  const rest = new WeakMap<Container, { x: number; y: number }>();
  /** Tweens the kit started, so a freeze can hold them. */
  const tweens = new Set<gsap.core.Animation>();
  const track = <T extends gsap.core.Animation>(t: T): T => {
    // Finished ones are pruned here, not with onComplete (a delayedCall's callback IS its onComplete).
    for (const old of tweens) if (old.progress() >= 1) tweens.delete(old);
    tweens.add(t);
    return t;
  };
  let frozen = false;
  let dead = false;

  /** Effects budget: drop the oldest decal, never the one just asked for. */
  const trim = <T extends Container>(list: T[]) => {
    while (list.length > MAX_DECALS) list.shift()?.destroy();
  };

  return {
    layer,
    tick(dt) {
      if (frozen) return;
      particles.tick(dt);
      for (let i = flies.length - 1; i >= 0; i--) {
        flies[i].tick(dt);
        if (flies[i].destroyed) flies.splice(i, 1); // fly-text ends itself
      }
    },
    burst(x, y, colors, count) {
      particles.burst(x, y, {
        count,
        colors: [...colors],
        lifetime: 0.55,
        sizeMin: 3,
        sizeMax: 7,
        speedMin: 160,
        speedMax: 380,
      });
    },
    sparkle(x, y, size, color) {
      const s = new PixelBurst({ boxWidth: size, boxHeight: size, color });
      s.position.set(x, y);
      decals.addChild(s);
      sparkles.push(s);
      trim(sparkles);
      s.burst();
      track(
        gsap.delayedCall(1.2, () => {
          const i = sparkles.indexOf(s);
          if (i >= 0) sparkles.splice(i, 1);
          if (!s.destroyed) s.destroy();
        }),
      );
    },
    fly(x, y, text, o) {
      const f = new FlyText({
        text,
        x,
        y: y - 18,
        fill: o.fill,
        fontFamily: o.fontFamily,
        fontSize: 26,
        startScale: o.peak,
        endScale: o.endScale,
        lifetime: 0.7,
        velocityY: -110,
      });
      decals.addChild(f);
      flies.push(f);
      trim(flies);
    },
    pop(target, peak, seconds) {
      let r = rest.get(target);
      if (!r) {
        r = { x: target.scale.x, y: target.scale.y };
        rest.set(target, r);
      }
      gsap.killTweensOf(target.scale);
      // Strike frame: biggest now, slightly flatter so the volume holds.
      target.scale.set(r.x * peak, r.y * (1 + (peak - 1) * 0.6));
      track(
        gsap.to(target.scale, {
          x: r.x,
          y: r.y,
          duration: seconds,
          ease: 'elastic.out(1, 0.5)',
        }),
      );
    },
    flash(color, alpha, contrast = false) {
      if (!contrast) {
        void flasher.flash(color, alpha, 0.22);
        return;
      }
      // One dark frame, then the bright one reads brighter.
      void flasher
        .flash(0x000000, 0.35, FRAME * 2)
        .then(() => flasher.flash(color, alpha, 0.24));
    },
    cascade(x, y, colors, count) {
      particles.cascade(x, y, { count, colors: [...colors], lifetime: 1.4 });
    },
    shake(target, strength) {
      shaker.shake(target, strength);
    },
    freeze(frames, then) {
      frozen = true;
      const held = [...tweens].filter((t) => t.progress() < 1 && !t.paused());
      for (const t of held) t.pause();
      const hold = gsap.delayedCall(frames * FRAME, () => {
        frozen = false;
        if (dead) return;
        for (const t of held) t.resume();
        then();
      });
      tweens.add(hold); // not track(): a freeze must survive until it resumes, and die with the kit
    },
    destroy() {
      dead = true;
      for (const t of tweens) t.kill();
      tweens.clear();
      shaker.destroy();
      // The app's teardown may have destroyed the layer with the stage already.
      if (!layer.destroyed) layer.destroy({ children: true });
      flies.length = 0;
      sparkles.length = 0;
    },
  };
}
