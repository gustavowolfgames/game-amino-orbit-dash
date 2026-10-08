# Reskin without forking systems

## When

Open this recipe when a partner, a brand, or a level needs different colors, type, logos, or background art.

## Do

Brand tokens live in `brand/`. The schema is `schemas/brand.ts`. A new partner skin is a new JSON file in `brand/`, not a new game class. Systems read a `brand` field; they do not embed hex values, font names, or asset paths.

To add a partner skin:

1. Copy `brand/_template.json` to `brand/<partner_id>.json`.
2. Fill in colors, fonts, logo URL, and (if the game needs it) `blockPalette` or other per-game extensions.
3. Validate it against `schemas/brand.ts` at boot. See `examples/brand.example.json` for a filled reference.
4. Reference the brand id from the content pack (`schemas/pack.ts` has a `brand: Brand` field — see `examples/pack.example.json`).

Settings chrome is themed through the catalog `options-menu` module's config, passed from the screen that wraps it. Leaving the config empty keeps the catalog default.

Gameplay skin is read from the active pack's `brand` field. The content pack carries the brand with it, so publishing a new pack to a partner is a single DynamicData change. Adding a skin edits the brand JSON, the pack, and the CDN assets. It does not edit systems.

In game-amino-sort the theme ids are a closed union on the pack schema, and `BLOCK_THEMES` maps each id to art. A new id fails validation until the schema and the map both know it. That is the point. The sort systems stay put.

In game-amino-trivia-eda the Calloway colors and fonts live in one theme module under that repo's themes directory. Questions live in the pack.

Do not create a second game class per partner.

## Verify

Search the systems you touched for a raw color or a font family. They should be gone, replaced by a theme field.

Run `bun run typecheck:baseline`. If the pack schema rejects an unknown theme id, that rejection is the check working.

## Example

The Stacks map to copy for level art is `BLOCK_THEMES` in that game's levels themes file. Do not copy its Solid store.
