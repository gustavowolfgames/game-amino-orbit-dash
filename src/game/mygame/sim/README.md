# sim: the game's state and rules (`@adobe/data` ECS)

Everything the game *is* lives here, with no Pixi and no DOM: the world's data
(`plugin.ts`), the systems that change it each step (`systems/`), pure rule
functions (`rules/`), the seeded random generator (`rng.ts`) and plain readers
for everyone else (`readStateFromEcs.ts`). Because nothing here draws or listens,
the whole game runs headless in a unit test.

```
 engine.onFrame(realDt) → startFixedStepLoop → stepWorld(db, FIXED_DT)
                                                │  advanceTime({dt}); run SYSTEM_ORDER
 ../input  tap → submitTap({x,y}) ─────────────▶│  a system drains pendingTaps
              ┌──────────────── ECS world (plugin.ts) ────────────────┐
 systems/ ───▶│ resources: level · packId · goal · score · phase       │
 rules/ (pure)│            elapsedMs · frameDeltaMs · rng · pendingTaps│
              │ entities:  the game's archetypes (pieces, cells, …)    │
              └──────────────────────────┬────────────────────────────┘
                 readStateFromEcs ──────▶ ../render, ../agent, tests
```

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
    store.delete(entity);
    store.resources.score += 10;
  },
},
```

Build the level's starting state inside `startRun`, after the reset. Then add a
reader per archetype in `readStateFromEcs.ts` and a test in
`tests/unit/schedule.test.ts`.

## Rules that always hold

- **Write only through transactions.** Systems call transactions; nothing
  mutates a resource or entity directly.
- **Deterministic.** No `Math.random()` or `Date.now()`. Time comes from
  `frameDeltaMs`, input from `pendingTaps`, randomness from the `rng` resource
  (`nextRng`, `rngFloat` in `rng.ts`). `stepWorld(db, FIXED_DT)` replays exactly.
- **One source of truth.** DOM screens read ECS (`getGameWorld().resources`);
  there is no second copy in signals.
- **Delete safely.** Spread a selection before deleting from it
  (`for (const e of [...store.select(['position'])]) store.delete(e)`).
- **The world outlives screens.** `../world.ts` owns it; the controller never
  creates or destroys it.
- **Fixed timestep.** The engine (`../engine/fixedStep.ts`) feeds `stepWorld` a
  constant `dt`, so 60 and 144 fps play the same game.

Plugin property order is enforced at runtime (wrong order throws).
