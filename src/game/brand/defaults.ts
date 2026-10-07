/**
 * The build's own brand sheet — Wolf Games, the look every fork boots in.
 *
 * Same shape as a published `brand` entry (`schemas/brand/schema.ts`), so a partner sheet layers
 * over it key by key (`./merge.ts`) and "no partner" is just this sheet. A fork retheming its
 * default look edits this file; a partner reskin never does — that is a published entry.
 *
 * Complete on purpose: every field the theme resolver reads has a value here, so a partial
 * partner sheet always resolves to a full theme.
 */

import type { BrandOverride } from '../../../schemas/brand/schema';

export const BUILD_SHEET = {
  displayName: 'Wolf Games',
  theme: 'dark',
  light: {
    base: '#F4F1E8',
    secondary: '#FFFFFF',
    textLine: '#141821',
    inactive: '#989898',
    inactive2: '#DCDCDC',
  },
  dark: {
    base: '#141821',
    secondary: '#1C2230',
    textLine: '#F4F1E8',
    inactive: '#5A6070',
    inactive2: '#2A3040',
  },
  primaryAccent: '#F6C453',
  secondaryAccent: '#5AA9E6',
  tertiaryAccent: '#E86A92',
  /** The demo's orb palette. A partner sheet's `extraColors: null` clears it → orbs take its accents. */
  extraColors: ['#5AA9E6', '#7FC8A9', '#F6C453', '#E86A92', '#B08BD8'],
  roles: {},
  link: 'https://wolf.games',
} as const satisfies BrandOverride;

/**
 * Type families the build ships (`src/app.css` @font-face). A partner sheet's `fonts[]` replaces
 * a role's family only once its files have loaded (`./fonts.ts`).
 */
export const BUILD_FONTS = {
  display: 'Baloo',
  body: 'Baloo',
  numeric: 'Baloo',
} as const;
