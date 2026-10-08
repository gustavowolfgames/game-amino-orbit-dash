# One content pack

## When

Open this recipe when you add levels, questions, cards, categories, or anything that should change between editions without a code change.

## Do

The pack schema is `schemas/pack.ts`. The game-specific level shape (e.g. `TapClearLevel` for a tap-to-clear game) extends it in the same file. Validated with arktype before the game reads it.

Ship a bundled default pack as `examples/pack.example.json` adapted to the game, imported from a module like `src/game/mygame/defaultPack.ts`. The game boots on that pack when DynamicData is missing. See `.agents/recipes/dynamic-data.md` for the fetch.

Screens call `getActivePack()`. They do not import a level file on their own.

Words, questions, card layout, and brand id belong in the pack. Systems, input, and scoring rules stay in code.

Use string ids for fields that will be registered as DynamicData. A small numeric union can arrive from the backend as a plain `number`.

The pack's `brand` field carries the active skin — see `.agents/recipes/reskin.md`. Changing a partner skin is a brand JSON edit + a pack publish; it does not touch systems.

The Stacks pack is one object with an id, a thumbnail, an art style, and level blocks. Off the Record's true-crime pack is one object with an id, narrative, and tiers of questions that each have four answers. Copy that shape. Do not copy either game's Solid state.

## Verify

A unit test loads the bundled pack, runs validation, and reads one field through `getActivePack()`.

`bun run typecheck:baseline` passes.

## Example

The access rule is `getActivePack()`, once it exists. Until then, read the bundled default pack through one module (for example `src/game/mygame/defaultPack.ts`, which you create) rather than importing the JSON from several places.
