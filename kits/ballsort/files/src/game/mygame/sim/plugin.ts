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

import { Database, type Entity, I32, Observe } from '~/core/systems/ecs';
import {
  type Board,
  canDrop,
  generateBoard,
  hasLegalMove,
  isTubeComplete,
  isWon,
  type Move,
  UNDOS_PER_LEVEL,
} from './rules/ballSort';

/** Lifecycle of a run. */
export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

/** A queued tap awaiting a system (input as intent). Design-space point. */
export interface TapIntent {
  x: number;
  y: number;
}

/** A queued button press awaiting a system (input as intent). */
export type Command = 'undo' | 'restart';

/** A store or database: enough to read the balls. */
interface BallSource {
  select: GameStore['select'];
  read: GameStore['read'];
  readonly resources: { readonly tubeCount: number };
}

/** The board as plain arrays (bottom ball first), read from the Ball entities. */
export function readBoard(source: BallSource): number[][] {
  const board: number[][] = Array.from(
    { length: source.resources.tubeCount },
    () => [],
  );
  for (const e of source.select(['ball', 'tube', 'slot', 'color'])) {
    const b = source.read(e, ['tube', 'slot', 'color']);
    if (b?.tube !== undefined && b.slot !== undefined && b.color !== undefined)
      board[b.tube][b.slot] = b.color;
  }
  return board;
}

/** The Ball entity on top of `tube`, or -1. */
function topBall(store: GameStore, tube: number, slot: number): Entity {
  for (const e of store.select(['ball', 'tube', 'slot'])) {
    const b = store.read(e, ['tube', 'slot']);
    if (b && b.tube === tube && b.slot === slot) return e;
  }
  return -1 as Entity;
}

/** Wipe the balls and tubes and lay out the level's start from its seed. */
function buildBoard(store: GameStore): void {
  for (const e of [...store.select(['ball'])]) store.delete(e);
  for (const e of [...store.select(['tubeIndex'])]) store.delete(e);
  const board = generateBoard(store.resources.seed, store.resources.colors);
  store.resources.tubeCount = board.length;
  board.forEach((balls, tube) => {
    store.archetypes.Tube.insert({
      tubeIndex: tube,
      done: false,
      spriteKey: 'tube',
    });
    balls.forEach((color, slot) => {
      store.archetypes.Ball.insert({
        ball: true,
        tube,
        slot,
        color,
        spriteKey: `ball-${color}`,
      });
    });
  });
  store.resources.moves = 0;
  store.resources.undosLeft = UNDOS_PER_LEVEL;
  store.resources.history = [];
  store.resources.heldTube = -1;
  store.resources.stuck = false;
  store.resources.phase = 'playing';
  store.resources.runId += 1;
}

/** Move the top ball of `from` onto `to` in ECS (no legality check). */
function moveBall(store: GameStore, board: Board, { from, to }: Move): void {
  const e = topBall(store, from, board[from].length - 1);
  if (e === -1) return;
  store.update(e, { tube: to, slot: board[to].length });
}

/** After the board changed: mark done tubes, then won / stuck. */
function settle(store: GameStore): void {
  const board = readBoard(store);
  for (const e of store.select(['tubeIndex', 'done'])) {
    const index = store.read(e, ['tubeIndex'])?.tubeIndex;
    if (index === undefined) continue;
    const done = isTubeComplete(board[index]);
    store.update(e, { done, spriteKey: done ? 'tube-done' : 'tube' });
  }
  if (isWon(board)) {
    store.resources.phase = 'won';
    store.resources.runMoves += store.resources.moves;
    store.resources.runPar += store.resources.par;
  } else {
    store.resources.stuck = !hasLegalMove(board);
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────

export const gamePlugin = Database.Plugin.create({
  components: {
    /** Inspector display name (getEntityName reads spriteKey/key/name). */
    spriteKey: { type: 'string', default: '' } as const,
    /** Tag: this entity is a ball. */
    ball: { type: 'boolean', default: true } as const,
    /** Ball: the tube it sits in. */
    tube: I32.schema,
    /** Ball: its height in the tube (0 = bottom). */
    slot: I32.schema,
    /** Ball: colour index. */
    color: I32.schema,
    /** Tube: its index (left to right, row by row). */
    tubeIndex: I32.schema,
    /** Tube: holds four balls of one colour. */
    done: { type: 'boolean', default: false } as const,
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
    /** Queued button presses (undo, restart), drained like taps. */
    pendingCommands: { default: [] as Command[] },

    // ── Ball sort ─────────────────────────────────────────────────────────
    /** The level's seed and colour count: restart rebuilds from them. */
    seed: { default: 0 as number },
    colors: { default: 4 as number },
    /** The level's par (moves for three stars). */
    par: { default: 0 as number },
    tubeCount: { default: 0 as number },
    /** Moves this level (an undo takes one back). */
    moves: { default: 0 as number },
    undosLeft: { default: 0 as number },
    /** Moves played this level, newest last: what undo takes back. */
    history: { default: [] as Move[] },
    /** The tube whose top ball is lifted, or -1. */
    heldTube: { default: -1 as number },
    /** No legal move left and not won: the level needs a retry. */
    stuck: { default: false as boolean },
    /** Moves and par summed over the levels won this run (results screen). */
    runMoves: { default: 0 as number },
    runPar: { default: 0 as number },
    /** Bumped each time the board is rebuilt, so views know entity ids restarted. */
    runId: { default: 0 as number },
  },
  archetypes: {
    Ball: ['ball', 'tube', 'slot', 'color', 'spriteKey'],
    Tube: ['tubeIndex', 'done', 'spriteKey'],
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
        colors = 4,
        par = 0,
      }: {
        seed: number;
        goal?: number;
        level?: number;
        packId?: string;
        colors?: number;
        par?: number;
      },
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
      store.resources.pendingCommands = [];
      store.resources.seed = seed >>> 0;
      store.resources.colors = colors;
      store.resources.par = par;
      // The first level starts a fresh run total.
      if (level === 0) {
        store.resources.runMoves = 0;
        store.resources.runPar = 0;
      }
      buildBoard(store);
    },

    /** Restart the current level from its seed. */
    restartLevel(store) {
      store.resources.pendingTaps = [];
      buildBoard(store);
    },

    /**
     * Tap a tube: lift its top ball, or drop the lifted one here. Tapping the
     * same tube, or an illegal drop, puts the ball back.
     */
    tapTube(store, { tube }: { tube: number }) {
      const r = store.resources;
      if (r.phase !== 'playing' || r.stuck) return;
      if (tube < 0 || tube >= r.tubeCount) return;
      const board = readBoard(store);
      if (r.heldTube === -1) {
        if (board[tube].length > 0) r.heldTube = tube;
        return;
      }
      const from = r.heldTube;
      r.heldTube = -1;
      if (!canDrop(board, from, tube)) return;
      moveBall(store, board, { from, to: tube });
      r.moves += 1;
      r.history = [...r.history, { from, to: tube }];
      settle(store);
    },

    /** Take back the last move (up to UNDOS_PER_LEVEL per level). */
    undo(store) {
      const r = store.resources;
      if (r.phase !== 'playing' || r.undosLeft <= 0) return;
      const last = r.history[r.history.length - 1];
      if (!last) return;
      r.heldTube = -1;
      moveBall(store, readBoard(store), { from: last.to, to: last.from });
      r.history = r.history.slice(0, -1);
      r.moves -= 1;
      r.undosLeft -= 1;
      settle(store);
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
    /** Enqueue a button press for a system to resolve next step. */
    submitCommand(store, command: Command) {
      store.resources.pendingCommands = [
        ...store.resources.pendingCommands,
        command,
      ];
    },
    clearCommands(store) {
      store.resources.pendingCommands = [];
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
