/**
 * plugin — the ECS world the game is built on (@adobe/data).
 *
 * The core every game starts from: the run's lifecycle, the level it plays, the
 * determinism seam (injected time, seeded rng) and the event queue
 * (`./events.ts`). A game adds its own `components`, `archetypes` and
 * `transactions` here (see `./README.md`): pieces and bodies are archetype
 * entities with a `spriteKey`; a fixed board whose squares never move is one
 * dense array in a resource; other resources hold only global values.
 *
 * ECS is the **source of truth** (guardrail: game state lives in ECS, not
 * signals). All state changes go through transactions. Determinism holds: `dt`
 * arrives as an injected resource, and randomness comes from the seeded `rng`
 * resource (`./rng.ts`), never `Math.random()`/`Date.now()`.
 *
 * Plugin property order is runtime-enforced:
 *   extends → services → components → resources → archetypes → computed →
 *   transactions → actions → systems
 */

import { Database, Observe } from '~/core/systems/ecs';
import { type EventOf, emit, NO_EVENTS } from './events';

/** Lifecycle of a run. */
export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

/**
 * Everything the sim reports to the outside world (sound, screen reader, HUD,
 * views). One entry per kind: `type → payload`. Add the game's own here
 * (`hit: { x: number; y: number }`), and `emit` them from transactions.
 */
export type GameEvent = EventOf<{
  /** A point was scored at design-space (x, y); `score` is the new total. */
  scored: { x: number; y: number; score: number };
  /** The run's phase changed. */
  phase: { phase: GamePhase };
}>;

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
    /** The level's target (its `goal`; 0 = none). The example `tap` wins at it. */
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

    // ── Event queue (./events.ts) ─────────────────────────────────────────
    /** Events emitted since the controller last drained them, oldest first. */
    events: { default: NO_EVENTS as readonly GameEvent[] },
    /** Events dropped because the queue was full (should stay 0). */
    eventsDropped: { default: 0 as number },
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
     * Start a run of one level: reset score, time and events, seed the rng,
     * enter `playing`. The level's numbers come from the Content Pack
     * (`levelAt`); the sim never reads the pack itself. A game that builds a
     * board or spawns pieces at the start does it here, after the reset.
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
      store.resources.events = NO_EVENTS;
      store.resources.eventsDropped = 0;
    },

    /**
     * The template's one example move — replace it with the game's own. A tap
     * at design-space (x, y) (DESIGN_CANVAS px, 390×844) scores a point; reaching the level's goal wins.
     * Called straight from input (`../input/pointer.ts`), turn-based style.
     */
    tap(store, { x, y }: { x: number; y: number }) {
      if (store.resources.phase !== 'playing') return;
      const score = store.resources.score + 1;
      store.resources.score = score;
      emit(store, { type: 'scored', x, y, score });
      const { goal } = store.resources;
      if (goal > 0 && score >= goal) {
        store.resources.phase = 'won';
        emit(store, { type: 'phase', phase: 'won' });
      }
    },

    /** Set the run phase (`won` / `lost` hands off to the results screen). */
    setPhase(store, phase: GamePhase) {
      if (store.resources.phase === phase) return;
      store.resources.phase = phase;
      emit(store, { type: 'phase', phase });
    },

    /** Inject one fixed step's time. `dt` comes from the loop, never Date.now(). */
    advanceTime(store, { dt }: { dt: number }) {
      store.resources.frameDeltaMs = dt;
      store.resources.elapsedMs += dt;
    },

    /** Empty the event queue (`drainEvents` calls this once per frame). */
    clearEvents(store) {
      store.resources.events = NO_EVENTS;
    },
  },
  // No plugin `systems`: the controller calls `startRun` explicitly so the world
  // is populated identically in game and in tests, and the per-frame schedule
  // is `SYSTEM_ORDER`, run by `stepWorld` (`schedule.ts`) off the fixed step.
});

export type GamePlugin = typeof gamePlugin;
export type GameDatabase = Database.Plugin.ToDatabase<GamePlugin>;
export type GameStore = Database.Plugin.ToStore<GamePlugin>;

/** Create a fresh game ECS world (base plugin, no agent service). */
export function createGameWorld(): GameDatabase {
  return Database.create(gamePlugin) as GameDatabase;
}
