/**
 * endScreen — the end of a run, drawn in the game's own Pixi scene.
 *
 * A level ends on the canvas the player is looking at instead of a hop to a
 * separate DOM screen, so the moment can carry particles and flashes. Three
 * catalog modules, all in the game's `DesignLayer` (390×844 design px):
 *
 *   • `celebrate()` — a win: a brand-tinted flash, then a confetti burst and shower.
 *   • `show(outcome)` — the win / lose card (`screen-results`): headline, stars,
 *     score count-up, Next / Try again and Main menu.
 *   • `hide()` — the card leaves; the next run starts underneath.
 *
 * The card's stars and character come from the `core-results` atlas. Until a
 * game publishes one, `./resultsArt.ts` stands in PLACEHOLDER art (the catalog
 * card's own proxy stars and character). A frame the atlas lacks is not drawn.
 *
 * Owned by the controller: `tick` from its per-frame render, `destroy` before
 * the Pixi app goes.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { ScreenResults } from '@wolfgames/components/modules/prefabs/screen-results';
// catalog: screen-results (win/lose card), particle-burst (confetti), screen-flash — user chose these over the DOM ResultsScreen, for particles and effects
import { ParticleBurst } from '@wolfgames/components/modules/primitives/particle-burst';
import { ScreenFlash } from '@wolfgames/components/modules/primitives/screen-flash';
import gsap from 'gsap';
import type { Container } from 'pixi.js';
import type { PixiLoader } from '~/core/systems/assets';

/** The atlas the card's art comes from (a `core-*` bundle: Pixi, in-game UI). */
export const RESULTS_ATLAS = 'core-results';

/** Bigger and longer-lived than particle-burst's defaults: a celebration, not a hit spark. */
const CONFETTI = { sizeMin: 6, sizeMax: 12, lifetime: 1.6 } as const;

/** When screen-results starts popping its earned stars (s into its entrance). */
const STARS_AT = 1.6;

/** Frame names in `RESULTS_ATLAS`. One star art serves all three slots. */
export const RESULTS_FRAMES = {
  star: 'ui-star',
  starEmpty: 'ui-star_empty',
  character: 'character-host',
  characterLose: 'character-host_lose',
  icon: 'ui-icon_home',
} as const;

export interface EndOutcome {
  won: boolean;
  /** The pack's last level was won. */
  packDone: boolean;
  /** 0-based level index. */
  level: number;
  score: number;
}

export interface EndScreenOptions {
  /** Confetti colours (the theme's piece palette). */
  colors: readonly number[];
  /** Flash colour (the theme's accent). */
  flashColor: number;
  /** Next level / Try again / Play again. */
  onPrimary: () => void;
  /** Main menu. */
  onSecondary: () => void;
  /** The card went up or down (the screen hides its footer under the card's buttons). */
  onOpenChange?: (open: boolean) => void;
}

export interface EndScreen {
  /** The card is up (input to the board is off). */
  readonly open: boolean;
  celebrate(): void;
  show(outcome: EndOutcome): void;
  hide(): void;
  tick(dtSec: number): void;
  destroy(): void;
}

/** Headline and button copy for an outcome. */
export function endCopy(o: EndOutcome): {
  headlineLine1: string;
  headlineLine2: string;
  primaryLabel: string;
  starsEarned: number;
} {
  if (!o.won)
    return {
      headlineLine1: 'GOOD TRY!',
      headlineLine2: '',
      primaryLabel: 'TRY AGAIN',
      starsEarned: 0,
    };
  return {
    headlineLine1: o.packDone ? 'ALL LEVELS' : `LEVEL ${o.level + 1}`,
    headlineLine2: 'COMPLETE!',
    primaryLabel: o.packDone ? 'PLAY AGAIN' : 'NEXT LEVEL',
    starsEarned: 3,
  };
}

export function createEndScreen(
  root: Container,
  gpuLoader: PixiLoader,
  options: EndScreenOptions,
): EndScreen {
  const { width, height } = DESIGN_CANVAS;
  let card: ScreenResults | null = null;
  let open = false;
  const setOpen = (next: boolean) => {
    if (next === open) return;
    open = next;
    options.onOpenChange?.(next);
  };

  /** The theme's pieces, its accent, and white, so it reads on any ground. */
  const colors = [...options.colors, options.flashColor, 0xffffff];
  let showers: gsap.core.Tween | null = null;
  const confetti = new ParticleBurst();
  confetti.eventMode = 'none';
  const flash = new ScreenFlash({ screenWidth: width, screenHeight: height });
  flash.eventMode = 'none';
  root.addChild(flash, confetti);

  const buildCard = () => {
    const next = new ScreenResults(gpuLoader, {
      atlasName: RESULTS_ATLAS,
      characterFrameName: RESULTS_FRAMES.character,
      characterLoseFrameName: RESULTS_FRAMES.characterLose,
      buttonIconFrameName: RESULTS_FRAMES.icon,
      starLeftFrameName: RESULTS_FRAMES.star,
      starMiddleFrameName: RESULTS_FRAMES.star,
      starRightFrameName: RESULTS_FRAMES.star,
      starLeftEmptyFrameName: RESULTS_FRAMES.starEmpty,
      starMiddleEmptyFrameName: RESULTS_FRAMES.starEmpty,
      starRightEmptyFrameName: RESULTS_FRAMES.starEmpty,
      onPrimary: () => open && options.onPrimary(),
      onSecondary: () => open && options.onSecondary(),
    });
    next.eventMode = 'passive';
    // Under the confetti, so the shower falls over the card.
    root.addChildAt(next, root.getChildIndex(flash));
    return next;
  };

  /** ScreenResults does not kill its entrance timeline on destroy (upstream gap); stop it first. */
  const dropCard = () => {
    if (!card) return;
    (
      card as unknown as { timeline?: gsap.core.Timeline | null }
    ).timeline?.kill();
    gsap.killTweensOf(card);
    card.destroy({ children: true });
    card = null;
  };

  return {
    get open() {
      return open;
    },

    celebrate() {
      void flash.flash(options.flashColor, 0.35, 0.18);
      confetti.burst(width / 2, height * 0.42, {
        ...CONFETTI,
        colors,
        count: 70,
      });
    },

    show(outcome) {
      card ??= buildCard();
      gsap.killTweensOf(card);
      card.visible = true;
      card.alpha = 1;
      setOpen(true);
      card.show({ score: outcome.score, ...endCopy(outcome) }); // replays its entrance
      showers?.kill();
      // A won card: confetti showers over it as the stars pop (their pop starts at 1.6s).
      showers = outcome.won
        ? gsap.delayedCall(STARS_AT, () => {
            for (const x of [0.25, 0.5, 0.75])
              confetti.cascade(width * x, height * 0.22, {
                ...CONFETTI,
                colors,
                count: 45,
              });
          })
        : null;
    },

    hide() {
      setOpen(false);
      showers?.kill();
      showers = null;
      const shown = card;
      if (!shown) return;
      gsap.to(shown, {
        alpha: 0,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => {
          shown.visible = false;
        },
      });
    },

    tick(dtSec) {
      confetti.tick(dtSec);
    },

    destroy() {
      setOpen(false);
      showers?.kill();
      showers = null;
      dropCard();
      gsap.killTweensOf(flash);
      flash.destroy();
      confetti.destroy({ children: true });
    },
  };
}
