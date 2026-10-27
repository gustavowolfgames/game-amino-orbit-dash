# sim: the game's state and rules (`@adobe/data` ECS)

Everything the game *is* lives here, with no Pixi and no DOM: the world's data
and the moves on it (`plugin.ts`), plain reads of the board (`readBoard.ts`),
pure rule functions (`rules/`), the systems that change it each step
(`systems/`, empty for ball sort), the seeded random generator (`rng.ts`) and
the event queue (`events.ts`). Because nothing here draws or listens, the whole
game runs headless in a unit test.

```
 engine.onFrame(realDt) → startFixedStepLoop → stepWorld(db, FIXED_DT)
                                                │  advanceTime({dt}); run SYSTEM_ORDER (empty)
 ../input  tap → db.transactions.tap({x,y}) ───▶│  (tubeAt → tapTube)
 buttons, keys → undo / restartLevel / moveCursor / pressCursor
              ┌──────────────── ECS world (plugin.ts) ────────────────┐
 rules/ (pure)│ resources: level · packId · phase · seed · colors · par│
              │   moves · undosLeft · history · heldTube · cursor ·    │
              │   stuck · runMoves · runPar · runId · events · rng …   │
              │ entities:  Ball (tube, slot, color) · Tube (tubeIndex, │
              │            done)                                       │
              └──────────────────────────┬────────────────────────────┘
        readBoard / readBalls (readBoard.ts) ──▶ ../render, ../agent, tests
        drainEvents(db), once a frame ──▶ ../screens/cues.ts → sound, aria
```

A move: `tapTube` reads the board (`readBoard`), asks the rules
(`rules/ballSort.ts`: `canDrop`, `isTubeComplete`, `isWon`, `hasLegalMove`),
moves one Ball entity, pushes `history`, then `settle` marks done tubes and
sets `won` or `stuck`. Each step `emit`s an event.

## Add to the world

A game adds its data to `plugin.ts`: components, an archetype per kind of thing,
and a transaction per change. Keep plugin property order (`components` →
`resources` → `archetypes` → `computed` → `transactions` → `systems`):

```ts
// in plugin.ts
components: {
  locked: { type: 'boolean', default: false } as const,   // a ball that cannot move
},
archetypes: {
  Ball: ['ball', 'tube', 'slot', 'color', 'locked', 'spriteKey'],
},
transactions: {
  unlockTube(store, { tube }: { tube: number }) {
    for (const e of store.select(['ball', 'tube', 'locked'])) {
      if (store.read(e, ['tube'])?.tube === tube) store.update(e, { locked: false });
    }
    emit(store, { type: 'unlocked', tube });                // see "Events" below
  },
},
```

Build the level's starting state inside `startRun` (`buildBoard` here), after
the reset. Read entities with a plain function in `readBoard.ts`, and add a
test in `tests/unit/ballSort.test.ts`.

## Events: tell the outside world what happened

Sound, the screen-reader line, HUD flashes and one-shot effects react to
**events**, never to a counter the controller diffs frame to frame. A
transaction calls `emit(store, event)`; the controller drains the queue once a
frame and runs it through its cue table (`../screens/README.md`).

1. Declare the event in the `GameEvent` map in `plugin.ts`:
   ```ts
   export type GameEvent = EventOf<{
     moved: { from: number; to: number; moves: number };
     // …
     unlocked: { tube: number };   // new
   }>;
   ```
2. Emit it inside a transaction: `emit(store, { type: 'unlocked', tube })`.
   The payload is type-checked against the map.
3. Give it a cue in the controller (sound, aria, `run` hook).

`events.ts` API:

| Export | What it does |
|--------|--------------|
| `EventOf<{ type: payload }>` | Builds the event union from a map. |
| `EventOfType<E, 'moved'>` | One member of the union. |
| `emit(store, event)` | Appends inside a transaction. Bounded by `MAX_EVENTS` (256): past it the oldest is dropped and `eventsDropped` counts it. |
| `drainEvents(db)` | Returns every event since the last drain (oldest first) and empties the queue. Returns `NO_EVENTS` without writing when nothing happened. |

Events from several fixed steps in one frame pile up in order until the drain.
`startRun` clears the queue, and `setPhase` emits `phase` on every change.

## Rules that always hold

- **Write only through transactions.** Systems call transactions; nothing
  mutates a resource or entity directly.
- **Deterministic.** No `Math.random()` or `Date.now()`. Time comes from
  `frameDeltaMs`; a level comes from its seed (`generateBoard` runs its own
  copy of the LCG in `rng.ts`). `stepWorld(db, FIXED_DT)` replays exactly.
- **One source of truth.** DOM screens read ECS (`getGameWorld().resources`;
  the results screen reads `runMoves` and `runPar`); there is no second copy in
  signals.
- **Delete safely.** Spread a selection before deleting from it
  (`for (const e of [...store.select(['ball'])]) store.delete(e)`).
- **The world outlives screens.** `../world.ts` owns it; the controller never
  creates or destroys it.
- **Fixed timestep.** The engine (`../engine/fixedStep.ts`) feeds `stepWorld` a
  constant `dt`, so 60 and 144 fps play the same game.

Plugin property order is enforced at runtime (wrong order throws).
