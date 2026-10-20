# Gameplay state in ECS

## When

Open this recipe when you add or change gameplay state, entities, a turn, a score, a timer that changes rules, or a per-frame system.

## Do

Read and write gameplay state through `getGameWorld()` in `src/game/mygame/world.ts`. It is the one world, app-scoped, already wired to the Inspector with `setActiveDb`.

Write state only inside `db.transactions`. A DOM screen may read the world to render. It does not keep a second copy of the rules in a signal or a store.

### Model the world: entities, or one array for a fixed board

- **Things with identity are entities.** A falling piece's blocks, a match-3 gem, a card, a body, a projectile: anything that keeps its identity as it moves, or appears and clears during play, is a row in an archetype with its own components (`col`, `row`, `color`, ...) and a `spriteKey`, so the Inspector can name it.
- **A fixed board is an array.** When the squares never move and only their value changes (sudoku, wordle, a crossword, minesweeper), keep the board as one dense array in a resource, indexed by `row * cols + col`. Rules read it as is. One entity per square would add an index component and a copy out and back on every move, and a turn-based board gets nothing for it. The cost is that the Inspector shows the board as one resource, not a row per square. Move a per-square fact onto rows only when the game needs to query it.
- **Other resources are global values only:** score, phase, level, moves or lines left, the rng state, the active piece's pose.
- **Replace a whole board in one transaction** (clear and rebuild). For an entity board, delete every entity of the archetype, then insert the new state. Pure rule code can work on a plain array copy (`readStateFromEcs`), as long as the result is written back as entities. An array board is replaced by assigning a new array.
- **Entity ids are reused.** A deleted entity's id comes back for the next insert, often as another kind. A renderer that keeps a view per entity id must treat an id whose kind changed, or a new run (a `runId` resource bumped by the start transaction), as a new entity and rebuild its view.
- Plugin property order is fixed: `extends`, `services`, `components`, `resources`, `archetypes`, `computed`, `transactions`, `actions`, `systems`.

### Pick the cadence from the game

- **Turn-based** (the board changes when the player acts, then waits): call a plain turn function from input. It reads state, runs pure rules, writes through transactions, and returns animation metadata. No frame loop, no `stepWorld`.
- **Real-time** (things move with no input, like falling pieces): systems in `src/game/mygame/sim/systems/` run every fixed step (`stepWorld` in `src/game/mygame/sim/schedule.ts`, driven by `startFixedStepLoop` in `src/game/mygame/engine/fixedStep.ts`). The controller already runs this loop. Input is an intent resource (`pendingTaps`) that a system drains on the next step.

The world in `src/game/mygame/sim/plugin.ts` holds the run (level, goal, score, phase, time, rng, taps) and nothing else yet. Add the game to it; `src/game/mygame/sim/README.md` shows how.

Inside a transaction or a system, do not import Pixi, read the DOM, or call `Math.random` or `Date.now`. Pass a seeded rng in, or keep its state in a resource. `src/game/mygame/sim/rng.ts` is the seeded generator; its state is the `rng` resource.

Do not edit `src/core/`. Plugin shape, computed values, and the known foot-guns are in `docs/reference/ecs-patterns.md`.

## Verify

Add a unit test that calls the transaction or the turn function and asserts the entities or resource you changed.

Run `bun run test:run` and `bun run typecheck:baseline`.

## Example

`getGameWorld` is `src/game/mygame/world.ts`. The plugin is `src/game/mygame/sim/plugin.ts`, `stepWorld` is `src/game/mygame/sim/schedule.ts`, and systems register in `src/game/mygame/sim/systems/index.ts`. The fixed step is `src/game/mygame/engine/fixedStep.ts`. A system and an archetype are shown in `src/game/mygame/sim/systems/README.md` and `src/game/mygame/sim/README.md`.
