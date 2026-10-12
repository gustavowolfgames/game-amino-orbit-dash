# One content pack

## When

Open this recipe when you add levels, questions, cards, categories, or anything that should change between editions without a code change.

## Do

Content ships as a Game Pack. The template already has the code. Change the level shape and the bundled pack; do not write a new loader.

The schemas are `blocks` and `levels`. A `blocks` entry is a run of levels: `{ id, name, order, levels: [<level key>, ...] }`. Blocks play by `order`, levels in list order. A `levels` entry is one level, keyed `<block id>-<n>`. There is no `pack` schema. Both live under `schemas/`, and `docs/recipes/game-packs.md` has the full model.

Gameplay reads a level with `levelAt(n)` from `src/game/content`. Screens read `getActivePack()` from the same module. Nothing imports a pack JSON directly.

To change what a level holds:

1. Edit `LevelsDef` in `schemas/levels/schema.ts` and bump the schema's `version`.
2. Update the defaults and `parseLevel` in `src/game/content/level.ts`.
3. Rewrite the bundled pack `src/game/content/packs/default.json`. The game boots on it when nothing is published, and when a fetch fails.

A level with more than one part (cards, narrative) gets a sibling schema keyed like `levels` and a line in `src/game/content/assemble.ts`. Values shared by a run of levels (a name, a theme) go on the block, not on every level.

Words, questions, card layout, and level numbers belong in the pack. Systems, input, and scoring rules stay in code. Use string ids for anything registered as Dynamic Data.

The look is separate from the content. Any edition can wear any partner's brand. See `.agents/recipes/reskin.md`. Fetching and publishing are in `.agents/recipes/dynamic-data.md`.

## Verify

`bun run test:run` passes, including `tests/unit/content/content-load.test.ts` and `tests/unit/content/schemas.test.ts`.

`bun run decompose:content src/game/content/packs/default.json local/content-packs/default` splits the pack into entries, checks each one against its schema, and proves the round trip.

`bun run typecheck:baseline` passes.

## Example

`src/game/content/packs/edition-2026-10-08.json` is a second authored pack: one block of two levels, published as a dated edition. `src/game/mygame/screens/gameController.ts` reads levels through `levelAt` and `isLastLevel`.
