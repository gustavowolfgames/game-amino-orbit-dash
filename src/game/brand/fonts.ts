/**
 * Registering a partner sheet's font files before its families are named anywhere.
 *
 * AWAITED, not fire-and-forget: Pixi measures a Text when it is constructed, so a face must be
 * in `document.fonts` before the theme names it, or HUD text is laid out against the fallback's
 * metrics. A role whose file (any weight of it) fails or times out is left out, so the build's
 * family stays in force for it rather than the system face.
 */

import type { BrandFont } from '../../../schemas/brand/schema';

export type TypeRole = BrandFont['role'];

/** Ceiling on the font round trip: a slow CDN costs the new face, never the boot. */
const FONT_TIMEOUT_MS = 2500;

/** Resolve to the families now safe to name, by role. No `FontFace` (tests, SSR) → nothing. */
export async function loadFonts(
  fonts: readonly BrandFont[],
  timeoutMs = FONT_TIMEOUT_MS,
): Promise<Partial<Record<TypeRole, string>>> {
  if (
    fonts.length === 0 ||
    typeof FontFace === 'undefined' ||
    typeof document === 'undefined'
  )
    return {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('font timed out')), timeoutMs);
  });
  const loaded = await Promise.allSettled(
    fonts.map((f) =>
      Promise.race([
        new FontFace(
          f.family,
          `url(${f.sourceUrl})`,
          f.weight === undefined ? undefined : { weight: f.weight },
        ).load(),
        timeout,
      ]).then((face) => document.fonts.add(face)),
    ),
  );
  clearTimeout(timer);
  // One failed weight fails the role: a family present at 400 but not 700 is the wrong metrics
  // for the bold styles, which is exactly the mismeasure this await exists to prevent.
  const failed = new Set<TypeRole>();
  loaded.forEach((r, i) => {
    if (r.status === 'rejected') failed.add(fonts[i].role);
  });
  const out: Partial<Record<TypeRole, string>> = {};
  for (const f of fonts) if (!failed.has(f.role)) out[f.role] = f.family;
  for (const role of failed)
    console.warn(
      `[brand] ${role} font did not load — keeping the build's family.`,
    );
  return out;
}
