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

import { Database, I32, Observe } from '~/core/systems/ecs';
import { nextRng } from './rng';
import {
  type Board,
  COLOR_NAMES,
  cellOf,
  generateBoard,
  type SwapRuling,
} from './rules/board';

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
    /** Board column of a tile (0 = left). */
    col: I32.schema,
    /** Board row of a tile (0 = top). */
    row: I32.schema,
    /** Tile colour index into `COLOR_NAMES` (rules/board.ts). */
    color: I32.schema,
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
    /** Bumped by every `startRun`, so views rebuild on a new run (entity ids are reused). */
    runId: { default: 0 as number },
    /** The level's seed, kept so a restart replays the same board. */
    seed: { default: 0 as number },
    /** Colour index the level's goal counts. */
    goalColor: { default: 0 as number },
    /** Tiles of `goalColor` cleared so far this level. */
    goalProgress: { default: 0 as number },
    /** Moves the level started with, and moves left. */
    maxMoves: { default: 20 as number },
    movesLeft: { default: 20 as number },
    /** Score banked from the levels already won this run (total = banked + score). */
    bankedScore: { default: 0 as number },

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
  archetypes: {
    /** One tile on the 8×8 board. */
    Tile: ['col', 'row', 'color', 'spriteKey'],
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
     * `playing`, and build the level's starting board (no ready-made matches,
     * deterministic from the seed). The level's numbers come from the Content
     * Pack (`levelAt`); the sim never reads the pack itself. `entry: 'next'`
     * banks the won level's score; level 0 starts the run total from zero.
     */
    startRun(
      store,
      {
        seed,
        goal = 0,
        level = 0,
        packId = '',
        goalColor = 0,
        moves = 20,
        entry = 'restart',
      }: {
        seed: number;
        goal?: number;
        level?: number;
        packId?: string;
        goalColor?: number;
        moves?: number;
        entry?: 'fresh' | 'next' | 'restart';
      },
    ) {
      if (level === 0) store.resources.bankedScore = 0;
      else if (entry === 'next')
        store.resources.bankedScore += store.resources.score;
      else if (entry === 'fresh') store.resources.bankedScore = 0;
      store.resources.runId += 1;
      store.resources.seed = seed >>> 0;
      store.resources.goalColor = goalColor;
      store.resources.goalProgress = 0;
      store.resources.maxMoves = moves;
      store.resources.movesLeft = moves;
      store.resources.level = level;
      store.resources.packId = packId;
      store.resources.goal = goal;
      store.resources.score = 0;
      store.resources.phase = 'playing';
      store.resources.elapsedMs = 0;
      store.resources.frameDeltaMs = 0;
      store.resources.rng = seed >>> 0;
      store.resources.pendingTaps = [];

      // Mix the seed so neighbouring seeds (1, 2, 3) give unrelated boards.
      const { board, rng } = generateBoard(nextRng(nextRng(seed >>> 0)));
      store.resources.rng = rng;
      writeBoard(store, board);
    },

    /**
     * Commit a resolved swap (`resolveSwap` in rules/board.ts, via `applySwap`
     * in ../turn.ts): the settled board, the rng, points, a move spent and the
     * goal's progress. Reaching the goal wins; running out of moves loses.
     */
    commitMove(store, ruling: SwapRuling) {
      if (!ruling.valid || store.resources.phase !== 'playing') return;
      writeBoard(store, ruling.board);
      store.resources.rng = ruling.rng;
      store.resources.score += ruling.points;
      store.resources.movesLeft = Math.max(0, store.resources.movesLeft - 1);
      store.resources.goalProgress = Math.min(
        store.resources.goal,
        store.resources.goalProgress +
          (ruling.clearedByColor[store.resources.goalColor] ?? 0),
      );
      if (store.resources.goalProgress >= store.resources.goal) {
        store.resources.phase = 'won';
      } else if (store.resources.movesLeft === 0) {
        store.resources.phase = 'lost';
      }
    },

    /** Replace the board as-is (tests, agents, dev tools). Keeps score and moves. */
    setBoard(store, { board }: { board: Board }) {
      writeBoard(store, board);
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

/** Replace every tile entity with `board` (one transaction: clear and rebuild). */
function writeBoard(store: GameStoreLike, board: Board): void {
  for (const e of [...store.select(['col', 'row', 'color'])]) store.delete(e);
  board.forEach((color, i) => {
    const { col, row } = cellOf(i);
    store.archetypes.Tile.insert({
      col,
      row,
      color,
      spriteKey: `tile-${COLOR_NAMES[color]}`,
    });
  });
}

/** The store shape `writeBoard` needs (declared before the plugin type exists). */
interface GameStoreLike {
  select(components: ['col', 'row', 'color']): Iterable<number>;
  delete(entity: number): void;
  archetypes: {
    Tile: {
      insert(row: {
        col: number;
        row: number;
        color: number;
        spriteKey: string;
      }): unknown;
    };
  };
}

export type GamePlugin = typeof gamePlugin;
export type GameDatabase = Database.Plugin.ToDatabase<GamePlugin>;
export type GameStore = Database.Plugin.ToStore<GamePlugin>;

/** Create a fresh game ECS world (base plugin, no agent service). */
export function createGameWorld(): GameDatabase {
  return Database.create(gamePlugin) as GameDatabase;
}
