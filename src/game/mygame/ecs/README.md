# mygame × Adobe ECS (`@adobe/data`)

The game's runtime state is an `@adobe/data` ECS database: observable,
Inspector-visible, agent-drivable, and headlessly testable. This is a
**minimal ECS demo** — a deliberately tiny, swap-me sandbox that proves the
pure-ECS architecture end to end so a new game can replace the rules without
rewiring the plumbing:

- **Orbiter** — a collectible orb circling the centre. `systemOrbit` advances its
  angle each fixed step; its position is derived from angle + ring radius.
- **Mover** — an orb drifting with a velocity, bouncing off the design-box walls
  (`systemMovement`). A tap spawns one, so a tap always shows spawn + move.

Tap to collect the nearest orbiter within reach (input as intent → `pendingTaps`
→ `systemInput` drains it next step). Collect every orbiter to win. Because the
orbiters and movers advance **every frame with no input**, this is a
**real-time** game: it runs the per-frame schedule, not the turn-based path.

```
 REAL-TIME (this game)
 engine.onFrame(realDt) → startFixedStepLoop → stepWorld(db, FIXED_DT)
                                                 │  advanceTime({dt}); run SYSTEM_ORDER
   pointer → submitTap({x,y})   ───────────────▶│  (systemInput drains pendingTaps → spawn + collect)
                ┌────────────────── @adobe/data ECS database ──────────────────┐
 pure systems   │  resources:  level · score · phase · remaining · elapsedMs   │
 (systems/*)    │              frameDeltaMs · rng · pendingTaps                 │
      ▲         │  entities:   Orbiter (angle, orbitRadius, orbitSpeed, color,  │
      │snapshot │                       position, spriteKey)                    │
      │         │              Mover   (velocity, color, position, spriteKey)   │
      │         │  transactions: startDemo · advanceOrbiters · advanceMovers ·  │
      │         │                submitTap · spawnMoverSeeded · collectOrbiter…│
 readStateFromEcs└────▲────────────────────────────┬───────────────────────────┘
      │               │                            │ db.observe.resources.* / .resources.*
 readOrbiters /       │                            ▼
 readMovers           │                       DOM screens read ECS directly
   (snapshots)        │                       setActiveDb(db)  → Inspector (dev)
```

The world is **app-scoped** (`world.ts` → `getGameWorld()`): it outlives any one
screen, so the results screen reads the final score straight from ECS. There is
no signals "clipboard" — ECS is the single source of truth.

## Cadence: real-time, fixed-timestep

The orbiters and movers advance continuously, so the engine clock drives
`stepWorld(db, dt)` each frame: it injects `dt` (`advanceTime`) then runs
`SYSTEM_ORDER`. Input is modelled as **intent** — the renderer queues a
`pendingTaps` entry (`submitTap`) that `systemInput` drains next step and
resolves (spawn a mover + collect the nearest orbiter), keeping input on the
deterministic timeline.

### Fixed timestep — feed the sim a constant `dt`

Continuous integration (orbit rotation, mover velocity, wall bounce) is only
stable and **deterministic** at a *fixed* `dt`. Don't pass raw frame deltas into
`stepWorld`. Accumulate real time and spend it in fixed steps — the classic "Fix
Your Timestep" accumulator, in `engine/fixedStep.ts`:

```ts
const engine = createTickerEngine();
const stopSim = startFixedStepLoop(engine, (dt) => stepWorld(db, dt));
const stopRender = engine.onFrame(() => render()); // paint latest ECS state
```

This decouples sim rate from framerate (60fps and 144fps agree), caps catch-up
after a stall (spiral-of-death guard), and keeps `stepWorld(db, FIXED_DT)`
replayable in a headless test — the same reason the whole sim stays testable
(see `tests/unit/schedule.test.ts`).

## The orbiter ring

`startDemo` rings the centre with `orbiterCount` evenly-spaced orbiters: orbiter
`i` starts at angle `i / orbiterCount · 2π` and colour `i % PALETTE_SIZE`, so the
ring is fully deterministic — the same count always looks the same. Each step
`advanceOrbiters` adds `orbitSpeed · dt` to every angle and re-derives position
from `CENTER + (cos, sin)·orbitRadius`. Position is always a pure function of
`angle` — the renderer just reads it.

## Tap → spawn + collect

A tap enqueues a `pendingTaps` intent. Next step `systemInput` drains the queue
and, per tap: (1) `spawnMoverSeeded` spawns a mover flying off from the tap point
(direction + colour drawn from the seeded `rng`, oldest recycled past
`MAX_MOVERS`), then (2) collects the nearest orbiter within `COLLECT_RADIUS` via
`collectOrbiter` (score `+POINTS_PER_COLLECT`, `remaining--`). Clearing the ring
(`remaining === 0`) wins. Movers are pure spectacle — they demonstrate spawn +
per-frame integration + wall bounce and never affect the win state.

## Files

| File | Role |
|------|------|
| `gamePlugin.ts` | The data model: components, resources, archetypes, computed, all transactions + `createGameWorld()`. |
| `readStateFromEcs.ts` | Structural adapter: `readOrbiters`, `readMovers`, and `readStateFromEcs` (full `GameSnapshot`) for systems, the renderer, and tests. |
| `schedule.ts` | `stepWorld(db, dt)` — the per-frame tick: inject `dt` via `advanceTime`, then run every system in `SYSTEM_ORDER`. |
| `systems/` | Per-frame systems (`db => void`) + `SYSTEM_ORDER`: `systemInput` → `systemMovement` → `systemOrbit`. |
| `../demo/` | Pure, framework-free sim constants (`config.ts`: design box, orb geometry, palette) and the seeded LCG (`rng.ts`). No Pixi. |
| `../engine/` | The engine seam: `EngineHandle` (`onFrame`/`destroy`), `createTickerEngine()` (gsap.ticker clock), and `startFixedStepLoop` / `planFixedSteps` (`fixedStep.ts`). Swap the clock for a Pixi/Three/Phaser one without touching the sim. |
| `../world.ts` | `getGameWorld()` — the app-scoped world singleton (owns `setActiveDb`). Screens and the controller read it; they never create/destroy it. |
| `agentPlugin.ts` | `gameAgentPlugin` + `createGameAgentWorld()` — an `AgenticService` exposing states (phase, score, remaining, orbiters) + the conditional `tap`/`start` actions for bots/tests/MCP. |

> `SYSTEM_ORDER` is a flat list — the simplest correct ordering, and all this
> game needs. Order is contract: `systemInput` runs first so the mover it spawns
> is integrated by `systemMovement` the same step. Plugin property order is
> runtime-enforced (wrong order throws): `extends` → `services` → `components` →
> `resources` → `archetypes` → `computed` → `transactions` → `actions` →
> `systems`.

## Invariants

- **Write only via transactions.** Nothing mutates entities or resources
  directly; systems compose transactions.
- **ONE source of truth: ECS.** No signals clipboard. DOM screens read ECS
  directly (`getGameWorld().resources.*` or a resource observable); game logic
  writes ECS via transactions. One copy, one write path.
- **Deterministic.** No `Math.random()` / `Date.now()` inside transactions or
  systems. `dt` and input arrive as injected resources (`frameDeltaMs`,
  `pendingTaps`), and direction/colour draws come from a seeded LCG held in the
  `rng` resource — so `stepWorld(db, FIXED_DT)` replays exactly.
- **Input as intent.** The renderer enqueues a `pendingTaps` entry (`submitTap`)
  rather than resolving directly; `systemInput` drains it next step.
- **Engine-agnostic sim.** The simulation never imports an engine. The clock
  enters through the `EngineHandle` seam (`engine/`); swap `createTickerEngine`
  for a Pixi/Three/Phaser clock without touching ECS. No raw
  `requestAnimationFrame` in game code.
- **Transactions are observable, direct `db.store` writes are not.** Route
  anything the HUD/DOM reacts to (score, phase, remaining) through
  `db.transactions.*`.
- **Spawn/despawn inside a system iterates archetype rows tail→head**, or spreads
  the selection before deleting (`[...store.select(...)]`) — deleting while
  iterating a live selection skips entities. `startDemo`/`spawnMoverSeeded` follow
  this.
- **World lifetime is app-scoped.** `world.ts` owns it and the Inspector binding;
  a screen unmount tears down the renderer but never the world.
- **Teardown order:** stop the frame loop (`stopSim`/`stopRender`) →
  `engine.destroy()` → kill GSAP tweens → renderer teardown →
  `setActiveInspectorActions([])`. `stepWorld` and the render callback must never
  fire into a destroyed renderer. The world persists.
