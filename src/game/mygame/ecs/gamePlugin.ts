/**
 * gamePlugin — the minimal ECS demo world (@adobe/data).
 *
 * A deliberately tiny, swap-me sandbox that proves the pure-ECS architecture end
 * to end: two per-frame systems integrating bodies with no input, plus input on
 * the deterministic timeline.
 *
 *   • Orbiter — a collectible orb circling the centre (systemOrbit advances its
 *     angle each fixed step; position is derived from angle + radius).
 *   • Mover   — an orb drifting with a velocity, bouncing off the design box
 *     walls (systemMovement). Spawned by taps; purely demonstrates spawn+move.
 *
 * Tap to collect the nearest orbiter (input as intent → `pendingTaps` →
 * `systemInput` drains next step). Every tap also spawns a mover, so a tap always
 * shows spawn+move even on a miss. Collect all orbiters to win.
 *
 * ECS is the **source of truth** (guardrail: game state lives in ECS, not
 * signals). This is a **real-time** game — the orbiters and movers advance every
 * frame — so it runs the per-frame schedule (`schedule.ts` → `SYSTEM_ORDER`)
 * driven by a fixed-timestep loop. All state changes go through transactions.
 * Determinism holds: `dt` and input arrive as injected resources, and randomness
 * comes from a seeded LCG in the `rng` resource — never `Math.random()`/`Date.now()`.
 *
 * Plugin property order is runtime-enforced:
 *   extends → services → components → resources → archetypes → computed →
 *   transactions → actions → systems
 *
 * Two entity kinds, selected disjointly:
 *   • Orbiter — has `angle` (Mover does not).
 *   • Mover   — has `velocity` (Orbiter does not).
 * Both carry `position`/`color`/`spriteKey`, so never select on those alone.
 */

import { Database, type Entity, F32, I32, Observe, Vec2 } from '~/core/systems/ecs';
import {
  CENTER,
  DESIGN_H,
  DESIGN_W,
  MAX_MOVERS,
  MOVER_SPEED,
  ORB_RADIUS,
  ORBIT_RADIUS,
  ORBIT_SPEED,
  PALETTE_SIZE,
  POINTS_PER_COLLECT,
} from '../demo/config';
import { nextAngle, nextRng, rngFloat } from '../demo/rng';

/** Lifecycle of a run. */
export type GamePhase = 'idle' | 'playing' | 'won';

/** A queued tap awaiting the input system (input as intent). Design-space point. */
export interface TapIntent {
  x: number;
  y: number;
}

/** Derive an orbiter's design-space position from its angle + ring radius. */
function orbiterPos(angle: number, radius: number): [number, number] {
  return [CENTER[0] + Math.cos(angle) * radius, CENTER[1] + Math.sin(angle) * radius];
}

// ── Plugin ────────────────────────────────────────────────────────────────

export const gamePlugin = Database.Plugin.create({
  components: {
    /** Colour index (0…PALETTE_SIZE-1); the renderer maps it to a theme colour. Both kinds. */
    color: I32.schema,
    /** Design-space anchor the renderer reads. Both kinds. */
    position: Vec2.schema,
    /** Linear velocity (design px/sec). Mover only — the selector. */
    velocity: Vec2.schema,
    /** Current orbit angle (radians). Orbiter only — the selector. */
    angle: F32.schema,
    /** Orbit ring radius (design px). Orbiter only. */
    orbitRadius: F32.schema,
    /** Angular speed (radians/sec). Orbiter only. */
    orbitSpeed: F32.schema,
    /** Inspector display name (getEntityName reads spriteKey/key/name). */
    spriteKey: { type: 'string', default: '' } as const,
  },
  resources: {
    /** Current level index (0-based) into the active Content Pack (src/game/content). */
    level: { default: 0 as number },
    /** Id of the Content Pack the current run's level came from ('' before the first run). */
    packId: { default: '' as string },
    score: { default: 0 as number },
    phase: { default: 'idle' as GamePhase },
    /** Orbiters left to collect (win when it hits 0). */
    remaining: { default: 0 as number },

    // ── Determinism seam ──────────────────────────────────────────────────
    /** Total run time (ms), accumulated one fixed step at a time. */
    elapsedMs: { default: 0 as number },
    /** Last step's delta (ms) — the injected fixed `dt` systems integrate. */
    frameDeltaMs: { default: 0 as number },
    /** Seeded PRNG state (LCG). Advanced by transactions, never Math.random(). */
    rng: { default: 0 as number },

    /**
     * Queued taps awaiting the input system (input as intent). A FIFO queue, not
     * a single slot, so every tap in a frame is preserved and drained next step.
     */
    pendingTaps: { default: [] as TapIntent[] },
  },
  archetypes: {
    /** A collectible orb circling the centre. Selected by `angle`. */
    Orbiter: ['angle', 'orbitRadius', 'orbitSpeed', 'color', 'position', 'spriteKey'],
    /** A drifting orb that bounces off the walls. Selected by `velocity`. */
    Mover: ['velocity', 'color', 'position', 'spriteKey'],
  },
  computed: {
    /** Reactive "is the run over" flag — handy for the Inspector / agents. */
    finished: (db) => Observe.withMap(db.observe.resources.phase, (p) => p === 'won'),
  },
  transactions: {
    /**
     * Start a run: clear the board, seed the RNG, and ring the centre with
     * `orbiterCount` evenly-spaced collectible orbiters. The level's numbers come
     * from the Content Pack (`levelAt`, src/game/content) — the sim never reads the
     * pack itself; ring radius/speed default to the demo constants. Deterministic —
     * colours follow from the index, not the RNG, so the same level always looks
     * the same.
     */
    startDemo(
      store,
      {
        orbiterCount,
        seed,
        orbitRadius = ORBIT_RADIUS,
        orbitSpeed = ORBIT_SPEED,
        level = 0,
        packId = '',
      }: {
        orbiterCount: number;
        seed: number;
        orbitRadius?: number;
        orbitSpeed?: number;
        level?: number;
        packId?: string;
      },
    ) {
      // Clear-and-rebuild: spread before delete (deleting while iterating a live
      // selection skips entities).
      for (const e of [...store.select(['angle'])]) store.delete(e); // orbiters
      for (const e of [...store.select(['velocity'])]) store.delete(e); // movers

      store.resources.level = level;
      store.resources.packId = packId;
      store.resources.score = 0;
      store.resources.phase = 'playing';
      store.resources.remaining = orbiterCount;
      store.resources.elapsedMs = 0;
      store.resources.frameDeltaMs = 0;
      store.resources.rng = seed >>> 0;
      store.resources.pendingTaps = [];

      for (let i = 0; i < orbiterCount; i++) {
        const angle = (i / orbiterCount) * Math.PI * 2;
        const color = i % PALETTE_SIZE;
        store.archetypes.Orbiter.insert({
          angle,
          orbitRadius,
          orbitSpeed,
          color,
          position: orbiterPos(angle, orbitRadius),
          spriteKey: `orbiter-${color}`,
        });
      }
    },

    /** Advance every orbiter one fixed step and re-derive its position. */
    advanceOrbiters(store, { dtSec }: { dtSec: number }) {
      if (store.resources.phase !== 'playing') return;
      for (const e of store.select(['angle'])) {
        const o = store.read(e) as { angle: number; orbitRadius: number; orbitSpeed: number } | null;
        if (!o) continue;
        const angle = o.angle + o.orbitSpeed * dtSec;
        store.update(e, { angle, position: orbiterPos(angle, o.orbitRadius) });
      }
    },

    /** Integrate every mover one fixed step, bouncing off the design-box walls. */
    advanceMovers(store, { dtSec }: { dtSec: number }) {
      const minX = ORB_RADIUS;
      const maxX = DESIGN_W - ORB_RADIUS;
      const minY = ORB_RADIUS;
      const maxY = DESIGN_H - ORB_RADIUS;
      for (const e of store.select(['velocity'])) {
        const m = store.read(e) as {
          position: [number, number];
          velocity: [number, number];
        } | null;
        if (!m) continue;
        let [x, y] = [m.position[0] + m.velocity[0] * dtSec, m.position[1] + m.velocity[1] * dtSec];
        let [vx, vy] = m.velocity;
        if (x < minX) { x = minX; vx = -vx; }
        else if (x > maxX) { x = maxX; vx = -vx; }
        if (y < minY) { y = minY; vy = -vy; }
        else if (y > maxY) { y = maxY; vy = -vy; }
        store.update(e, { position: [x, y], velocity: [vx, vy] });
      }
    },

    /** Enqueue a tap for the input system to resolve next step (input as intent). */
    submitTap(store, { x, y }: TapIntent) {
      store.resources.pendingTaps = [...store.resources.pendingTaps, { x, y }];
    },
    /** Drop every queued tap (drained by the input system). */
    clearTaps(store) {
      store.resources.pendingTaps = [];
    },

    /**
     * Spawn a mover at (x, y) flying off in a seeded-random direction. Draws both
     * the launch angle and the colour from the `rng` resource (never
     * Math.random), and recycles the oldest mover once MAX_MOVERS is reached so
     * the entity count stays bounded.
     */
    spawnMoverSeeded(store, { x, y }: { x: number; y: number }) {
      const movers = [...store.select(['velocity'])];
      if (movers.length >= MAX_MOVERS) store.delete(movers[0]); // recycle oldest

      const drawA = nextAngle(store.resources.rng);
      const drawC = nextRng(drawA.state);
      store.resources.rng = drawC;
      const color = Math.floor(rngFloat(drawC) * PALETTE_SIZE) % PALETTE_SIZE;
      store.archetypes.Mover.insert({
        color,
        position: [x, y],
        velocity: [Math.cos(drawA.angle) * MOVER_SPEED, Math.sin(drawA.angle) * MOVER_SPEED],
        spriteKey: `mover-${color}`,
      });
    },

    /** Collect an orbiter: remove it, score, and win when the ring is empty. */
    collectOrbiter(store, { entity }: { entity: Entity }) {
      store.delete(entity);
      store.resources.score += POINTS_PER_COLLECT;
      store.resources.remaining = Math.max(0, store.resources.remaining - 1);
      if (store.resources.remaining === 0 && store.resources.phase === 'playing') {
        store.resources.phase = 'won';
      }
    },

    /** Set the run phase. */
    setPhase(store, phase: GamePhase) {
      store.resources.phase = phase;
    },

    /** Inject one fixed step's time. `dt` comes from the loop, never Date.now(). */
    advanceTime(store, { dt }: { dt: number }) {
      store.resources.frameDeltaMs = dt;
      store.resources.elapsedMs += dt;
    },
  },
  systems: {
    // Init-only, no-op: consumers call `startDemo` explicitly so the world is
    // populated identically in game and in tests. The per-frame schedule lives
    // in `schedule.ts` (`stepWorld`), driven by the engine's fixed-step loop.
    game_initialize: {
      create: () => {},
    },
  },
});

export type GamePlugin = typeof gamePlugin;
export type GameDatabase = Database.Plugin.ToDatabase<GamePlugin>;
export type GameStore = Database.Plugin.ToStore<GamePlugin>;

/** Create a fresh game ECS world (base plugin, no agent service). */
export function createGameWorld(): GameDatabase {
  return Database.create(gamePlugin) as GameDatabase;
}
