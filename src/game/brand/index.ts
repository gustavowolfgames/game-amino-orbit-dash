/**
 * Brand seam — partner reskin is data, not a fork.
 *
 *   defaults.ts  the build's own sheet (Wolf) — every fork boots in it
 *   merge.ts     validate a published sheet; layer it over the build's
 *   fonts.ts     register a sheet's font files before naming them
 *   theme.ts     sheet → the values this game draws with; CSS variables for the DOM
 *   load.ts      fetch the sheet (Content Pack, else `brand/theme`) and apply it
 *
 * Kept apart from `../content` (levels) on purpose: one build serves many partner looks and many
 * dated editions, in any combination. See .agents/recipes/dynamic-data.md.
 */

import { BUILD_SHEET } from './defaults';
import { applyTheme, resolveTheme } from './theme';

export { BUILD_FONTS, BUILD_SHEET } from './defaults';
export { loadBrand, resetBrand, THEME_ENTRY } from './load';
export { mergeOverride, validateOverride } from './merge';
export { applyTheme, type GameTheme, getTheme, resolveTheme } from './theme';

// The build's brand paints before anything else: synchronous, at first import, no network.
applyTheme(resolveTheme(BUILD_SHEET));
