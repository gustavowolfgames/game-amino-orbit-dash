/**
 * Wolf Games brand-sting intro (loading phase).
 *
 * A renderer-agnostic animated SVG (pure SVG + SMIL + a glow filter, no JS, no Pixi)
 * that plays during the pre-renderer DOM loading phase — before initGpu(). It reveals
 * the \I/ mark + "olfGames" wordmark, then DROPS + SHRINKS the lockup into a small
 * publisher footer at the bottom, turning it white. That clears centre-stage, and this
 * component brings in the GAME TITLE as a DOM element over a brand loading background —
 * the loader's resting state, which it holds until assets are ready.
 *
 * Reveal mode (`reveal` + `backgroundSrc` + `logoSrc`): instead of the brand background,
 * the game's own title background comes in early, under the sting — softly blurred, as a
 * blue-tinted greyscale that brightens, then takes its colour; the game logo is revealed, the
 * WolfGames lockup glides down to the footer, and the scene un-blurs into exactly the title
 * screen's opening frame (logo placed where the title screen draws it), so the handoff to the
 * title screen has no fade. With `target: 'game'` (the title is skipped: the Vault,
 * `?screen=game`) there is no logo, and the reveal ends on the play screen's background
 * instead; the lockup still zooms onto the WolfGames logo, which the game screen draws in the
 * same spot. [ENG-4977]
 *
 * The black backdrop, the brand background image, and the game title are all DOM layers
 * owned HERE (not in the SVG and not in Pixi): the SVG is transparent and only draws the
 * animated WolfGames lockup. That keeps the whole loader in the DOM phase.
 *
 * INCUBATING as a ContentLoader variant. This deliberately mirrors
 * `@wolfgames/components` ContentLoader's lifecycle contract (`progress` / `exitSignal` /
 * `onExitComplete`) and reuses its exported `LoaderBar`, so promotion is a fold-in: the
 * sting becomes a `heroContent` / `brand-sting` enter variant of ContentLoader rather
 * than a parallel component. Kept in-game while the design settles. [ENG-4657]
 *
 * catalog: considered screen-content-loader (ContentLoader — the branded DOM loader;
 * CHOSEN as the promotion target, mirrored here), interstitial, critical-flash — the
 * sting is a ContentLoader capability, not new; incubated in-game per the component
 * rules because the design is still settling. See intro-sting/README.md.
 */

import { LoaderBar } from '@wolfgames/components/modules/prefabs/screen-content-loader';
import gsap from 'gsap';
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { GAME_FONT_FAMILY } from '~/game/config';
import { BRAND_LOGO } from '~/game/safeZones';
// Single source of truth for the sting markup is the design sandbox at repo-root
// `intro-sting/wolf-sting.svg` (previewable via intro-sting/preview.html). On promotion
// into ContentLoader the SVG moves into that module folder. [ENG-4657]
import wolfStingRaw from '../../../../intro-sting/wolf-sting.svg?raw';
import { cssScaleOf, placeTitleLogo, titleBgMatch } from './titleFrame';

/** Timeline length of the sting, in seconds — MUST match the SVG `dur` attributes. */
const DURATION_SEC = 3.8;
/** When the brand background fades in (matches the SVG's old bg fade: reveal done ~2.4s). */
const BG_IN_SEC = 2.4;
/** When the game title is brought in — as the lockup drops/shrinks to its footer (~3.0s). */
const TITLE_IN_SEC = 3.1;
/** Exit fade duration — mirrors ContentLoader's default `fade` exit. */
const EXIT_SEC = 0.3;

/**
 * Reveal mode, seconds from the loader mounting. The title background comes in early, under
 * the sting: blue-tinted greyscale → brightens → the logo → takes its colour → the blur
 * clears. The sharpen waits for the sting to settle (DURATION_SEC): the SVG runs on its own
 * clock; the WolfGames lockup then parks on the play button's spot for the loading bar.
 */
const REVEAL = {
  /** Blurred, blue-tinted greyscale background fades up out of black. */
  bgIn: 0.4,
  bgInDur: 0.5,
  /** Brightens, still blue-grey. */
  light: 0.6,
  lightDur: 0.7,
  /** The logo is revealed as the sting's lockup clears centre stage. */
  logo: 3.0,
  logoDur: 0.7,
  /** Takes its colour just after the logo lands (the blue tint goes with the grey). */
  colour: 3.35,
  colourDur: 1.1,
  /** Un-blur into the title screen's first frame; the bar fades away. */
  sharp: DURATION_SEC,
  sharpDur: 0.7,
};
/**
 * Where the title screen draws the WolfGames logo (bottom centre) and its size, in design px
 * (`BRAND_LOGO`, src/game/safeZones.ts, which StartScreen also reads): the logo sits inside the
 * CSS-scaled design root, so on screen it is these × that scale.
 */
const WOLF_LOGO = BRAND_LOGO;
/**
 * Reveal mode's loader bar: comes in under the WolfGames lockup as soon as the sting settles,
 * as wide as the lockup and always just under it. It fills with the real progress, but never
 * faster than FOOT_BAR.minFillSec (a load that already finished still reads as loading);
 * `smoothSec` eases progress steps. While it fills, the lockup drifts slowly down at full size
 * (LOCKUP_DRIFT). Once full the bar fades, the lockup zooms down onto the title screen's
 * WolfGames logo (same spot, same size), and the title screen takes over.
 */
const FOOT_BAR = {
  height: 4,
  gap: 7,
  /** The bar's fade in, and its shrink-and-fade out before the lockup moves. */
  fadeSec: 0.3,
  minFillSec: 4.0,
  holdSec: 0.25,
  smoothSec: 0.35,
  simCap: 0.9,
  catchUp: 1.2,
};
/**
 * The lockup while loading: drifts down `fraction` of the way toward the title screen's logo,
 * at full size. Then, once loaded, it zooms the rest of the way and shrinks to title size.
 */
const LOCKUP_DRIFT = { fraction: 0.1, zoomSec: 0.6 };
/** Starting look of the background in reveal mode. */
const REVEAL_BLUR_PX = 4;
const REVEAL_DARK = 0.45;
/** The tint the greyscale start is washed with (fades out as the colour comes in). */
const REVEAL_TINT = '#3f7fd6';

/** Generated Wolf Games brand loading art (public/assets/bg-loader.webp), styled from
 *  the wolfgames.net hero. Served from the local-fallback `public/assets/` path, prefixed
 *  with the Vite base so frozen builds (`--base=./`) resolve it off the domain root too. */
const BG_SRC = `${import.meta.env.BASE_URL}assets/bg-loader.webp`;

// The sandbox SVG loops for review (repeatCount="indefinite"). For the loader we play it
// through exactly ONCE and hold the final frame — convert every animation to a single
// run that freezes on its last value.
const PLAY_ONCE_SVG = wolfStingRaw.replace(
  /repeatCount="indefinite"/g,
  'repeatCount="1" fill="freeze"',
);

/**
 * Reveal mode's sting: the lockup does NOT run its own drop-and-shrink to the footer (the two
 * `#lockup` animateTransforms in the SVG). It finishes assembling and stays where it is (it
 * still turns white); the loading descent then carries it slowly from there onto the title
 * screen's WolfGames logo, in step with the loading bar.
 */
const HOLD_SVG = PLAY_ONCE_SVG.replace(
  'values="0 0;0 0;313 1281;313 1281"',
  'values="0 0;0 0;0 0;0 0"',
).replace('values="1;1;0.42;0.42"', 'values="1;1;1;1"');

export interface IntroStingProps {
  /** Load progress 0–1 (accessor or value) — drives the loader bar. Mirrors ContentLoader. */
  progress?: (() => number) | number;
  /** Game title brought in (DOM) once the WolfGames lockup settles into its footer. */
  title?: string;
  /** The game's background, in place of the brand loading art. */
  backgroundSrc?: string;
  /** The game's logo image: shown in place of the text title when set (title is its alt). */
  logoSrc?: string;
  /**
   * Cinematic reveal into the title screen (needs `backgroundSrc` and `logoSrc`): blurred
   * and dark → greyscale → colour → logo → sharp, then hand off with no exit fade.
   */
  reveal?: boolean;
  /**
   * The screen the reveal ends on: 'title' (default; needs `logoSrc`) or 'game', the play
   * screen's background with no logo (`backgroundSrc` is the game's `bg-game`).
   */
  target?: 'title' | 'game';
  /** Host signal: assets are ready. The exit runs once this AND the sting-done are both true. */
  exitSignal?: () => boolean;
  /** Called after the exit animation completes (e.g. goto('start')). Mirrors ContentLoader. */
  onExitComplete?: () => void;
}

/**
 * Plays the brand sting once, settles into a loader (brand bg + game title + bar), then
 * hands off. SMIL has no single "all animations finished" event, so the sting-done gate
 * is a GSAP delayedCall matched to the known timeline length (house rule: no setTimeout
 * for timing); the bg and title are brought in with their own GSAP tweens matched to the
 * SVG beats. The exit only fires once BOTH the sting has played through AND the host's
 * exitSignal is true — the same two-gate ContentLoader will own after promotion.
 */
export function IntroSting(props: IntroStingProps) {
  let rootRef: HTMLDivElement | undefined;
  let bgRef: HTMLImageElement | undefined;
  let titleRef: HTMLElement | undefined;
  let stingRef: HTMLDivElement | undefined;
  let barRef: HTMLDivElement | undefined;
  let tintRef: HTMLDivElement | undefined;
  const tweens: gsap.core.Animation[] = [];
  let introCall: gsap.core.Tween | undefined;
  let exitTween: gsap.core.Animation | undefined;
  let exited = false;

  const toGame = () => props.target === 'game';
  const reveal = () =>
    Boolean(props.reveal && props.backgroundSrc && (props.logoSrc || toGame()));
  const [introDone, setIntroDone] = createSignal(false);

  // Reveal mode's footer bar: real progress, held back by a minimum-time ramp.
  let footBarRef: HTMLDivElement | undefined;
  const [ramp, setRamp] = createSignal(0);
  const realProgress = () =>
    typeof props.progress === 'function'
      ? props.progress()
      : (props.progress ?? 0);
  /**
   * What the bar heads for: the minimum-time ramp, simulated up to FOOT_BAR.simCap while the
   * assets are still loading (the real progress often reports nothing until the end), then
   * the rest once they are ready. Real progress beyond the simulation still shows.
   */
  const footProgress = () => {
    const loaded = realProgress() >= 1 || Boolean(props.exitSignal?.());
    if (loaded) return ramp();
    return Math.min(
      ramp(),
      Math.max(realProgress(), Math.min(ramp(), FOOT_BAR.simCap)),
    );
  };
  /** footProgress eased over FOOT_BAR.smoothSec: what the bar shows and the lockup follows. */
  const [shownProgress, setShownProgress] = createSignal(0);
  /** The lockup's slow move down onto the title screen's WolfGames logo, scrubbed by shownProgress. */
  let descent: gsap.core.Tween | undefined;

  /** Size and place the bar under the settled lockup (screen px → the loader's own px). */
  const placeFootBar = () => {
    if (!rootRef || !footBarRef) return;
    const lockup = stingRef?.querySelector('#lockup')?.getBoundingClientRect();
    if (!lockup?.width) return;
    const root = rootRef.getBoundingClientRect();
    const k = cssScaleOf(rootRef);
    Object.assign(footBarRef.style, {
      left: `${(lockup.left - root.left) / k}px`,
      top: `${(lockup.bottom - root.top + FOOT_BAR.gap) / k}px`,
      width: `${lockup.width / k}px`,
    });
  };

  /**
   * The sting has settled: bring the bar in under the lockup, start the minimum fill, and set
   * up the lockup's move down onto the title screen's WolfGames logo, which the fill scrubs.
   */
  const showFootBar = () => {
    if (!footBarRef) return;
    placeFootBar();
    if (stingRef) {
      // Linear: the fill already eases in and out, so the drift is one steady, slow glide.
      descent = gsap.to(stingRef, {
        ...driftPose(),
        duration: 1,
        ease: 'none',
        paused: true,
      });
      tweens.push(descent);
    }
    tweens.push(
      gsap.to(footBarRef, {
        opacity: 1,
        duration: FOOT_BAR.fadeSec,
        ease: 'power1.out',
      }),
    );
    const fill = { v: 0 };
    tweens.push(
      gsap.to(fill, {
        v: 1,
        duration: FOOT_BAR.minFillSec,
        ease: 'none',
        onUpdate: () => setRamp(fill.v),
      }),
    );
    gsap.ticker.add(followProgress);
  };

  // Follow the target every frame: the bar fills smoothly, and the lockup (with the bar kept
  // just under it) moves down and shrinks in step. One ticker follower, not a tween per change:
  // re-creating an overwriting tween on every ramp update cancels each one before it renders.
  // A big catch-up (loading finished late) runs at FOOT_BAR.catchUp × the normal fill pace.
  let shown = 0;
  const followProgress = (_time: number, deltaMs: number) => {
    const target = footProgress();
    if (target === shown) return;
    const pace = deltaMs / 1000 / FOOT_BAR.minFillSec; // the normal fill's step this frame
    const gap = target - shown;
    // Eased, but never slower than half the fill pace (no long exponential tail) nor faster
    // than the catch-up pace; lands exactly on the target.
    const step = Math.min(
      Math.max(
        gap * (1 - Math.exp(-deltaMs / 1000 / FOOT_BAR.smoothSec)),
        pace * 0.5,
      ),
      pace * FOOT_BAR.catchUp,
    );
    shown = step >= gap ? target : shown + step;
    setShownProgress(shown);
    if (descent) {
      descent.progress(shown);
      placeFootBar();
    }
  };

  /** Put the logo where the title screen draws it (and keep the footer bar under the WolfGames logo). */
  const placeLogo = () => {
    if (rootRef && titleRef)
      placeTitleLogo(
        titleRef,
        rootRef.getBoundingClientRect(),
        cssScaleOf(rootRef),
      );
    placeFootBar();
  };

  /**
   * The settled `#lockup` and its host, measured once before the sting is transformed, so
   * every pose is relative to the same untransformed box (screen px). Null when the sting
   * can't be measured; the lockup then stays where the sting left it.
   */
  type LockupBase = {
    cx: number;
    cy: number;
    width: number;
    host: DOMRect;
    k: number;
  };
  let lockupBase: LockupBase | null | undefined;
  const measureLockupBase = (): LockupBase | null => {
    if (lockupBase !== undefined) return lockupBase;
    const lockup = stingRef?.querySelector('#lockup')?.getBoundingClientRect();
    const host = stingRef?.getBoundingClientRect();
    if (!stingRef || !lockup?.width || !host?.width) {
      lockupBase = null;
      return lockupBase;
    }
    lockupBase = {
      cx: lockup.left + lockup.width / 2,
      cy: lockup.top + lockup.height / 2,
      width: lockup.width,
      host,
      k: cssScaleOf(stingRef),
    };
    return lockupBase;
  };

  /**
   * GSAP vars that put the lockup's centre at a screen point (from the host's top-left) at a
   * screen width. Values are in the (CSS-scaled) loader's own px; the origin is the lockup's
   * untransformed centre, so successive poses don't compound.
   */
  const lockupPose = (
    pose: (base: LockupBase) => { cx: number; cy: number; width: number },
  ) => {
    const get = () => {
      const base = measureLockupBase();
      if (!base) return null;
      const p = pose(base);
      return {
        x: (base.host.left + p.cx - base.cx) / base.k,
        y: (base.host.top + p.cy - base.cy) / base.k,
        scale: p.width / base.width,
        origin: `${(base.cx - base.host.left) / base.k}px ${(base.cy - base.host.top) / base.k}px`,
      };
    };
    return {
      x: () => get()?.x ?? 0,
      y: () => get()?.y ?? 0,
      scale: () => get()?.scale ?? 1,
      transformOrigin: () => get()?.origin ?? '50% 50%',
    };
  };

  /**
   * Where the title screen draws the WolfGames logo (StartScreen: centred, `bottom-8`, atlas
   * size), in screen px: its design px × the design root's CSS scale (`b.k`), which the loader
   * sits inside too. Unscaled, the lockup only lands on the logo at the design size (390×844).
   */
  const titleCentreY = (b: LockupBase) =>
    b.host.height - (WOLF_LOGO.bottom + WOLF_LOGO.height / 2) * b.k;
  const titlePose = () =>
    lockupPose((b) => ({
      cx: b.host.width / 2,
      cy: titleCentreY(b),
      width: WOLF_LOGO.width * b.k,
    }));
  /** While loading: LOCKUP_DRIFT.fraction of the way down toward the title spot, full size. */
  const driftPose = () =>
    lockupPose((b) => {
      const fromY = b.cy - b.host.top;
      return {
        cx: b.cx - b.host.left,
        cy: fromY + (titleCentreY(b) - fromY) * LOCKUP_DRIFT.fraction,
        width: b.width,
      };
    });

  const playReveal = (bg: HTMLImageElement) => {
    const look = { blur: REVEAL_BLUR_PX, grey: 1, light: REVEAL_DARK };
    // The blue wash rides the grey: full while greyscale, gone once the colour is in.
    const paint = () => {
      bg.style.filter = `blur(${look.blur}px) grayscale(${look.grey}) brightness(${look.light})`;
      if (tintRef)
        tintRef.style.opacity = String(
          look.grey * Number(bg.style.opacity || 0),
        );
    };
    paint();
    // Ends exactly on the next screen's framing: the title's background is overscanned, the
    // game's is a plain cover fit (gameController's fitBackground).
    const match = () =>
      toGame()
        ? { scale: 1, y: 0 }
        : titleBgMatch(
            rootRef?.getBoundingClientRect() ?? { width: 0, height: 0 },
            { width: bg.naturalWidth, height: bg.naturalHeight },
            rootRef ? cssScaleOf(rootRef) : 1,
          );
    gsap.set(bg, { scale: 1.24 });
    // One timeline from the moment the loader mounts; its end is the intro's end (the exit
    // then waits only for the assets).
    const tl = gsap.timeline({ onComplete: () => setIntroDone(true) });
    tl.to(
      bg,
      {
        opacity: 1,
        duration: REVEAL.bgInDur,
        ease: 'power1.out',
        onUpdate: paint,
      },
      REVEAL.bgIn,
    );
    tl.to(
      look,
      {
        light: 1,
        duration: REVEAL.lightDur,
        ease: 'sine.inOut',
        onUpdate: paint,
      },
      REVEAL.light,
    );
    tl.to(
      look,
      {
        grey: 0,
        duration: REVEAL.colourDur,
        ease: 'sine.inOut',
        onUpdate: paint,
      },
      REVEAL.colour,
    );
    if (titleRef && !toGame()) {
      placeLogo();
      // Centre on `top` whatever the image's loaded height (GSAP owns the transform from here).
      gsap.set(titleRef, { yPercent: -50 });
      tl.fromTo(
        titleRef,
        { opacity: 0, scale: 0.86 },
        {
          opacity: 1,
          scale: 1,
          duration: REVEAL.logoDur,
          ease: 'back.out(1.6)',
        },
        REVEAL.logo,
      );
    }
    const sharp = REVEAL.sharp;
    tl.to(
      look,
      {
        blur: 0,
        duration: REVEAL.sharpDur,
        ease: 'power2.inOut',
        onUpdate: paint,
      },
      sharp,
    );
    tl.to(
      bg,
      {
        scale: () => match().scale,
        y: () => match().y,
        duration: REVEAL.sharpDur,
        ease: 'power2.inOut',
      },
      sharp,
    );
    // The sting has settled: the loading bar comes in under its WolfGames lockup, and as the
    // bar fills the lockup moves down slowly and shrinks onto the title screen's WolfGames
    // logo (showFootBar).
    tl.call(showFootBar, [], sharp);
    tweens.push(tl);
  };

  onMount(() => {
    if (reveal() && bgRef) {
      playReveal(bgRef);
      window.addEventListener('resize', placeLogo);
      return;
    }
    // Brand background fades in as the wordmark finishes assembling.
    if (bgRef) {
      tweens.push(
        gsap.to(bgRef, {
          opacity: 1,
          duration: 0.5,
          delay: BG_IN_SEC,
          ease: 'power1.out',
        }),
      );
    }
    // Game title is brought in as the lockup drops + shrinks to its footer.
    if (titleRef && (props.title || props.logoSrc)) {
      tweens.push(
        gsap.fromTo(
          titleRef,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay: TITLE_IN_SEC,
            ease: 'power2.out',
          },
        ),
      );
    }
    introCall = gsap.delayedCall(DURATION_SEC, () => setIntroDone(true));
  });

  createEffect(() => {
    if (exited || !introDone() || !props.exitSignal?.()) return;
    // Reveal mode: the bar has to read full, and the WolfGames lockup land, first.
    if (reveal() && shownProgress() < 1) return;
    exited = true;
    // Reveal mode ends on the title screen's first frame: hold the full bar a beat, shrink it to
    // its centre and fade it out, then (bar gone, so the lockup never passes over it) the
    // WolfGames lockup zooms down and shrinks onto the title screen's WolfGames logo (same
    // spot, same size), then hand off with no fade.
    if (reveal() && footBarRef) {
      const exitTl = gsap.timeline({
        onComplete: () => props.onExitComplete?.(),
      });
      exitTl.call(() => descent?.progress(1), [], FOOT_BAR.holdSec);
      exitTl.to(
        footBarRef,
        {
          opacity: 0,
          scaleX: 0,
          transformOrigin: '50% 50%',
          duration: FOOT_BAR.fadeSec,
          ease: 'power2.in',
        },
        FOOT_BAR.holdSec,
      );
      if (stingRef) {
        exitTl.to(
          stingRef,
          {
            ...titlePose(),
            duration: LOCKUP_DRIFT.zoomSec,
            // Quick after the slow drift: picks up speed, then settles onto the spot.
            ease: 'power3.inOut',
          },
          FOOT_BAR.holdSec + FOOT_BAR.fadeSec,
        );
      }
      exitTween = exitTl;
    } else if (rootRef && !reveal()) {
      exitTween = gsap.to(rootRef, {
        opacity: 0,
        duration: EXIT_SEC,
        ease: 'power2.in',
        onComplete: () => props.onExitComplete?.(),
      });
    } else {
      props.onExitComplete?.();
    }
  });

  onCleanup(() => {
    window.removeEventListener('resize', placeLogo);
    gsap.ticker.remove(followProgress);
    for (const t of tweens) t.kill();
    introCall?.kill();
    exitTween?.kill();
  });

  return (
    <div
      ref={rootRef}
      data-intro-sting={
        reveal() ? `reveal-${props.target ?? 'title'}` : 'brand'
      }
      style={{
        position: 'absolute',
        inset: '0',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Loading background (DOM layer, behind the transparent sting SVG). */}
      <img
        ref={bgRef}
        src={props.backgroundSrc ?? BG_SRC}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          'object-fit': 'cover',
          opacity: '0',
        }}
      />
      {/* Reveal mode: blue wash over the greyscale background (`color` blend keeps its
          light and shade), faded out as the colour comes in. */}
      <Show when={reveal()}>
        <div
          ref={(el) => {
            tintRef = el;
          }}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '0',
            background: REVEAL_TINT,
            'mix-blend-mode': 'color',
            opacity: '0',
            'pointer-events': 'none',
          }}
        />
      </Show>
      {/* Full-bleed sting. Trusted, build-time-bundled SVG markup; no user input. */}
      <div
        ref={stingRef}
        style={{
          position: 'absolute',
          inset: '0',
          display: 'grid',
          'place-items': 'center',
        }}
        innerHTML={reveal() ? HOLD_SVG : PLAY_ONCE_SVG}
      />
      {/* Game logo — in place of the text title when the game has one. */}
      <Show when={props.logoSrc}>
        <img
          ref={(el) => {
            titleRef = el;
          }}
          src={props.logoSrc}
          alt={props.title ?? ''}
          style={{
            position: 'absolute',
            left: '8%',
            width: '84%',
            top: '40%',
            transform: 'translateY(-50%)',
            opacity: '0',
            'object-fit': 'contain',
            'pointer-events': 'none',
          }}
        />
      </Show>
      {/* Game title — brought in (DOM) once the lockup clears centre-stage. */}
      <Show when={props.title && !props.logoSrc}>
        <h1
          ref={(el) => {
            titleRef = el;
          }}
          style={{
            position: 'absolute',
            left: '6%',
            right: '6%',
            top: '42%',
            margin: '0',
            transform: 'translateY(-50%)',
            opacity: '0',
            'text-align': 'center',
            'font-family': GAME_FONT_FAMILY,
            'font-weight': '800',
            'font-size': 'clamp(40px, 11vw, 92px)',
            'line-height': '1.02',
            'letter-spacing': '0.02em',
            'text-transform': 'uppercase',
            color: '#ffffff',
            'text-shadow': '0 2px 24px rgba(0,0,0,0.65)',
            'pointer-events': 'none',
          }}
        >
          {props.title}
        </h1>
      </Show>
      {/* Reveal mode: a slim bar as wide as the sting's WolfGames lockup, just under it
          (placeFootBar sets left/top/width from the lockup when it shows). */}
      <Show
        when={reveal()}
        fallback={
          // Loader bar pinned to the bottom edge, below the dropped lockup.
          <div
            ref={barRef}
            style={{
              position: 'absolute',
              left: '8%',
              right: '8%',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            }}
          >
            <LoaderBar progress={props.progress ?? 0} />
          </div>
        }
      >
        <div
          ref={(el) => {
            footBarRef = el;
          }}
          data-foot-bar=""
          style={{
            position: 'absolute',
            left: '0',
            top: '0',
            width: `${WOLF_LOGO.width}px`,
            opacity: '0',
            'pointer-events': 'none',
          }}
        >
          <LoaderBar progress={shownProgress} height={FOOT_BAR.height} />
        </div>
      </Show>
    </div>
  );
}
