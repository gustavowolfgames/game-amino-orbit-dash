import { type } from 'arktype';

/** `#RRGGBB`, the only colour form the palette accepts. */
const HEX = '/^#[0-9A-Fa-f]{6}$/';

/**
 * A partner brand sheet, delivered through Dynamic Data.
 *
 * The field set is the one the Wolf brand kit and the Game Manager already use (the Us Weekly
 * and Law & Crime sheets in `./examples` publish unchanged), so a sheet authored for one game
 * applies to another. Each game reads the subset it can draw — this template resolves grounds,
 * accents, roles and fonts into its theme (`src/game/brand/theme.ts`) — and ignores the rest.
 *
 * Every field is optional and nothing is restated: an entry carrying only `tertiaryAccent` changes
 * only that accent, and an empty entry is a no-op rather than a sheet that blanks the build's own
 * branding. An optional field set to `null` means "back to the build default".
 *
 * Type families travel WITH their files: `fonts[]` names a face per role and the URL of the font
 * file behind it, and the game registers each one through `FontFace` before the sheet applies
 * (`src/game/brand/fonts.ts`). A bare family name with no file is not accepted — it would
 * render as the system face, and Pixi would have measured its text against the wrong metrics.
 *
 * `mark`, `wallpaper` and `hand` are an asset alias or an absolute URL on the game's own CDN.
 * This template draws none of them yet; the partner examples leave them `null`.
 */
const HTTPS = '/^https:\\/\\/[^\\s]+$/';

/**
 * One font file. `weight` is the CSS weight the file carries (`'400'`, `'700'`…), absent = 400;
 * a family ships one entry per weight file, as the kit asks for light…bold.
 * The role names the typographic job the family takes over.
 */
export const BrandFontDef = type({
  family: 'string',
  sourceUrl: HTTPS,
  role: "'display'|'body'|'numeric'",
  'weight?': '/^[1-9]00$/',
});
export type BrandFont = typeof BrandFontDef.infer;

/** One of the designer's eight styles : which family, how heavy, how big. */
const TypeStyleDef = type({
  role: "'display'|'body'|'numeric'",
  weight: '100<=number<=900',
  /** Pixi floors text at 14 px; the cap keeps a CMS typo from drawing a title off the phone. */
  size: '8<=number<=72',
});
/**
 * The type scale, entry by entry. A sheet restating only `title1` changes only `title1`; the
 * rest stays the build's (which is itself the kit's scale where that sheet is silent).
 */
export const BrandScaleDef = type({
  'title1?': TypeStyleDef,
  'title2?': TypeStyleDef,
  'title3?': TypeStyleDef,
  'bodyLarge?': TypeStyleDef,
  'bodyMedium?': TypeStyleDef,
  'bodySmall?': TypeStyleDef,
  'caption?': TypeStyleDef,
  'data?': TypeStyleDef,
  // A style name the kit does not draw is dropped, not refused: it cannot reach TYPE, and a
  // typo in one row should not cost the sheet its colours.
}).onUndeclaredKey('delete');

/**
 * The five grounds of one theme, exactly the designer sheet's "Section 2" top row, under its own
 * names: Base, Secondary, Text/Line (`textLine`), Inactive, Inactive 2. All five or none: a
 * block is a set the designer paired, and a half-filled one could ship white text on a white panel.
 */
export const GroundsDef = type({
  base: HEX,
  secondary: HEX,
  textLine: HEX,
  inactive: HEX,
  inactive2: HEX,
});
export type Grounds = typeof GroundsDef.infer;

/**
 * What a state role may be set to: a role of the palette, a hex, or one of each per theme. The
 * palette's own derived roles are left out so a ref can never name itself.
 */
const ROLE =
  "'primaryAccent'|'secondaryAccent'|'tertiaryAccent'|'negative'|'base'|'secondary'|'textLine'|'grid'|'inactive'|'inactive2'";
const STATE_COLOR = type(HEX).or(ROLE);
const STATE_REF = STATE_COLOR.or({ light: STATE_COLOR, dark: STATE_COLOR });
/**
 * The derived roles. The state roles — what a tile or a button becomes
 * on hover, while held, and as a selection — are read from the accents the way every designer
 * sheet draws Section 3, so a sheet never has to restate them. What differs per brand: the
 * resting label (`buttonInk`: Us Weekly its Primary Accent, Law & Crime its Tertiary) and which of
 * Base / Secondary is the page and which sits on it (`ground` / `surface`). Any may be pinned here
 *.
 */
export const RolesDef = type({
  'hover?': STATE_REF,
  'pressed?': STATE_REF,
  'selected?': STATE_REF,
  /** The page background; absent → the Base. Law & Crime paints its Secondary. */
  'ground?': STATE_REF,
  /** What sits on the page (tiles, cards, a button in light); absent → the Secondary. */
  'surface?': STATE_REF,
  'buttonFill?': STATE_REF,
  'buttonInk?': STATE_REF,
  'primaryInk?': STATE_REF,
}).onUndeclaredKey('delete');

/**
 * A cell of the button state table: a palette colour, never a hex — the table picks from the
 * sheet's palette, derived roles included, or one per theme.
 */
const BUTTON_COLOR = type(ROLE).or(
  "'hover'|'pressed'|'selected'|'ground'|'surface'|'buttonFill'|'buttonInk'|'primaryInk'|'error'|'badge'",
);
const BUTTON_REF = BUTTON_COLOR.or({ light: BUTTON_COLOR, dark: BUTTON_COLOR });
const ButtonCellDef = type({
  'fill?': BUTTON_REF,
  'ink?': BUTTON_REF,
  'ring?': BUTTON_REF,
});
const ButtonRowDef = type({
  'default?': ButtonCellDef,
  'hover?': ButtonCellDef,
  'pressed?': ButtonCellDef,
  'disabled?': ButtonCellDef,
  'selected?': ButtonCellDef,
  'on?': ButtonCellDef,
  'negative?': ButtonCellDef,
}).onUndeclaredKey('delete');
/** Overrides of the button state table, per kind then state; an absent cell keeps the kit's. */
export const ButtonsDef = type({
  'solid?': ButtonRowDef,
  'outline?': ButtonRowDef,
  'primary?': ButtonRowDef,
}).onUndeclaredKey('delete');

export const BrandDef = type({
  'displayName?': 'string',
  /**
   * Light or dark. Not a partner colour — it picks which grounds (`light` or `dark`) are in
   * force, so it is the one field here that every game honours even when no partner colours
   * are published.
   */
  'theme?': "'light'|'dark'",
  /** The grounds of the light theme, all five; `null` → the kit's. */
  'light?': GroundsDef.or('null'),
  /** The grounds of the dark theme, all five; `null` → the kit's. */
  'dark?': GroundsDef.or('null'),
  'primaryAccent?': HEX,
  'secondaryAccent?': HEX,
  'tertiaryAccent?': HEX,
  /** The Secondary Accent on the dark theme; `null` → the kit's (the Secondary Accent itself). */
  'darkSecondaryAccent?': type(HEX).or('null'),
  /** Pins for the derived roles (the resting label ink, the state roles); replaces the base's whole; `{}` → every one derived. */
  'roles?': RolesDef,
  /** Overrides of the button state table; replaces the base's whole; `{}` → the kit's table. */
  'buttons?': ButtonsDef,
  /**
   * Cells (`kind.state`) where the sheet accepts the readability guard swapping its resting ink
   * for one that reads; any other swap warns. `null` → none accepted.
   */
  'acceptInkFallback?': type(
    '/^(solid|outline|primary)\\.(default|hover|pressed|disabled|selected|on|negative)$/',
  )
    .array()
    .atMostLength(21)
    .or('null'),
  /** The partner's red, for fixed negative/error colours. */
  'negative?': type(HEX).or('null'),
  /** The attention-count colour (the hint pill's bubble). Absent → the Primary Accent. */
  'badge?': type(HEX).or('null'),
  /**
   * Extra colours beside the palette, one flat ordered list. Not roles: games use them when they
   * need several colours (a game's pieces or tiles). `null` → the kit's list, which every
   * build gets by default; `[]` → none. A published list replaces the build's list
   * wholesale, never entry by entry. Capped so a CMS slip cannot ship hundreds.
   */
  'extraColors?': type(HEX).array().atMostLength(24).or('null'),
  /** One alias or CDN URL for both themes, or one per theme (the long wordmark's light and dark cuts). */
  'mark?': type('string|null').or({ light: 'string', dark: 'string' }),
  'wallpaper?': 'string|null',
  /** The How to Play hand, alias or URL; `null` → the shared one. */
  'hand?': 'string|null',
  /**
   * The partner's type, file by file. A role absent here keeps the build's family; a file
   * that fails to load keeps it too, so a dead URL costs nothing but the new face. Capped like
   * `extraColors`: three roles times five weights is the most the kit can use.
   */
  'fonts?': BrandFontDef.array().atMostLength(15),
  'scale?': BrandScaleDef,
  /**
   * The partner's site. Https only, and enforced here rather than at the banner: the value is
   * handed to `window.open`, so a `javascript:` payload in a CMS field would be a script running
   * in the game. This is the trust boundary, so this is where it is checked.
   */
  'link?': HTTPS,
});

export type BrandOverride = typeof BrandDef.infer;

/**
 * "Override nothing." Every field being optional makes the empty object a complete, valid sheet,
 * so a game with nothing published looks exactly like a game whose entry says to change nothing.
 */
export const defaultData: BrandOverride = {};
