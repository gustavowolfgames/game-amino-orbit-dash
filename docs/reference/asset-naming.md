# Asset naming

Filename rules for raw art and audio staged in `assets/src/`, and for the few files committed under `public/assets/`. Staging and publish are `.agents/recipes/assets.md`.

`scripts/check-asset-naming.ts` enforces these rules. Run `bun run check:assets`. It exits 1 on a bad name. Add `--suggest` to print a rename for each one. The patterns below are copied from that script. When this page and the script disagree, the script wins.

## Raw files

```
{category}-{name}[_{variant}].{ext}
```

- `category` is one of the prefixes below, then a hyphen.
- `name` is lowercase words joined by underscores.
- `_variant` is optional, also lowercase with underscores.
- `ext` is one of `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`, `wav`, `mp3`, `webm`, `ogg`, `m4a`, `woff`, `woff2`, `ttf`, `otf`.

The script's regex:

```
^(piece|exit|character|bg|item|prop|ui|vfx|sfx|music)-([a-z0-9]+(?:_[a-z0-9]+)*)(_[a-z0-9]+)?\.([a-zA-Z0-9]+)$
```

## Categories

| Prefix | For |
| --- | --- |
| `piece-` | Game pieces and blocks |
| `exit-` | Exits and goals |
| `character-` | Character sprites |
| `bg-` | Backgrounds |
| `item-` | Collectibles and icons |
| `prop-` | Stage props |
| `ui-` | UI elements |
| `vfx-` | Visual effect textures |
| `sfx-` | Sound effects |
| `music-` | Music |

A new category needs a new prefix in the script's regex first. Otherwise every file with it fails the check.

## Rules

1. Lowercase names. The extension check ignores case.
2. A hyphen separates the category from the name.
3. Underscores join words and variants: `hot_cocoa`, not `hot-cocoa` or `hotCocoa`.
4. Only `a-z`, `0-9`, `-`, and `_`. No spaces.
5. Be descriptive: `warehouse_interior_a`, not `bg1`.

Common variants are `_a`, `_b` for alternates, `_h`, `_v` for orientation, `_idle`, `_talking` for character states, and `_back`, `_fill` for UI parts.

## Examples

```
character-marty_idle.png
bg-warehouse_interior_a.png
ui-button_play.png
sfx-piece_slide_a.wav
music-chapter_a.mp3
```

## Packed files

Atlases, audio sprites, and VFX configs use hyphens between words instead. The script accepts these basenames:

| Kind | Pattern |
| --- | --- |
| Atlas data | `^atlas-[a-z0-9]+(-[a-z0-9]+)*\.json$` |
| Atlas image | `^atlas-[a-z0-9]+(-[a-z0-9]+)*\.(png\|jpg\|jpeg\|webp\|gif)$` |
| SFX sprite data | `^sfx-[a-z0-9]+(-[a-z0-9]+)*\.json$` |
| SFX sprite audio | `^sfx-[a-z0-9]+(-[a-z0-9]+)*\.(mp3\|webm\|ogg\|wav\|m4a)$` |
| Music sprite data | `^music-[a-z0-9]+(-[a-z0-9]+)*\.json$` |
| Music sprite audio | `^music-[a-z0-9]+(-[a-z0-9]+)*\.(mp3\|webm\|ogg\|m4a)$` |
| VFX config | `^vfx-[a-z0-9_-]+\.json$` |

`public/assets/atlas-branding-wolf.json` and its `.png` are examples. An atlas's JSON and image share one base name.

## Exceptions

These apply under `public/assets/` only:

- `vfx/` accepts `[a-z0-9_-]` names for json and image files, such as `effects/default.json`.
- `fonts/` accepts font names such as `Baloo-Regular.woff2`.
- `proxy/` placeholder art from `@wolfgames/components` and `cdn/` hydrate output skip the naming check.

Under `assets/src/`, every file must match, except the `_staging/` folder, which is skipped. Markdown files are skipped everywhere.

## Other checks in the same script

- Game media over `MAX_PUBLIC_MEDIA_BYTES` in `public/assets/` fails. It belongs on the CDN. `fonts/`, `vfx/`, `proxy/`, `cdn/`, and the favicon are exempt.
- A `media.wolf.games` or `media.<env>.wolf.games` URL anywhere in `src/` fails. URLs resolve through the manifest provider.
