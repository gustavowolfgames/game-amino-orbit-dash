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
  displayName: 'Orbit Dash',
  theme: 'dark',
  light: {
    base: '#F4F1E8',
    secondary: '#FFFFFF',
    textLine: '#141821',
    inactive: '#989898',
    inactive2: '#DCDCDC',
  },
  dark: {
    base: '#0B1B2D',
    secondary: '#142A40',
    textLine: '#F5FEFF',
    inactive: '#6C90A3',
    inactive2: '#23425A',
  },
  primaryAccent: '#FFC857',
  secondaryAccent: '#68D7DB',
  tertiaryAccent: '#FF4E8A',
  /** The game's piece palette. A partner sheet's `extraColors: null` clears it → pieces take its accents. */
  extraColors: ['#68D7DB', '#80B8FF', '#FFC857', '#FF4E8A', '#B08BD8'],
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
