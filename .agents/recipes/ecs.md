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
- **Replace a whole board in one transaction** (clear and rebuild). For an entity board, delete every entity of the archetype, then insert the new state. Pure rule code can work on a plain array copy (a reader such as `readPieces(db)` next to the plugin), as long as the result is written back as entities. An array board is replaced by assigning a new array.
- **Entity ids are reused.** A deleted entity's id comes back for the next insert, often as another kind. A renderer that keeps a view per entity id must treat an id whose kind changed, or a new run (a `runId` resource bumped by the start transaction), as a new entity and rebuild its view.
- Plugin property order is fixed: `extends`, `services`, `components`, `resources`, `archetypes`, `computed`, `transactions`, `actions`, `systems`.

### Pick the cadence from the game

- **Turn-based** (the board changes when the player acts, then waits): call a plain turn function from input. It reads state, runs pure rules, writes through transactions, and returns animation metadata. No frame loop, no `stepWorld`.
- **Real-time** (things move with no input, like falling pieces): systems in `src/game/mygame/sim/systems/` run every fixed step (`stepWorld` in `src/game/mygame/sim/schedule.ts`, driven by `startFixedStepLoop` in `src/game/mygame/engine/fixedStep.ts`). The controller already runs this loop. Input is an intent resource (a queue such as `pendingSwipes`) that the first system drains on the next step; `src/game/mygame/input/README.md` shows it.

The world in `src/game/mygame/sim/plugin.ts` holds the run (level, goal, score, phase, time, rng, the event queue) and one example move, `tap` (a point per tap, win at the goal). Replace `tap` with the game's moves; `src/game/mygame/sim/README.md` shows how.

### Report what happened as events

Sound, the screen-reader line, HUD flashes and one-shot effects react to events, not to counters diffed frame to frame. Declare each event in the `GameEvent` map in `plugin.ts`, call `emit(store, { type: 'hit', ... })` inside the transaction that makes it happen, and give it a row in the controller's cue table. `src/game/mygame/sim/events.ts` holds the queue (bounded, drained once a frame with `drainEvents(db)`); `src/game/mygame/screens/README.md` shows the cue table.

Inside a transaction or a system, do not import Pixi, read the DOM, or call `Math.random` or `Date.now`. Pass a seeded rng in, or keep its state in a resource. `src/game/mygame/sim/rng.ts` is the seeded generator; its state is the `rng` resource.

Do not edit `src/core/`.

### Known foot-guns

- **Only committed transactions notify observers.** A direct write on `db.store` does not, so anything a HUD or screen reacts to (`score`, `phase`) changes through `db.transactions`.
- **Deleting from a live selection skips entities**, because the table fills the hole with its last row. Spread first (`for (const e of [...store.select(['velocity'])]) store.delete(e)`) or collect ids, then delete. A collision system decides from a snapshot, then applies transactions.
- **A screen reads, never keeps a copy.** Read `getGameWorld().resources.score`, or `db.observe.resources.score(cb)` and call the returned unobserve in teardown. A Solid signal may mirror an observable for JSX; game logic never writes it. A derived value is a `computed` on the plugin, not recomputed in the view.
- **Schema types:** numbers use `F32`, `I32` or `Vec2` from `~/core/systems/ecs` (`I32` when a value can go negative, even for a moment). Strings and booleans use an inline schema with `as const`. A nullable field needs `Schema.Nullable(schema)` from `@adobe/data/schema`; a bare `nullable: true` is ignored.
- **External physics** is one per-frame system, not a second source of truth: push ECS changes into the engine, step it with the fixed `dt`, write positions back through a transaction.
- **Stays out of ECS:** tween targets and particle lifetimes (GSAP owns them), and level content (the pack, read through `getActivePack()`; `.agents/recipes/dynamic-data.md`).

## Verify

Add a unit test that calls the transaction or the turn function and asserts the entities or resource you changed, and the events it emitted (`drainEvents(db)`).

Run `bun run test:run` and `bun run typecheck:baseline`.

## Example

`getGameWorld` is `src/game/mygame/world.ts`. The plugin is `src/game/mygame/sim/plugin.ts`, `stepWorld` is `src/game/mygame/sim/schedule.ts`, and systems register in `src/game/mygame/sim/systems/index.ts`. The fixed step is `src/game/mygame/engine/fixedStep.ts`. A system and an archetype are shown in `src/game/mygame/sim/systems/README.md` and `src/game/mygame/sim/README.md`.
