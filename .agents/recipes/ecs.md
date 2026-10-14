# Gameplay state in ECS

## When

Open this recipe when you add or change gameplay state, entities, a turn, a score, a timer that changes rules, or a per-frame system.

## Do

Read and write gameplay state through `getGameWorld()` in `src/game/mygame/world.ts`. It is the one world, app-scoped, already wired to the Inspector with `setActiveDb`.

Write state only inside `db.transactions`. A DOM screen may read the world to render. It does not keep a second copy of the rules in a signal or a store.

### Model the world as entities

- **Things on the board are entities.** A grid cell, a falling piece's blocks, a body, a projectile: each is a row in an archetype with its own components (`col`, `row`, `color`, ...) and a `spriteKey`, so the Inspector can name it. Do not keep the board as one array or matrix inside a resource.
- **Resources are global values only:** score, phase, level, moves or lines left, the rng state, the active piece's pose.
- **Replace a whole board in one transaction** (clear and rebuild): delete every entity of the archetype, then insert the new state. Pure rule code can work on a plain array copy (`readStateFromEcs`), as long as the result is written back as entities.
- **Entity ids are reused.** A deleted entity's id comes back for the next insert, often as another kind. A renderer that keeps a view per entity id must treat an id whose kind changed, or a new run (a `runId` resource bumped by the start transaction), as a new entity and rebuild its view.
- Plugin property order is fixed: `extends`, `services`, `components`, `resources`, `archetypes`, `computed`, `transactions`, `actions`, `systems`.

### Pick the cadence from the game

- **Turn-based** (the board changes when the player acts, then waits): call a plain turn function from input. It reads state, runs pure rules, writes through transactions, and returns animation metadata. No frame loop, no `stepWorld`.
- **Real-time** (things move with no input, like falling pieces): call `stepWorld` from `src/game/mygame/ecs/schedule.ts` through `startFixedStepLoop` in `src/game/mygame/engine/fixedStep.ts`. Pass a constant `dt`, never the raw frame delta. Input is an intent resource that `systemInput` drains on the next step.

The sample (`src/game/mygame/ecs/README.md`) is real-time: orbiting and drifting orbs. Replace it, don't build next to it; see `.agents/recipes/new-game.md`.

Inside a transaction or a system, do not import Pixi, read the DOM, or call `Math.random` or `Date.now`. Pass a seeded rng in, or keep its state in a resource. `src/game/mygame/demo/rng.ts` is a seeded generator you can keep.

Do not edit `src/core/`. Plugin shape, computed values, and the known foot-guns are in `docs/reference/ecs-patterns.md`.

## Verify

Add a unit test that calls the transaction or the turn function and asserts the entities or resource you changed.

Run `bun run test:run` and `bun run typecheck:baseline`.

## Example

`getGameWorld` is `src/game/mygame/world.ts`. `stepWorld` is `src/game/mygame/ecs/schedule.ts`. The fixed step is `src/game/mygame/engine/fixedStep.ts`. The sample's archetypes (`Orbiter`, `Mover`) in `src/game/mygame/ecs/gamePlugin.ts` show the entity shape to copy, then delete.
