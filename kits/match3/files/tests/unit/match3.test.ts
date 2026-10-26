/**
 * Headless tests for the match-3 sim: board rules (src/game/mygame/sim/rules/),
 * the turn function (src/game/mygame/sim/turn.ts) and the commit transaction.
 * No engine, no screen: build boards, swap, assert ECS.
 */

import { describe, expect, it } from 'vitest';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import {
  BOARD_SIZE,
  type Board,
  COLOR_COUNT,
  findMatches,
  generateBoard,
  hasAnyMove,
  indexOf,
} from '~/game/mygame/sim/rules/board';
import { pointsFor, starsFor } from '~/game/mygame/sim/rules/scoring';
import { readBoard, readTiles } from '~/game/mygame/sim/tiles';
import { applySwap } from '~/game/mygame/sim/turn';

const N = BOARD_SIZE;

/**
 * A board with no matches: colour = (col + 2*row) % 5 never repeats 3 in a row
 * or column. `edits` overrides cells as [col, row, color].
 */
function boardWith(edits: Array<[number, number, number]>): Board {
  const b: Board = [];
  for (let row = 0; row < N; row++)
    for (let col = 0; col < N; col++) b.push((col + 2 * row) % COLOR_COUNT);
  for (const [c, r, color] of edits) b[indexOf(c, r)] = color;
  return b;
}

/** A world on a fresh run whose board is replaced by `board`. */
function worldWithBoard(board: Board, goal = 99, goalColor = 0, moves = 20) {
  const db = createGameWorld();
  db.transactions.startRun({ seed: 1, goal, goalColor, moves });
  db.transactions.setBoard({ board });
  return db;
}

/** Bottom row 4,4,_ with a 4 above col 2: swapping (2,6)↔(2,7) clears row 7 cols 0–2. */
const ONE_CLEAR = boardWith([
  [0, 7, 4],
  [1, 7, 4],
  [2, 6, 4],
  [2, 7, 1],
]);

describe('starting board', () => {
  it('is 8×8 tile entities with no ready-made match and at least one move', () => {
    for (const seed of [1, 2, 3, 42, 0xdeadbeef]) {
      const db = createGameWorld();
      db.transactions.startRun({ seed, goal: 15 });
      expect(readTiles(db)).toHaveLength(N * N);
      const board = readBoard(db);
      expect(board.every((c) => c >= 0 && c < COLOR_COUNT)).toBe(true);
      expect(findMatches(board)).toEqual([]);
      expect(hasAnyMove(board)).toBe(true);
    }
  });

  it('is deterministic from the seed', () => {
    const a = createGameWorld();
    const b = createGameWorld();
    a.transactions.startRun({ seed: 7 });
    b.transactions.startRun({ seed: 7 });
    expect(readBoard(a)).toEqual(readBoard(b));
    const c = createGameWorld();
    c.transactions.startRun({ seed: 8 });
    expect(readBoard(c)).not.toEqual(readBoard(a));
  });

  it('generateBoard never leaves a match', () => {
    let rng = 99;
    for (let i = 0; i < 50; i++) {
      const out = generateBoard(rng);
      expect(findMatches(out.board)).toEqual([]);
      rng = out.rng;
    }
  });
});

describe('a swap that matches', () => {
  it('clears the run, refills the board and scores 30 per tile', () => {
    // Row 7: put colour 4 at cols 0,1 and at col 2 of row 6; swapping
    // (2,6)↔(2,7) lines up three 4s at the bottom.
    expect(findMatches(ONE_CLEAR)).toEqual([]);
    const db = worldWithBoard(ONE_CLEAR, 99, 4);
    const ruling = applySwap(db, { col: 2, row: 6 }, { col: 2, row: 7 });

    expect(ruling.valid).toBe(true);
    expect(ruling.steps[0].chain).toBe(1);
    expect(ruling.steps[0].cleared).toEqual(
      expect.arrayContaining([
        { col: 0, row: 7 },
        { col: 1, row: 7 },
        { col: 2, row: 7 },
      ]),
    );
    // Cleared tiles were refilled: still a full board, no leftover match.
    const after = readBoard(db);
    expect(readTiles(db)).toHaveLength(N * N);
    expect(after.every((c) => c >= 0)).toBe(true);
    expect(findMatches(after)).toEqual([]);
    // Tiles above the cleared cells fell one row.
    expect(ruling.steps[0].falls).toContainEqual({
      col: 0,
      fromRow: 6,
      toRow: 7,
    });
    expect(ruling.steps[0].spawns.filter((s) => s.toRow === 0)).toHaveLength(
      ruling.steps[0].cleared.length,
    );
    expect(db.resources.score).toBe(ruling.points);
    expect(ruling.points).toBeGreaterThanOrEqual(90);
    expect(db.resources.movesLeft).toBe(19);
    expect(db.resources.goalProgress).toBe(ruling.clearedByColor[4]);
  });
});

describe('a swap that does not match', () => {
  it('is reverted: board, rng, score and moves are unchanged', () => {
    const board = boardWith([]);
    const db = worldWithBoard(board);
    const rngBefore = db.resources.rng;
    const ruling = applySwap(db, { col: 0, row: 0 }, { col: 1, row: 0 });
    expect(ruling.valid).toBe(false);
    expect(readBoard(db)).toEqual(board);
    expect(db.resources.rng).toBe(rngBefore);
    expect(db.resources.score).toBe(0);
    expect(db.resources.movesLeft).toBe(20);
  });

  it('rejects cells that are not neighbours', () => {
    const db = worldWithBoard(boardWith([]));
    expect(applySwap(db, { col: 0, row: 0 }, { col: 2, row: 0 }).valid).toBe(
      false,
    );
    expect(applySwap(db, { col: 0, row: 0 }, { col: 1, row: 1 }).valid).toBe(
      false,
    );
  });
});

describe('chains', () => {
  it('multiplies each cascade step by its chain number', () => {
    // Swap (0,5)↔(1,5) lines up 4,4,4 in column 0, rows 5–7 (step 1). Column 0
    // then falls three rows: its row-4 tile (a 3) lands at (0,7) beside the
    // two 3s placed at (1,7),(2,7), so row 7 clears again (step 2, ×2).
    const board = boardWith([
      [0, 6, 4],
      [0, 7, 4],
      [1, 5, 4],
      [1, 7, 3],
      [2, 7, 3],
    ]);
    expect(findMatches(board)).toEqual([]);
    const db = worldWithBoard(board);
    const ruling = applySwap(db, { col: 0, row: 5 }, { col: 1, row: 5 });

    expect(ruling.valid).toBe(true);
    expect(ruling.steps.length).toBeGreaterThanOrEqual(2);
    expect(ruling.steps[0].cleared).toEqual([
      { col: 0, row: 5 },
      { col: 0, row: 6 },
      { col: 0, row: 7 },
    ]);
    expect(ruling.steps[1].cleared).toEqual(
      expect.arrayContaining([
        { col: 0, row: 7 },
        { col: 1, row: 7 },
        { col: 2, row: 7 },
      ]),
    );
    ruling.steps.forEach((step, i) => {
      expect(step.chain).toBe(i + 1);
      expect(step.points).toBe(step.cleared.length * 30 * (i + 1));
    });
    expect(ruling.steps[0].points).toBe(90);
    expect(ruling.steps[1].points).toBe(ruling.steps[1].cleared.length * 60);
    expect(db.resources.score).toBe(
      ruling.steps.reduce((sum, s) => sum + s.points, 0),
    );
  });

  it('pointsFor applies the multiplier', () => {
    expect(pointsFor(3, 1)).toBe(90);
    expect(pointsFor(3, 2)).toBe(180);
    expect(pointsFor(4, 3)).toBe(360);
  });
});

describe('goal and moves end the level', () => {
  it('wins when the goal colour count is reached', () => {
    const db = worldWithBoard(ONE_CLEAR, 3, 4);
    applySwap(db, { col: 2, row: 6 }, { col: 2, row: 7 });
    expect(db.resources.goalProgress).toBe(3);
    expect(db.resources.phase).toBe('won');
  });

  it('loses when the last move is spent short of the goal', () => {
    const db = worldWithBoard(ONE_CLEAR, 99, 0, 1);
    expect(applySwap(db, { col: 2, row: 6 }, { col: 2, row: 7 }).valid).toBe(
      true,
    );
    expect(db.resources.movesLeft).toBe(0);
    expect(db.resources.phase).toBe('lost');
    // A finished level takes no more swaps.
    const before = readBoard(db);
    expect(applySwap(db, { col: 0, row: 0 }, { col: 1, row: 0 }).valid).toBe(
      false,
    );
    expect(readBoard(db)).toEqual(before);
  });
});

describe('run total and stars', () => {
  it('banks a won level and restarts keep the bank', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, level: 0, entry: 'fresh' });
    db.transactions.addScore({ points: 500 });
    db.transactions.startRun({ seed: 2, level: 1, entry: 'next' });
    expect(db.resources.bankedScore).toBe(500);
    db.transactions.addScore({ points: 200 });
    db.transactions.startRun({ seed: 2, level: 1, entry: 'restart' });
    expect(db.resources.bankedScore).toBe(500);
    expect(db.resources.score).toBe(0);
    db.transactions.startRun({ seed: 1, level: 0, entry: 'next' });
    expect(db.resources.bankedScore).toBe(0);
  });

  it('gives 1–3 stars from thresholds', () => {
    expect(starsFor(100)).toBe(1);
    expect(starsFor(11999)).toBe(1);
    expect(starsFor(12000)).toBe(2);
    expect(starsFor(16000)).toBe(3);
  });
});
