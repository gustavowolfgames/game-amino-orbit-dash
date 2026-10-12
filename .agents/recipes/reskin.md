# Reskin without forking systems

## When

Open this recipe when a partner, a brand, or a level needs different colors, type, logos, or background art.

## Do

A brand is data, not code. The template ships the brand seam in `src/game/brand/`. Full guide: `docs/recipes/game-packs.md`.

- **The game's own look** is `BUILD_SHEET` in `src/game/brand/defaults.ts`. Every build boots in it with no network. A fork retheming its default look edits this file.
- **A partner skin** is a published `brand` entry (schema: `schemas/brand/schema.ts`). Publish it under the key `theme` to reskin the whole deployment, or bind it into a Content Pack to ship it with one edition. It needs no code change. `schemas/brand/examples/us-weekly.json` and `law-and-crime.json` are filled sheets.
- A sheet is partial on purpose. It layers over `BUILD_SHEET` key by key (`src/game/brand/merge.ts`), so an entry with one accent changes only that accent.
- Fonts travel with their files. A sheet names each face and its URL, and `src/game/brand/fonts.ts` registers it before the theme applies.

Draw with the theme, never with literals. Pixi code calls `getTheme()` from `src/game/brand`. DOM screens use the `--brand-*` and `--font-*` CSS variables. Systems and renderers do not embed hex values, font names, or asset paths.

Settings chrome is themed through `src/game/settingsTheme.ts`, which configures the catalog `options-menu`. Leaving it empty keeps the catalog default.

Do not create a second game class per partner.

## Verify

Search the files you touched for a raw color or a font family. They should be gone, replaced by a theme field.

`bun run test:run` passes `tests/unit/content/brand.test.ts`. `bun run test:e2e` passes the brand switch in `tests/e2e/game-packs.spec.ts`: same build, same pack, a different look.

## Example

`src/game/mygame/screens/startView.tsx` draws its background from `getTheme().ground`.
