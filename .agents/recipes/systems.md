# Use @wolfgames/game-systems

## When

This recipe loads every turn while the `systems` toggle is on (`package.json` → `agentSurface.systems`). It applies before you write a new ECS plugin, a grid board, a cascade, scoring, stars, moves, undo, a spawner, physics, collision, or other sim-side logic.

## Do

Read the catalog first: `node_modules/@wolfgames/game-systems/src/INDEX.md` (human), `node_modules/@wolfgames/game-systems/src/catalog.json` (machine), and `node_modules/@wolfgames/game-systems/docs/COOKBOOK.md` ("to build genre X, compose A + B + C").

Import a system or helper the catalog already provides, for example `import { cascadePlugin } from '@wolfgames/game-systems/systems/cascade'`. Hand-roll only when no entry fits, and name the entries you considered in a one-line comment above the new code.

Typical picks:

- Grid puzzles and match-3: `systems/gridBoard`, `systems/cascade`, `systems/scoreCombo`, `systems/moveCounter`, `systems/stars`, `systems/objective`, `systems/levels`, `systems/shuffle`, `logic/match`.
- Physics and action: `systems/physics` (matter.js), `systems/collision`, `systems/health`, `systems/lifetime`, `systems/spawner`, `logic/raycast`.
- Any game: `logic/rng` (seeded), `logic/vec2`, `logic/pool`.

The rules in `.agents/recipes/ecs.md` still hold: ECS is the source of truth, state changes only in transactions, entities for things with identity, one array for a fixed board.

## Verify

`bun run typecheck:baseline` passes. Each import resolves from `@wolfgames/game-systems`, not a copy in the repo.

## Example

Benchmarks so far (aminoBench, ENG-4702/4704): agents that use the catalog reuse real modules, but the catalog reading costs turns. Keep it off unless the game overlaps the catalog heavily.
