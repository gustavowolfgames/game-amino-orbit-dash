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

import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import gsap from 'gsap';
import { LoaderBar } from '@wolfgames/components/modules/prefabs/screen-content-loader';
import { GAME_FONT_FAMILY } from '~/game/config';
// Single source of truth for the sting markup is the design sandbox at repo-root
// `intro-sting/wolf-sting.svg` (previewable via intro-sting/preview.html). On promotion
// into ContentLoader the SVG moves into that module folder. [ENG-4657]
import wolfStingRaw from '../../../../intro-sting/wolf-sting.svg?raw';

/** Timeline length of the sting, in seconds — MUST match the SVG `dur` attributes. */
const DURATION_SEC = 3.8;
/** When the brand background fades in (matches the SVG's old bg fade: reveal done ~2.4s). */
const BG_IN_SEC = 2.4;
/** When the game title is brought in — as the lockup drops/shrinks to its footer (~3.0s). */
const TITLE_IN_SEC = 3.1;
/** Exit fade duration — mirrors ContentLoader's default `fade` exit. */
const EXIT_SEC = 0.3;

/** Generated Wolf Games brand loading art (public/assets/bg-loader.webp), styled from
 *  the wolfgames.net hero. Served from the local-fallback `public/assets/` path. */
const BG_SRC = '/assets/bg-loader.webp';

// The sandbox SVG loops for review (repeatCount="indefinite"). For the loader we play it
// through exactly ONCE and hold the final frame — convert every animation to a single
// run that freezes on its last value.
const PLAY_ONCE_SVG = wolfStingRaw.replace(
  /repeatCount="indefinite"/g,
  'repeatCount="1" fill="freeze"',
);

export interface IntroStingProps {
  /** Load progress 0–1 (accessor or value) — drives the loader bar. Mirrors ContentLoader. */
  progress?: (() => number) | number;
  /** Game title brought in (DOM) once the WolfGames lockup settles into its footer. */
  title?: string;
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
  let titleRef: HTMLHeadingElement | undefined;
  const tweens: gsap.core.Tween[] = [];
  let introCall: gsap.core.Tween | undefined;
  let exitTween: gsap.core.Tween | undefined;
  let exited = false;

  const [introDone, setIntroDone] = createSignal(false);

  onMount(() => {
    // Brand background fades in as the wordmark finishes assembling.
    if (bgRef) {
      tweens.push(
        gsap.to(bgRef, { opacity: 1, duration: 0.5, delay: BG_IN_SEC, ease: 'power1.out' }),
      );
    }
    // Game title is brought in as the lockup drops + shrinks to its footer.
    if (titleRef && props.title) {
      tweens.push(
        gsap.fromTo(
          titleRef,
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.6, delay: TITLE_IN_SEC, ease: 'power2.out' },
        ),
      );
    }
    introCall = gsap.delayedCall(DURATION_SEC, () => setIntroDone(true));
  });

  createEffect(() => {
    if (exited || !introDone() || !props.exitSignal?.()) return;
    exited = true;
    if (rootRef) {
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
    for (const t of tweens) t.kill();
    introCall?.kill();
    exitTween?.kill();
  });

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        inset: '0',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Brand loading background (DOM layer, behind the transparent sting SVG). */}
      <img
        ref={bgRef}
        src={BG_SRC}
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
      {/* Full-bleed sting. Trusted, build-time-bundled SVG markup; no user input. */}
      <div
        style={{
          position: 'absolute',
          inset: '0',
          display: 'grid',
          'place-items': 'center',
        }}
        innerHTML={PLAY_ONCE_SVG}
      />
      {/* Game title — brought in (DOM) once the lockup clears centre-stage. */}
      <Show when={props.title}>
        <h1
          ref={titleRef}
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
      {/* Loader bar pinned to the bottom edge, below the dropped lockup. */}
      <div
        style={{
          position: 'absolute',
          left: '8%',
          right: '8%',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <LoaderBar progress={props.progress ?? 0} />
      </div>
    </div>
  );
}
