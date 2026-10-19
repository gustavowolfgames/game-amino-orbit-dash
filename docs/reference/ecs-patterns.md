# ECS patterns

Patterns for the `@adobe/data` world behind `getGameWorld()`. The rules are `.agents/recipes/ecs.md`. The world's resources, transactions, and invariants are `src/game/mygame/sim/README.md`. This page covers what those two do not.

## Plugin key order

`Database.Plugin.create` throws when keys are out of order. The order is `imports`, `extends`, `services`, `components`, `resources`, `archetypes`, `indexes`, `computed`, `transactions`, `actions`, `systems`. Skip the keys you do not use. Keep the order of the rest.

## Reading from a screen

A screen reads the world. It never writes a second copy.

- Direct read: `getGameWorld().resources.score`. `src/game/screens/ResultsScreen.tsx` does this after the game screen unmounts.
- Reactive read: `db.observe.resources.score(cb)` returns an unobserve function. Call it in teardown.
- A Solid signal may mirror an observable for JSX. The signal is display only. Game logic never writes it.

## Input as intent

A real-time game queues input and resolves it on the fixed step. In the template, a tap calls `db.transactions.submitTap({ x, y })` (`src/game/mygame/input/pointer.ts`), which appends to the `pendingTaps` resource. Next step, a tap system reads the queue, calls a transaction per tap, then `clearTaps` (`src/game/mygame/sim/systems/README.md`). Input stays on the deterministic timeline, so `stepWorld` replays in a test.

A turn-based game skips the queue. The input handler calls a turn function directly and no frame loop runs. See the cadence section of `.agents/recipes/ecs.md`.

## Turn functions

A turn function reads a snapshot, runs a pure rule, writes through transactions, and returns metadata for the view to animate.

```ts
export function applyMove(db: GameDatabase, move: Move) {
  const before = readStateFromEcs(db);
  const ruling = evaluateMove(before, move); // pure
  if (!ruling.valid) return ruling;
  db.transactions.commitMove(ruling);
  return ruling; // the controller animates from this
}
```

Export it as a plain function, not an entry in the plugin's `actions` block. The `actions` generic is unconstrained, so outside callers get no argument or return types. Transactions called inside stay typed. `readStateFromEcs` in `src/game/mygame/sim/readStateFromEcs.ts` is the snapshot pattern.

Agents and bots drive the same path. `src/game/mygame/agent/agentPlugin.ts` extends the game plugin with an `AgenticService` whose `tap` and `start` actions call `submitTap` and `startRun`.

## Whole-snapshot reducer

Games whose rules are already a pure reducer over one immutable snapshot, often with undo, can keep that snapshot in one resource. A transaction reads it, runs the reducer, commits the result, and reprojects entities. An illegal move returns the same object, so `after === before` detects a no-op. Undo is a stack of past snapshots.

## Computed values

A computed value updates when its inputs change. The sample derives `finished` from `phase`.

```ts
computed: {
  finished: (db) => Observe.withMap(db.observe.resources.phase, (p) => p === 'won' || p === 'lost'),
},
```

A screen that needs a derived value reads the computed observable. Do not recompute it in the view.

## Observable writes and hot paths

Only committed transactions notify observers. A direct column write on `db.store` does not. Route anything a HUD or screen reacts to, such as `score`, `phase`, or `chainCount`, through `db.transactions.*`. Direct column writes are for per-entity work every frame that nothing observes. The sample integrates through transactions (`advanceChain`, `advanceProjectiles`). Switch only when a profile shows the transaction cost matters.

## Deleting while iterating

Deleting from a live selection skips entities, because the table fills the hole with its last row.

- Spread first: `for (const e of [...store.select(['velocity'])]) store.delete(e)`. `startLevel` does this.
- Or collect ids, then delete. `popRange` does this.
- A transaction called mid-scan can move rows too. A collision system decides from a snapshot, then applies transactions.

## System order

`SYSTEM_ORDER` in `src/game/mygame/sim/systems/index.ts` is a flat list, empty until the game adds its systems, for example `systemTaps`, `systemMove`, `systemCollide`, `systemGoal`. Order is the contract: collision runs after movement so it sees positions written this step. When the graph branches, `@adobe/data` systems can declare `schedule: { before, after }` instead.

## External physics

A physics engine is one per-frame system, not a second source of truth. Each step: push pending ECS changes into the engine, step it with the fixed `dt`, then write body positions and angles back through a transaction.

## Schema details

- Numbers use `F32`, `I32`, or `Vec2` from `~/core/systems/ecs`. Use `I32` when a value can go negative, even for a moment.
- Strings and booleans use an inline schema with `as const`, like `spriteKey: { type: 'string', default: '' } as const`.
- A nullable field needs `Schema.Nullable(schema)` from `@adobe/data/schema`. A bare `nullable: true` is ignored.
- Give entities a `spriteKey`. The Inspector names entities from `spriteKey`, `key`, or `name`.
- Randomness is seeded. The sample keeps LCG state in the `rng` resource and advances it inside transactions.

## What stays out of ECS

- Tween targets and particle lifetimes. GSAP and the particle runtime own them.
- Level and content config. It lives in the content pack from `.agents/recipes/content.md` and is read through `getActivePack()` once that exists. It never lives in a Solid signal or store.

## Converting a signals game

For an older game that keeps rules in Solid:

1. Copy `src/game/mygame/sim/`, `src/game/mygame/world.ts`, and the `@adobe/data` dependency.
2. Mirror board state as entities and check them in the Inspector.
3. Move score, level, and phase from signals to resources.
4. Wrap turn logic in turn functions over transactions.
5. Point screens at the world and delete the signals.
6. If state changes with no input, add systems and the fixed-step loop.

Each step ships on its own.
