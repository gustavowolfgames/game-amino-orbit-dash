/**
 * plugin — the ECS world the match-3 is built on (@adobe/data).
 *
 * The template's core (the run's lifecycle, the level it plays, the
 * determinism seam, the event queue `./events.ts`) plus the match-3: one
 * `Tile` entity per board cell, the level's move budget and colour goal, and
 * the `commitMove` transaction the turn function (`./turn.ts`) calls with a
 * resolved swap.
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

import { Database, I32, Observe } from '~/core/systems/ecs';
import { type EventOf, emit, NO_EVENTS } from './events';
import { nextRng } from './rng';
import {
  type Board,
  type Cell,
  COLOR_NAMES,
  cellOf,
  generateBoard,
  type SwapRuling,
} from './rules/board';

/** Lifecycle of a run. */
export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

/**
 * Everything the sim reports to the outside world (sound, screen reader, HUD,
 * views). One entry per kind: `type → payload`. `emit` them from transactions.
 */
export type GameEvent = EventOf<{
  /**
   * One cascade step of a move cleared tiles. `x, y` is the centre of the
   * cleared cells in board cells (col, row; fractional), `points` this step's,
   * `chain` 1 for the swap's own clear, `score` the level's new total.
   */
  scored: {
    x: number;
    y: number;
    points: number;
    chain: number;
    score: number;
  };
  /** A swap made no line: it is undone and costs no move. */
  rejected: { a: Cell; b: Cell };
  /** The settled board had no move left and was redrawn. */
  reshuffled: object;
  /** The run's phase changed. */
  phase: { phase: GamePhase };
}>;

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
    /** The level's target: tiles of `goalColor` to clear. */
    goal: { default: 0 as number },
    score: { default: 0 as number },
    phase: { default: 'idle' as GamePhase },
    /** Bumped by every `startRun`, so views rebuild on a new run (entity ids are reused). */
    runId: { default: 0 as number },
    /** Bumped by every board write, so readers (the agent's `board`) know it changed. */
    boardVersion: { default: 0 as number },
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

    // ── Event queue (./events.ts) ─────────────────────────────────────────
    /** Events emitted since the controller last drained them, oldest first. */
    events: { default: NO_EVENTS as readonly GameEvent[] },
    /** Events dropped because the queue was full (should stay 0). */
    eventsDropped: { default: 0 as number },
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
     * Start a run of one level: reset score, time and events, seed the rng,
     * enter `playing`, and build the level's starting board (no ready-made
     * matches, deterministic from the seed). The level's numbers come from the
     * Content Pack (`levelAt`); the sim never reads the pack itself.
     * `entry: 'next'` banks the won level's score; level 0 starts the run total
     * from zero.
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
      store.resources.events = NO_EVENTS;
      store.resources.eventsDropped = 0;

      // Mix the seed so neighbouring seeds (1, 2, 3) give unrelated boards.
      const { board, rng } = generateBoard(nextRng(nextRng(seed >>> 0)));
      store.resources.rng = rng;
      writeBoard(store, board);
    },

    /**
     * Commit a resolved swap (`resolveSwap` in rules/board.ts, via `applySwap`
     * in ./turn.ts): the settled board, the rng, points, a move spent and the
     * goal's progress. Reaching the goal wins; running out of moves loses. An
     * invalid ruling only reports `rejected`.
     */
    commitMove(store, ruling: SwapRuling) {
      if (store.resources.phase !== 'playing') return;
      if (!ruling.valid) {
        emit(store, { type: 'rejected', a: ruling.a, b: ruling.b });
        return;
      }
      writeBoard(store, ruling.board);
      store.resources.rng = ruling.rng;
      for (const step of ruling.steps) {
        store.resources.score += step.points;
        const n = step.cleared.length;
        emit(store, {
          type: 'scored',
          x: step.cleared.reduce((s, c) => s + c.col, 0) / n,
          y: step.cleared.reduce((s, c) => s + c.row, 0) / n,
          points: step.points,
          chain: step.chain,
          score: store.resources.score,
        });
      }
      if (ruling.reshuffled) emit(store, { type: 'reshuffled' });
      store.resources.movesLeft = Math.max(0, store.resources.movesLeft - 1);
      store.resources.goalProgress = Math.min(
        store.resources.goal,
        store.resources.goalProgress +
          (ruling.clearedByColor[store.resources.goalColor] ?? 0),
      );
      if (store.resources.goalProgress >= store.resources.goal) {
        store.resources.phase = 'won';
        emit(store, { type: 'phase', phase: 'won' });
      } else if (store.resources.movesLeft === 0) {
        store.resources.phase = 'lost';
        emit(store, { type: 'phase', phase: 'lost' });
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
  store.resources.boardVersion += 1;
}

/** The store shape `writeBoard` needs (declared before the plugin type exists). */
interface GameStoreLike {
  resources: { boardVersion: number };
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
