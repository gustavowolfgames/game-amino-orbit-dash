# Game Design — Your Game (ECS Pure template)

> Source of truth for the game's design. Agents read this before building.
>
> **This is a template, not a finished game.** What ships here is a *minimal ECS
> demo* — the smallest real-time loop that exercises the whole pure-ECS
> architecture (per-frame systems, fixed-timestep, input-as-intent, seeded RNG,
> agent surface, headless tests). Replace the loop below with your game; keep the
> plumbing. The canonical, framework-free rules + tuning live in
> [`src/game/mygame/demo/`](../src/game/mygame/demo/) (`config.ts`, `rng.ts`);
> the ECS model in [`src/game/mygame/ecs/`](../src/game/mygame/ecs/). If this doc
> and the code disagree, the code wins for exact numbers and this doc wins for the
> loop and intent.

## The Demo in One Sentence

A ring of collectible orbs circles the centre while stray orbs drift and bounce
off the walls — tap an orb to collect it (and fling a new drifter), and collect
the whole ring to win.

## Core Game Loop

```
A ring of orbs circles the centre; drifting orbs bounce off the walls (every frame)
        ↓
Tap / click anywhere
        ↓
A mover spawns at the tap point and flies off in a seeded-random direction
        ↓
The nearest orb within reach of the tap is collected (score +100) and pops
        ↓
Ring emptied  →  you win  →  hand off to the results screen
```

## Why this demo exists

It is intentionally trivial. Its job is to demonstrate, in the least code
possible, every seam a real game needs:

- **Two per-frame systems with no input** (`systemOrbit`, `systemMovement`) —
  proving the real-time schedule and fixed-timestep loop.
- **Input as intent** — a tap queues `pendingTaps`; `systemInput` drains it on the
  next fixed step. Input lives on the deterministic timeline, never off it.
- **Seeded determinism** — mover direction and colour come from an LCG in the
  `rng` resource; no `Math.random` / `Date.now`. The same seed + taps replay
  exactly (see `tests/unit/schedule.test.ts`).
- **ECS as the single source of truth** — score, phase, and the ring all live in
  ECS; the renderer and DOM screens are pure projections.
- **An agent surface** — `agentPlugin.ts` exposes the demo as observable states +
  conditional actions so bots/tests/MCP can drive it headlessly.

## Rules

- **The ring.** `ORBITER_COUNT` orbs are spaced evenly around a ring of radius
  `ORBIT_RADIUS` about the centre. Each advances by `ORBIT_SPEED · dt` radians per
  step; position is a pure function of angle + radius.
- **Movers.** Every tap spawns a drifter at the tap point, flying off at
  `MOVER_SPEED` in a seeded-random direction. Movers bounce off the design-box
  walls (velocity reflects at the edge). They are pure spectacle — they never
  affect the win state. Past `MAX_MOVERS` the oldest is recycled, so entity count
  stays bounded.
- **Collecting.** A tap collects the single nearest orbiter within
  `COLLECT_RADIUS` of the tap point, scoring `POINTS_PER_COLLECT`. A tap that
  reaches no orb still spawns a mover, so every tap does *something*.
- **Win.** Collect all `ORBITER_COUNT` orbiters (`remaining` hits 0) to win. The
  run ends and hands off to the results screen. There is no lose condition — this
  is a template demo, not a challenge.

## Tuning

The demo's numbers live in
[`demo/config.ts`](../src/game/mygame/demo/config.ts) — the design box, orb
geometry, ring size/speed, collect radius, mover speed/cap, points, and the
`COLORS` palette (colour index → tint). Change them there; both the sim and the
renderer read the same constants.

| Constant | Default | Meaning |
|---|---|---|
| `DESIGN_W × DESIGN_H` | 820 × 1480 | Fixed design box (portrait, contain-fit). |
| `ORBITER_COUNT` | 6 | Orbs in the ring at start = orbs to collect to win. |
| `ORBIT_RADIUS` | 300 | Ring radius about centre (design px). |
| `ORBIT_SPEED` | 0.6 | Ring angular speed (rad/s). |
| `COLLECT_RADIUS` | `ORB_RADIUS · 2.4` | Tap-to-orb collect distance. |
| `MOVER_SPEED` | 380 | Launch speed of a tapped mover (px/s). |
| `MAX_MOVERS` | 40 | Live-mover cap (oldest recycled). |
| `POINTS_PER_COLLECT` | 100 | Score per orb. |

## Screens & Flow

The template's four screens map cleanly onto the demo:

| Screen | What the player sees / does |
|---|---|
| Loading | Boot/brand chrome while assets warm up. |
| Start | Placeholder title card **YOUR GAME** and a play button. |
| Game | The orbiter ring, drifting movers, and a minimal HUD (score / orbs remaining). This is the whole demo. |
| Results | Final score (read straight from ECS) and a replay option. |

Valid screen IDs remain `loading`, `start`, `game`, `results`.

## Art Style Spec

**Current state: neutral placeholder art.** The template ships an abstract,
geometric placeholder set that reads as "swap me": a single neutral orb (tinted
per colour index), a calm game-field background, and a **YOUR GAME** title card +
round play button + title background. Every gameplay orb is the same `piece-orb`
sprite tinted by its colour index — replace it with one sprite per index (packed
into a `scene-*` atlas) when your art count grows.

Target look for the art pass: keep it simple, high-contrast, and readable, with
no text baked into gameplay sprites. Swapping art is a one-line texture change in
[`render/textures.ts`](../src/game/mygame/render/textures.ts) — the layout,
animation, and events are independent of the source.

## Assets Needed

Generate via the wolf-game-kit MCP, stage in `assets/src/`, and publish — see
[`local/rules/asset-pipeline.md`](../local/rules/asset-pipeline.md). Do not commit
game media to the repo (the committed placeholder `.webp` under
`src/game/mygame/assets/generated/` are the sanctioned template stand-ins, loaded
self-contained via Vite `?url`). Replace them with your game's art at the same
filenames.

| Asset (filename) | Type | Status | Notes |
|---|---|---|---|
| `piece-orb.webp` | sprite | placeholder | Neutral orb, tinted per colour index. One-per-index later → `scene-*` atlas. |
| `bg-game.webp` | image | placeholder | Full-bleed game-field background (cover-fit). |
| `ui-title.webp` | image | placeholder | Title wordmark ("YOUR GAME"). |
| `ui-button_play.webp` | image | placeholder | Round play button (self-contained glyph). |
| `bg-title.webp` | image | placeholder | Title / start-screen background. |
| `bg-splash.webp` | image | placeholder | Boot splash (pre-GPU, `boot-splash` bundle). |
| `sfx-pop`, `sfx-clear` | audio | placeholder | Collect + win SFX (optional; controller no-ops if missing). |

## Data Contract

- [`demo/config.ts`](../src/game/mygame/demo/config.ts) — design box, orb
  geometry, ring size/speed, `COLLECT_RADIUS`, `MOVER_SPEED`, `MAX_MOVERS`,
  `POINTS_PER_COLLECT`, and the `COLORS` palette (colour index → tint).
- [`demo/rng.ts`](../src/game/mygame/demo/rng.ts) — the seeded LCG (`nextRng`,
  `rngFloat`, `nextAngle`).
- ECS model, transactions, and systems — see
  [`src/game/mygame/ecs/README.md`](../src/game/mygame/ecs/README.md).

## Quality Bar

- **Instantly playable** — the ring is on screen and spinning, and a tap collects
  and spawns from the first interaction.
- **Deterministic** — same seed → same mover sequence, so runs are reproducible
  and headlessly testable (`tests/unit/schedule.test.ts`).
- **A clean starting point** — the value here is the *architecture*, not the game.
  When you build your game, delete the demo's rules (`demo/`, the systems, the
  transactions) and keep the seams (schedule, engine, world, agent surface,
  input-as-intent, fixed-timestep).
