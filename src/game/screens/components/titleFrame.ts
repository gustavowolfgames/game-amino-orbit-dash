/**
 * titleFrame — where the title screen draws its logo, for DOM layers that must line up
 * with it exactly: the loader's reveal (IntroSting) ends on that frame, and the start
 * screen shows it as a still until Pixi draws (StartScreen). With the title skipped, the
 * reveal ends on the play screen's background instead (`gameArt`).
 *
 * The title screen lays the logo out in design px on a `contain`-fit, centred DesignLayer
 * (src/game/mygame/screens/startView.tsx reads TITLE_LOGO, TITLE_BUTTON and TITLE_BG from here).
 */

import { DESIGN_CANVAS, resolveDesignFrame } from '@wolfgames/components/core';
import { LOCAL_ASSET_PATH } from '~/game/asset-manifest';

/** What `titleArt` reads from the resolved asset manifest (`useManifest().manifest()`). */
interface ManifestLike {
  cdnBase: string;
  bundles: { assets: { alias: string; src: string; base?: string }[] }[];
}

/** A manifest alias's URL (CDN or bundled, as the manifest resolves it), or null if absent. */
function aliasUrl(manifest: ManifestLike, alias: string): string | null {
  const asset = manifest.bundles
    .flatMap((b) => b.assets)
    .find((a) => a.alias === alias);
  return asset ? `${asset.base ?? manifest.cdnBase}/${asset.src}` : null;
}

/**
 * The title screen's background and logo as URLs for DOM layers (the loader's reveal and the
 * start screen's still): the manifest's `bg-title` / `ui-title`, the same files the title
 * screen draws. A game that drops those aliases gets the `public/assets/` copies.
 */
export function titleArt(manifest: ManifestLike): {
  background: string;
  logo: string;
} {
  return {
    background:
      aliasUrl(manifest, 'bg-title') ?? `${LOCAL_ASSET_PATH}/bg-title.webp`,
    logo: aliasUrl(manifest, 'ui-title') ?? `${LOCAL_ASSET_PATH}/ui-title.webp`,
  };
}

/**
 * The play screen's background as a URL, for when the loader hands straight to the game (the
 * Vault, `?screen=game`): the manifest's `bg-game`, the file the game controller draws
 * cover-fitted with no overscan, so a plain `object-fit: cover` matches its first frame.
 */
export function gameArt(manifest: ManifestLike): { background: string } {
  return {
    background:
      aliasUrl(manifest, 'bg-game') ?? `${LOCAL_ASSET_PATH}/bg-game.webp`,
  };
}

/**
 * The title background: a DynamicBackground layer cover-fitted with this overscan (px per
 * side) whose Ken Burns starts at zero zoom and `panY` px down (startView: TITLE_BG_MOTION).
 */
export const TITLE_BG = { overscan: 64, panY: 20 };

/**
 * Scale (on top of CSS `object-fit: cover`) and y offset that make a full-bleed `<img>` of
 * the title background match the title screen's first frame. `box` is in screen px; the y
 * offset is divided by `cssScale` (see `cssScaleOf`).
 */
export function titleBgMatch(
  box: { width: number; height: number },
  image: { width: number; height: number },
  cssScale = 1,
): { scale: number; y: number } {
  if (!image.width || !image.height || !box.width || !box.height)
    return { scale: 1, y: 0 };
  const cover = (w: number, h: number) =>
    Math.max(w / image.width, h / image.height);
  const o = TITLE_BG.overscan * 2;
  return {
    scale: cover(box.width + o, box.height + o) / cover(box.width, box.height),
    y: TITLE_BG.panY / cssScale,
  };
}

/** The logo's centre and width, design px. Set `width` to your wordmark's (startView reads it). */
export const TITLE_LOGO = { x: DESIGN_CANVAS.width / 2, y: 163, width: 320 };

/**
 * The play button's centre and size, design px (startView lays it out from this). The loader
 * parks the WolfGames lockup here while loading, so the player's eye is already on the spot
 * the button pops in at.
 */
export const TITLE_BUTTON = {
  x: DESIGN_CANVAS.width / 2,
  y: DESIGN_CANVAS.height - 152,
  size: 150,
};

/**
 * The CSS scale an element's ancestors apply (1 outside the DOM design transform). The loader
 * sits inside the scaled design root, so a px value it sets is drawn `cssScale` times larger;
 * the title screen's canvas is portalled out of it and is not scaled.
 */
export function cssScaleOf(el: HTMLElement): number {
  const shown = el.getBoundingClientRect().width;
  return el.offsetWidth > 0 && shown > 0 ? shown / el.offsetWidth : 1;
}

/**
 * Place `logo` (absolute, centred on its `top` by a -50% y translate) over a frame `box` given
 * in screen px. `cssScale` is the scale the logo's ancestors apply (`cssScaleOf`): the values
 * are divided by it, so the logo lands on the same screen px as the title screen's.
 *
 * Uses `resolveDesignFrame`, the function the title screen's DesignLayer resolves with.
 */
export function placeTitleLogo(
  logo: HTMLElement,
  box: { width: number; height: number },
  cssScale = 1,
): void {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const frame = resolveDesignFrame({
    hostWidth: box.width,
    hostHeight: box.height,
    devicePixelRatio: dpr,
    baselineDevicePixelRatio: dpr,
  });
  const s = frame.scale / cssScale;
  const ox = frame.offsetX / cssScale;
  const oy = frame.offsetY / cssScale;
  Object.assign(logo.style, {
    left: `${ox + (TITLE_LOGO.x - TITLE_LOGO.width / 2) * s}px`,
    top: `${oy + TITLE_LOGO.y * s}px`,
    width: `${TITLE_LOGO.width * s}px`,
    right: 'auto',
  });
}
