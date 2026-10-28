/**
 * safeZones — the parts of the design canvas (DESIGN_CANVAS, 390×844) the app's own chrome
 * covers on every screen, in design px. Game views keep their controls out of these rects.
 *
 *   gear  the settings button (`GameSettingsMenu`), `GEAR_INSET` px in from the top-right
 *         corner (src/app.tsx). It is placed on the edge of the VIEW (`DesignBleed`), so on a
 *         view wider or taller than the canvas it sits further out; this rect is where it lands
 *         on a view of exactly the canvas's shape, the most it can cover.
 *   logo  the WolfGames logo, bottom centre (`GameScreen`, `StartScreen`, the loader's lockup
 *         in `IntroSting`), `BRAND_LOGO.bottom` px up from the canvas bottom. Hidden while the
 *         end card is up (its buttons sit there).
 *
 * The screens read their positions from here, so the rects and the chrome cannot drift apart.
 * The HUD (src/game/mygame/render/hud.ts) stays clear of them.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';

/** A rect in design px. */
export interface DesignRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The gear's offset from the top and right edges (src/app.tsx). */
export const GEAR_INSET = 8;

/**
 * The gear button's side: settings-menu-dom's `gearIconSize` (28) plus its `gearPadding` (8)
 * each side. A unit test holds this to the catalog's defaults.
 */
export const GEAR_SIZE = 44;

/** The WolfGames logo (`logo-wide-small` in public/assets/atlas-branding-wolf.json). */
export const BRAND_LOGO = { bottom: 32, width: 121, height: 19 } as const;

export const SAFE_ZONES: Readonly<Record<'gear' | 'logo', DesignRect>> = {
  gear: {
    x: DESIGN_CANVAS.width - GEAR_INSET - GEAR_SIZE,
    y: GEAR_INSET,
    width: GEAR_SIZE,
    height: GEAR_SIZE,
  },
  logo: {
    x: (DESIGN_CANVAS.width - BRAND_LOGO.width) / 2,
    y: DESIGN_CANVAS.height - BRAND_LOGO.bottom - BRAND_LOGO.height,
    width: BRAND_LOGO.width,
    height: BRAND_LOGO.height,
  },
};

/** Whether two rects overlap (touching edges do not). */
export function overlaps(a: DesignRect, b: DesignRect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Whether `rect` stays out of every safe zone. */
export function clearOfSafeZones(rect: DesignRect): boolean {
  return !Object.values(SAFE_ZONES).some((zone) => overlaps(rect, zone));
}
