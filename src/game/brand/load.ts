/**
 * Boot-time brand override — the partner's live sheet, fetched over Dynamic Data.
 *
 * The build already wears a complete brand (`./defaults.ts`, applied at module load in
 * `./index.ts`), so the game is never waiting on the network to know what colour it is. This
 * layers on top: the sheet in the Content Pack under `packKey` when it carries one (an edition
 * ships its palette with its levels), else the deployment's `brand/theme` entry.
 *
 * It NEVER throws. No GameSDK, network down, nothing published, malformed payload — every one of
 * those leaves the build's own brand in place, which is always complete and correct.
 */

import {
  dynamicClient,
  type EntryClient,
  isPackNotFound,
  type KitLike,
} from '../content/dynamic-client';
import { BUILD_SHEET } from './defaults';
import { loadFonts } from './fonts';
import { mergeOverride, validateOverride } from './merge';
import { applyTheme, type GameTheme, resolveTheme } from './theme';

/**
 * The one entry every build reads. A fixed key, not a partner id: Dynamic Data is namespaced per
 * slug and a slug ships one game, so the entry is simply "the live theme for this deployment".
 */
export const THEME_ENTRY = 'theme';

/**
 * The sheet a Content Pack carries: its `brand` entry under `theme`, else its only one. Null when
 * the pack is not bound or carries no sheet. The level loader asks for the same key and the SDK
 * caches the bundle, so this is not a second download.
 */
async function sheetFromPack(
  client: EntryClient,
  packKey: string,
): Promise<unknown> {
  try {
    const sheets = (await client.getPack(packKey)).schemas.brand?.entries ?? {};
    return sheets[THEME_ENTRY] ?? Object.values(sheets)[0] ?? null;
  } catch (err) {
    if (!isPackNotFound(err))
      console.warn(
        `[brand] pack "${packKey}" unavailable — reading the theme entry.`,
        err,
      );
    return null;
  }
}

/**
 * Fetch, validate and apply the published sheet. Resolves to the theme now in force, or null
 * when the build's own brand was left untouched.
 */
export async function loadBrand(
  gameKit: KitLike | null | undefined,
  packKey?: string,
): Promise<GameTheme | null> {
  if (!gameKit) return null;

  let raw: unknown = null;
  try {
    const client = await dynamicClient(gameKit);
    if (packKey) raw = await sheetFromPack(client, packKey);
    // No `fallbackToDefault`: a miss reads as "nothing published"; the schema default is an
    // empty sheet, which would merge to the same no-op through a longer path.
    raw ??= await client.getEntry('brand', THEME_ENTRY);
  } catch (err) {
    console.warn(
      `[brand] theme sheet "${THEME_ENTRY}" unavailable — keeping the build's brand.`,
      err,
    );
    return null;
  }
  if (raw == null) {
    // Nothing published (the SDK answers a 404 entry with null): the expected case for a new game.
    if (import.meta.env.DEV)
      console.info(
        `[brand] no "${THEME_ENTRY}" sheet published — wearing the build's brand.`,
      );
    return null;
  }

  const override = validateOverride(raw);
  if (!override) {
    console.warn(
      `[brand] theme sheet refused: not a valid brand sheet — keeping the build's brand.`,
    );
    return null;
  }
  if (Object.keys(override).length === 0) return null;

  // Fonts first (awaited) so the one theme change carries the finished look — faces in, colours on.
  const families = await loadFonts(override.fonts ?? []);
  return applyTheme(
    resolveTheme(mergeOverride(BUILD_SHEET, override), families),
  );
}

/** Drop any published sheet and wear the build's brand again (a Vault deselection, tests). */
export function resetBrand(): GameTheme {
  return applyTheme(resolveTheme(BUILD_SHEET));
}
