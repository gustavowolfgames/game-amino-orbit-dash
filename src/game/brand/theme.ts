/**
 * The resolved theme: a brand sheet reduced to the handful of values this game draws with.
 *
 * A sheet is the partner's vocabulary (grounds, accents, roles that point at either). The theme
 * is the game's: one page colour, one text colour, an orb palette, three font stacks. Screens
 * (DOM) read it through CSS variables set on `<html>`; the Pixi scene reads `getTheme()` when it
 * builds, which is always after boot has settled the brand.
 *
 * A fork drawing more (button states, a mark, a wallpaper) widens `GameTheme` and `resolveTheme`
 * — the sheet already carries those fields.
 */

import type { BrandOverride } from '../../../schemas/brand/schema';
import { BUILD_FONTS, BUILD_SHEET } from './defaults';
import type { TypeRole } from './fonts';

export interface GameTheme {
  readonly mode: 'light' | 'dark';
  /** Partner/display name, when the sheet has one. */
  readonly displayName: string;
  /** The page behind everything. */
  readonly ground: string;
  /** What sits on the page (cards, panels). */
  readonly surface: string;
  /** Body text and lines on `ground`. */
  readonly text: string;
  /** Disabled / secondary text. */
  readonly muted: string;
  /** The brand's lead colour (primary buttons, highlights). */
  readonly accent: string;
  /** Ink that reads on `accent`. */
  readonly accentInk: string;
  /** Piece tints for the Pixi scene (the demo's orbs), as `0xRRGGBB`. Never empty. */
  readonly pieces: readonly number[];
  /** CSS font stacks, by typographic role. */
  readonly fonts: Readonly<Record<TypeRole, string>>;
  /** The partner's site (https only — validated at the schema). */
  readonly link: string | null;
}

type Grounds = NonNullable<BrandOverride['dark']>;
type Ref = string | { light: string; dark: string };

const FALLBACK_STACK = "Arial, 'Helvetica Neue', sans-serif";
const stack = (family: string) => `'${family.replace(/'/g, '')}', ${FALLBACK_STACK}`;
const hexToNum = (hex: string) => Number.parseInt(hex.slice(1), 16);

/**
 * Resolve a role reference — a hex, a palette role name, or one per mode — to a hex. Unknown
 * names fall back so a sheet naming a role this game does not draw still resolves.
 */
function resolveRef(ref: Ref | undefined, mode: 'light' | 'dark', sheet: BrandOverride, grounds: Grounds, fallback: string): string {
  if (ref === undefined) return fallback;
  const name = typeof ref === 'string' ? ref : ref[mode];
  if (name.startsWith('#')) return name;
  const palette: Record<string, string | null | undefined> = {
    ...grounds,
    grid: grounds.inactive2,
    primaryAccent: sheet.primaryAccent,
    secondaryAccent: sheet.secondaryAccent,
    tertiaryAccent: sheet.tertiaryAccent,
    negative: sheet.negative,
  };
  return palette[name] ?? fallback;
}

/** Reduce a (merged) sheet plus the font families that actually loaded to a theme. */
export function resolveTheme(sheet: BrandOverride, families: Partial<Record<TypeRole, string>> = {}): GameTheme {
  const mode = sheet.theme ?? BUILD_SHEET.theme;
  const grounds: Grounds = sheet[mode] ?? BUILD_SHEET[mode];
  const primary = sheet.primaryAccent ?? BUILD_SHEET.primaryAccent;
  const secondary = sheet.secondaryAccent ?? BUILD_SHEET.secondaryAccent;
  const tertiary = sheet.tertiaryAccent ?? BUILD_SHEET.tertiaryAccent;
  const roles = sheet.roles ?? {};

  const ground = resolveRef(roles.ground, mode, sheet, grounds, grounds.base);
  const surface = resolveRef(roles.surface, mode, sheet, grounds, grounds.secondary);
  const accent = resolveRef(roles.buttonFill, mode, sheet, grounds, primary);
  const accentInk = resolveRef(roles.primaryInk, mode, sheet, grounds, grounds.base);

  const extra = sheet.extraColors && sheet.extraColors.length > 0 ? sheet.extraColors : null;
  const pieces = (extra ?? [primary, secondary, tertiary]).map(hexToNum);

  return {
    mode,
    displayName: sheet.displayName ?? BUILD_SHEET.displayName,
    ground,
    surface,
    text: grounds.textLine,
    muted: grounds.inactive,
    accent,
    accentInk,
    pieces,
    fonts: {
      display: stack(families.display ?? BUILD_FONTS.display),
      body: stack(families.body ?? BUILD_FONTS.body),
      numeric: stack(families.numeric ?? BUILD_FONTS.numeric),
    },
    link: sheet.link ?? null,
  };
}

// ── The theme in force ──────────────────────────────────────────────────────

let current: GameTheme = resolveTheme(BUILD_SHEET);

/** The theme in force — the build's until a published sheet is applied. */
export function getTheme(): GameTheme {
  return current;
}

const rgbTriplet = (hex: string) => {
  const n = hexToNum(hex);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/** Install a theme and publish it to the DOM as CSS variables (no-op without a document). */
export function applyTheme(theme: GameTheme): GameTheme {
  current = theme;
  if (typeof document === 'undefined') return theme;
  const s = document.documentElement.style;
  // `--background-rgb` / `--foreground-rgb` already paint <html>/<body> (src/app.css).
  s.setProperty('--background-rgb', rgbTriplet(theme.ground));
  s.setProperty('--foreground-rgb', rgbTriplet(theme.text));
  s.setProperty('--brand-ground', theme.ground);
  s.setProperty('--brand-surface', theme.surface);
  s.setProperty('--brand-text', theme.text);
  s.setProperty('--brand-muted', theme.muted);
  s.setProperty('--brand-accent', theme.accent);
  s.setProperty('--brand-accent-ink', theme.accentInk);
  s.setProperty('--font-display', theme.fonts.display);
  s.setProperty('--font-body', theme.fonts.body);
  s.setProperty('--font-numeric', theme.fonts.numeric);
  document.documentElement.dataset.theme = theme.mode;
  return theme;
}
