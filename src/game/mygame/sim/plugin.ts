/**
 * plugin — the ECS world the game is built on (@adobe/data).
 *
 * The core every game starts from: the run's lifecycle, the level it plays, the
 * determinism seam (injected time, seeded rng) and the input queue. It holds no
 * game yet. A game adds its own `components`, `archetypes` and `transactions`
 * here (see `./README.md`): pieces, cells and bodies are archetype entities with
 * a `spriteKey`; resources hold only global values.
 *
 * ECS is the **source of truth** (guardrail: game state lives in ECS, not
 * signals). All state changes go through transactions. Determinism holds: `dt`
 * and input arrive as injected resources, and randomness comes from the seeded
 * `rng` resource (`./rng.ts`), never `Math.random()`/`Date.now()`.
 *
 * Plugin property order is runtime-enforced:
 *   extends → services → components → resources → archetypes → computed →
 *   transactions → actions → systems
 */

import { Database, Observe } from '~/core/systems/ecs';

/** Lifecycle of a run. */
export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

/** A queued tap awaiting a system (input as intent). Design-space point. */
export interface TapIntent {
  x: number;
  y: number;
}

// ── Plugin ────────────────────────────────────────────────────────────────

export const gamePlugin = Database.Plugin.create({
  components: {
    /** Inspector display name (getEntityName reads spriteKey/key/name). */
    spriteKey: { type: 'string', default: '' } as const,
  },
  resources: {
    /** Current level index (0-based) into the active Content Pack (src/game/content). */
    level: { default: 0 as number },
    /** Id of the Content Pack the current run's level came from ('' before the first run). */
    packId: { default: '' as string },
    /** The level's target (its `goal`; 0 = the game sets none). What it counts is the game's call. */
    goal: { default: 0 as number },
    score: { default: 0 as number },
    phase: { default: 'idle' as GamePhase },

    // ── Determinism seam ──────────────────────────────────────────────────
    /** Total run time (ms), accumulated one fixed step at a time. */
    elapsedMs: { default: 0 as number },
    /** Last step's delta (ms): the injected fixed `dt` systems integrate. */
    frameDeltaMs: { default: 0 as number },
    /** Seeded PRNG state (LCG). Advanced by transactions, never Math.random(). */
    rng: { default: 0 as number },

    /**
     * Queued taps awaiting a system (input as intent). A FIFO queue, not a single
     * slot, so every tap in a frame is preserved and drained next step.
     */
    pendingTaps: { default: [] as TapIntent[] },
  },
  computed: {
    /** Reactive "is the run over" flag, handy for the Inspector / agents. */
    finished: (db) =>
      Observe.withMap(
        db.observe.resources.phase,
        (p) => p === 'won' || p === 'lost',
      ),
  },
  transactions: {
    /**
     * Start a run of one level: reset score and time, seed the rng, enter
     * `playing`. The level's numbers come from the Content Pack (`levelAt`); the
     * sim never reads the pack itself. A game that builds a board or spawns
     * pieces at the start does it here, after the reset.
     */
    startRun(
      store,
      {
        seed,
        goal = 0,
        level = 0,
        packId = '',
      }: { seed: number; goal?: number; level?: number; packId?: string },
    ) {
      store.resources.level = level;
      store.resources.packId = packId;
      store.resources.goal = goal;
      store.resources.score = 0;
      store.resources.phase = 'playing';
      store.resources.elapsedMs = 0;
      store.resources.frameDeltaMs = 0;
      store.resources.rng = seed >>> 0;
      store.resources.pendingTaps = [];
    },

    /** Add (or, with a negative value, take away) points. */
    addScore(store, { points }: { points: number }) {
      store.resources.score += points;
    },

    /** Enqueue a tap for a system to resolve next step (input as intent). */
    submitTap(store, { x, y }: TapIntent) {
      store.resources.pendingTaps = [...store.resources.pendingTaps, { x, y }];
    },
    /** Drop every queued tap (called by the system that resolves them). */
    clearTaps(store) {
      store.resources.pendingTaps = [];
    },

    /** Set the run phase (`won` / `lost` hands off to the results screen). */
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
    // Init-only, no-op: the controller calls `startRun` explicitly so the world is
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
