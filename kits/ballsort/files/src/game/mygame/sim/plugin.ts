/**
 * plugin — the ECS world the game is built on (@adobe/data).
 *
 * The run's lifecycle, the level it plays, the determinism seam (injected time,
 * seeded rng) and the event queue (`./events.ts`), plus ball sort: Ball and
 * Tube entities and the moves on them (`tap`, `tapTube`, `undo`,
 * `restartLevel`, `moveCursor`, `pressCursor`).
 *
 * Ball sort is turn-based: input calls these transactions directly (no system,
 * `SYSTEM_ORDER` stays empty). Each move applies the pure rules
 * (`./rules/ballSort.ts`) to the board read from the entities (`./readBoard.ts`)
 * and `emit`s what happened, so sound and the screen-reader line come from the
 * controller's cue table.
 *
 * ECS is the **source of truth** (guardrail: game state lives in ECS, not
 * signals). All state changes go through transactions. Determinism holds: `dt`
 * arrives as an injected resource, and the level comes from its seed, never
 * `Math.random()`/`Date.now()`.
 *
 * Plugin property order is runtime-enforced:
 *   extends → services → components → resources → archetypes → computed →
 *   transactions → actions → systems
 */

import { Database, type Entity, I32, Observe } from '~/core/systems/ecs';
import { type EventOf, emit, NO_EVENTS } from './events';
import { readBoard } from './readBoard';
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
import { neighborTube, tubeAt } from './rules/layout';

/** Lifecycle of a run. */
export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

/** A keyboard step for the tube cursor. */
export type CursorDir = 'left' | 'right' | 'up' | 'down';

/**
 * Everything the sim reports to the outside world (sound, screen reader, HUD,
 * views). One entry per kind: `type → payload`.
 */
export type GameEvent = EventOf<{
  /** The top ball of `tube` was lifted. */
  lifted: { tube: number };
  /** The lifted ball was put back on `tube`: tapped again, or an illegal drop (`illegal`). */
  putBack: { tube: number; illegal: boolean };
  /** A legal move: a ball went from `from` to `to`. `moves` is the new count. */
  moved: { from: number; to: number; moves: number };
  /** `tube` now holds four balls of one colour. */
  tubeDone: { tube: number };
  /** The last move was taken back; `undosLeft` remain. */
  undone: { undosLeft: number };
  /** Level `level` was rebuilt from its seed. */
  restarted: { level: number };
  /** No legal move left after `moves` moves, and not won: the level needs a retry. */
  stuck: { moves: number };
  /** The keyboard cursor moved to `tube`. */
  cursor: { tube: number };
  /** The run's phase changed. */
  phase: { phase: GamePhase };
}>;

/** The Ball entity at `slot` of `tube`, or -1. */
function ballAt(store: GameStore, tube: number, slot: number): Entity {
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
  store.resources.cursor = -1;
  store.resources.stuck = false;
  store.resources.phase = 'playing';
  store.resources.runId += 1;
}

/** Move the top ball of `from` onto `to` in ECS (no legality check). */
function moveBall(store: GameStore, board: Board, { from, to }: Move): void {
  const e = ballAt(store, from, board[from].length - 1);
  if (e === -1) return;
  store.update(e, { tube: to, slot: board[to].length });
}

/** After the board changed: mark done tubes, then won / stuck. Emits each change. */
function settle(store: GameStore): void {
  const board = readBoard(store);
  for (const e of store.select(['tubeIndex', 'done'])) {
    const t = store.read(e, ['tubeIndex', 'done']);
    if (t?.tubeIndex === undefined) continue;
    const done = isTubeComplete(board[t.tubeIndex]);
    if (done === t.done) continue;
    store.update(e, { done, spriteKey: done ? 'tube-done' : 'tube' });
    if (done) emit(store, { type: 'tubeDone', tube: t.tubeIndex });
  }
  if (isWon(board)) {
    store.resources.phase = 'won';
    store.resources.runMoves += store.resources.moves;
    store.resources.runPar += store.resources.par;
    emit(store, { type: 'phase', phase: 'won' });
    return;
  }
  const stuck = !hasLegalMove(board);
  if (stuck && !store.resources.stuck)
    emit(store, { type: 'stuck', moves: store.resources.moves });
  store.resources.stuck = stuck;
}

/** Tap a tube: lift its top ball, or drop the lifted one here. */
function tapTubeIn(store: GameStore, tube: number): void {
  const r = store.resources;
  if (r.phase !== 'playing' || r.stuck) return;
  if (tube < 0 || tube >= r.tubeCount) return;
  const board = readBoard(store);
  if (r.heldTube === -1) {
    if (board[tube].length === 0) return;
    r.heldTube = tube;
    emit(store, { type: 'lifted', tube });
    return;
  }
  const from = r.heldTube;
  r.heldTube = -1;
  if (!canDrop(board, from, tube)) {
    emit(store, { type: 'putBack', tube: from, illegal: from !== tube });
    return;
  }
  moveBall(store, board, { from, to: tube });
  r.moves += 1;
  r.history = [...r.history, { from, to: tube }];
  emit(store, { type: 'moved', from, to: tube, moves: r.moves });
  settle(store);
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
    /** The level's `goal` from the pack (ball sort sets none: a level ends when sorted). */
    goal: { default: 0 as number },
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
    history: { default: [] as readonly Move[] },
    /** The tube whose top ball is lifted, or -1. */
    heldTube: { default: -1 as number },
    /** The tube the keyboard points at, or -1 before the first key. */
    cursor: { default: -1 as number },
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
     * Start a run of one level: reset time and events, seed the rng, and lay
     * out the board from the level's seed and colours. The level's numbers come
     * from the Content Pack (`levelAt`); the sim never reads the pack itself.
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
      store.resources.elapsedMs = 0;
      store.resources.frameDeltaMs = 0;
      store.resources.rng = seed >>> 0;
      store.resources.events = NO_EVENTS;
      store.resources.eventsDropped = 0;
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
      if (store.resources.phase !== 'playing') return;
      buildBoard(store);
      emit(store, { type: 'restarted', level: store.resources.level });
    },

    /**
     * A tap at design-space (x, y) (DESIGN_CANVAS px, 390×844), straight from
     * input (`../input/pointer.ts`): a tap on a tube is `tapTube`, anywhere
     * else does nothing.
     */
    tap(store, { x, y }: { x: number; y: number }) {
      const tube = tubeAt(x, y, store.resources.tubeCount);
      if (tube >= 0) tapTubeIn(store, tube);
    },

    /**
     * Tap a tube: lift its top ball, or drop the lifted one here. Tapping the
     * same tube, or an illegal drop, puts the ball back.
     */
    tapTube(store, { tube }: { tube: number }) {
      tapTubeIn(store, tube);
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
      emit(store, { type: 'undone', undosLeft: r.undosLeft });
      settle(store);
    },

    /** Keyboard: move the tube cursor (the first key shows it on the held tube, or tube 0). */
    moveCursor(store, { dir }: { dir: CursorDir }) {
      const r = store.resources;
      if (r.phase !== 'playing' || r.tubeCount === 0) return;
      const tube =
        r.cursor === -1
          ? Math.max(r.heldTube, 0)
          : neighborTube(r.tubeCount, r.cursor, dir);
      if (tube === r.cursor) return;
      r.cursor = tube;
      emit(store, { type: 'cursor', tube });
    },

    /** Keyboard: tap the tube under the cursor (the first press shows the cursor). */
    pressCursor(store) {
      const r = store.resources;
      if (r.phase !== 'playing' || r.tubeCount === 0) return;
      if (r.cursor === -1) {
        r.cursor = Math.max(r.heldTube, 0);
        emit(store, { type: 'cursor', tube: r.cursor });
        return;
      }
      tapTubeIn(store, r.cursor);
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
  // is populated identically in game and in tests. Ball sort resolves every move
  // in a transaction, so `SYSTEM_ORDER` (`./systems/index.ts`) stays empty.
});

export type GamePlugin = typeof gamePlugin;
export type GameDatabase = Database.Plugin.ToDatabase<GamePlugin>;
export type GameStore = Database.Plugin.ToStore<GamePlugin>;

/** Create a fresh game ECS world (base plugin, no agent service). */
export function createGameWorld(): GameDatabase {
  return Database.create(gamePlugin) as GameDatabase;
}
