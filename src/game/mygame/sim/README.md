# sim: the game's state and rules (`@adobe/data` ECS)

Everything the game *is* lives here, with no Pixi and no DOM: the world's data
(`plugin.ts`), the systems that change it each step (`systems/`), pure rule
functions (`rules/`), the seeded random generator (`rng.ts`) and the event
queue (`events.ts`). Because nothing here draws or listens, the whole game runs
headless in a unit test.

```
 engine.onFrame(realDt) → startFixedStepLoop → stepWorld(db, FIXED_DT)
                                                │  advanceTime({dt}); run SYSTEM_ORDER
 ../input  tap → db.transactions.tap({x,y}) ───▶│
              ┌──────────────── ECS world (plugin.ts) ────────────────┐
 systems/ ───▶│ resources: level · packId · goal · score · phase       │
 rules/ (pure)│            elapsedMs · frameDeltaMs · rng · events     │
              │ entities:  the game's archetypes (pieces, bodies, …)   │
              └──────────────────────────┬────────────────────────────┘
        db.resources / db.select ───────▶ ../render, ../agent, tests
        drainEvents(db), once a frame ──▶ ../screens/cues.ts → sound, aria, HUD, views
```

`tap` in `plugin.ts` is the template's one example move (a point per tap, win
at the level's `goal`). Replace it with the game's own moves.

## Add to the world

A game adds its data to `plugin.ts`: components, an archetype per kind of thing,
and a transaction per change. Keep plugin property order (`components` →
`resources` → `archetypes` → `computed` → `transactions` → `systems`):

```ts
// in plugin.ts
components: {
  spriteKey: { type: 'string', default: '' } as const,
  position: Vec2.schema,          // import { Vec2 } from '~/core/systems/ecs'
},
archetypes: {
  Piece: ['position', 'spriteKey'],
},
transactions: {
  spawnPiece(store, { x, y }: { x: number; y: number }) {
    store.archetypes.Piece.insert({ position: [x, y], spriteKey: 'piece' });
  },
  clearPiece(store, { entity }: { entity: Entity }) {   // import { type Entity }
    const [x, y] = store.read(entity)?.position ?? [0, 0];
    store.delete(entity);
    store.resources.score += 10;
    emit(store, { type: 'cleared', x, y });               // see "Events" below
  },
},
```

Build the level's starting state inside `startRun`, after the reset. Read
entities with a plain function next to the plugin
(`readPieces(db) → { entity, x, y }[]`, using `db.select([...])`), and add a test
in `tests/unit/schedule.test.ts`.

## Events: tell the outside world what happened

Sound, the screen-reader line, HUD flashes and one-shot effects react to
**events**, never to a counter the controller diffs frame to frame. A
transaction calls `emit(store, event)`; the controller drains the queue once a
frame and runs it through its cue table (`../screens/README.md`).

1. Declare the event in the `GameEvent` map in `plugin.ts`:
   ```ts
   export type GameEvent = EventOf<{
     scored: { x: number; y: number; score: number };
     phase: { phase: GamePhase };
     cleared: { x: number; y: number };   // new
   }>;
   ```
2. Emit it inside a transaction: `emit(store, { type: 'cleared', x, y })`.
   The payload is type-checked against the map.
3. Give it a cue in the controller (sound, aria, `run` hook).

`events.ts` API:

| Export | What it does |
|--------|--------------|
| `EventOf<{ type: payload }>` | Builds the event union from a map. |
| `EventOfType<E, 'cleared'>` | One member of the union. |
| `emit(store, event)` | Appends inside a transaction. Bounded by `MAX_EVENTS` (256): past it the oldest is dropped and `eventsDropped` counts it. |
| `drainEvents(db)` | Returns every event since the last drain (oldest first) and empties the queue. Returns `NO_EVENTS` without writing when nothing happened. |

Events from several fixed steps in one frame pile up in order until the drain.
`startRun` clears the queue, and `setPhase` emits `phase` on every change.

## Rules that always hold

- **Write only through transactions.** Systems call transactions; nothing
  mutates a resource or entity directly.
- **Deterministic.** No `Math.random()` or `Date.now()`. Time comes from
  `frameDeltaMs`, randomness from the `rng` resource (`nextRng`, `rngFloat` in
  `rng.ts`). `stepWorld(db, FIXED_DT)` replays exactly.
- **One source of truth.** DOM screens read ECS (`getGameWorld().resources`);
  there is no second copy in signals.
- **Delete safely.** Spread a selection before deleting from it
  (`for (const e of [...store.select(['position'])]) store.delete(e)`).
- **The world outlives screens.** `../world.ts` owns it; the controller never
  creates or destroys it.
- **Fixed timestep.** The engine (`../engine/fixedStep.ts`) feeds `stepWorld` a
  constant `dt`, so 60 and 144 fps play the same game.

Plugin property order is enforced at runtime (wrong order throws).
