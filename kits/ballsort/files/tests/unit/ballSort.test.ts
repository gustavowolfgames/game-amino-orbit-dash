/**
 * Ball sort sim: the pure rules (src/game/mygame/sim/rules/ballSort.ts) and the
 * transactions that apply them to the ECS world. Headless: no engine, no screen.
 */

import { describe, expect, it } from 'vitest';
import { BUNDLED_PACK, packLevels, parseLevel } from '~/game/content';
import { drainEvents } from '~/game/mygame/sim/events';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { readBalls, readBoard } from '~/game/mygame/sim/readBoard';
import {
  applyMove,
  canDrop,
  EMPTY_TUBES,
  generateBoard,
  hasLegalMove,
  isTubeComplete,
  isWon,
  type Move,
  solve,
  starsFor,
  TUBE_CAPACITY,
  UNDOS_PER_LEVEL,
} from '~/game/mygame/sim/rules/ballSort';
import {
  ballPosition,
  neighborTube,
  tubeRects,
} from '~/game/mygame/sim/rules/layout';

/** Replay a solution with the legality check on every move; true if it ends won. */
function replays(board: number[][], moves: Move[]): boolean {
  let b = board;
  for (const m of moves) {
    if (!canDrop(b, m.from, m.to)) return false;
    b = applyMove(b, m);
  }
  return isWon(b);
}

/** First legal move, then first illegal (non-noop) pair, on a board. */
function firstLegal(board: number[][]): Move {
  for (let from = 0; from < board.length; from++)
    for (let to = 0; to < board.length; to++)
      if (canDrop(board, from, to)) return { from, to };
  throw new Error('no legal move');
}
function firstIllegal(board: number[][]): Move {
  for (let from = 0; from < board.length; from++)
    for (let to = 0; to < board.length; to++)
      if (from !== to && board[from].length > 0 && !canDrop(board, from, to))
        return { from, to };
  throw new Error('no illegal move');
}

describe('rules', () => {
  it('allows a drop onto an empty tube or the same colour with room', () => {
    const board = [[0, 1], [1], [], [2, 2, 2, 1]];
    expect(canDrop(board, 0, 1)).toBe(true); // 1 onto 1
    expect(canDrop(board, 0, 2)).toBe(true); // onto empty
  });

  it('rejects an illegal drop: other colour, full tube, same tube, empty source', () => {
    const board = [[0, 1], [0], [], [1, 1, 1, 1]];
    expect(canDrop(board, 0, 1)).toBe(false); // 1 onto 0
    expect(canDrop(board, 1, 3)).toBe(false); // full
    expect(canDrop(board, 0, 0)).toBe(false); // same tube
    expect(canDrop(board, 2, 0)).toBe(false); // nothing to move
  });

  it('wins only when every tube is empty or complete', () => {
    expect(isWon([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
    expect(isWon([[0, 0, 0], [0], [1, 1, 1, 1]])).toBe(false);
    expect(
      isWon([
        [0, 0, 0, 1],
        [1, 1, 1, 0],
      ]),
    ).toBe(false);
    expect(isTubeComplete([2, 2, 2, 2])).toBe(true);
    expect(isTubeComplete([2, 2, 2])).toBe(false);
  });

  it('detects a board with no legal move left', () => {
    expect(
      hasLegalMove([
        [0, 1, 0, 1],
        [1, 0, 1, 0],
      ]),
    ).toBe(false);
    expect(
      hasLegalMove([
        [0, 1, 0, 1],
        [1, 0, 1],
      ]),
    ).toBe(true);
  });

  it('gives 3 stars at par, 2 within half again, else 1', () => {
    expect(starsFor(70, 74)).toBe(3);
    expect(starsFor(100, 74)).toBe(2);
    expect(starsFor(200, 74)).toBe(1);
  });
});

describe('level generation', () => {
  const levels = packLevels(BUNDLED_PACK).map((l) => parseLevel(l));

  it('ships three levels of 4, 5 and 7 colours', () => {
    expect(levels.map((l) => l?.colors)).toEqual([4, 5, 7]);
  });

  it('every generated level is solvable, mixed and has 2 empty tubes', () => {
    for (const level of levels) {
      if (!level) throw new Error('bundled level failed to parse');
      const board = generateBoard(level.seed, level.colors);
      expect(board).toHaveLength(level.colors + EMPTY_TUBES);
      expect(board.filter((t) => t.length === 0)).toHaveLength(EMPTY_TUBES);
      for (let c = 0; c < level.colors; c++)
        expect(board.flat().filter((b) => b === c)).toHaveLength(TUBE_CAPACITY);
      expect(board.some(isTubeComplete)).toBe(false);
      const solution = solve(board);
      expect(solution).not.toBeNull();
      expect(replays(board, solution ?? [])).toBe(true);
    }
  });

  it('is solvable across many seeds and replays exactly from its seed', () => {
    for (const colors of [4, 5, 7])
      for (let seed = 1; seed <= 30; seed++) {
        const board = generateBoard(seed, colors);
        expect(replays(board, solve(board) ?? [])).toBe(true);
        expect(generateBoard(seed, colors)).toEqual(board);
      }
  });
});

describe('ECS transactions', () => {
  const start = (seed = 2, colors = 5) => {
    const db = createGameWorld();
    db.transactions.startRun({ seed, colors, par: 20, level: 0 });
    return db;
  };

  it('startRun lays out the generated board as Ball entities', () => {
    const db = start();
    expect(readBoard(db)).toEqual(generateBoard(2, 5));
    expect(readBalls(db)).toHaveLength(5 * TUBE_CAPACITY);
    expect(db.resources.undosLeft).toBe(UNDOS_PER_LEVEL);
    expect(db.resources.phase).toBe('playing');
  });

  it('lifts on the first tap and puts back on the same tube', () => {
    const db = start();
    db.transactions.tapTube({ tube: 0 });
    expect(db.resources.heldTube).toBe(0);
    db.transactions.tapTube({ tube: 0 });
    expect(db.resources.heldTube).toBe(-1);
    expect(db.resources.moves).toBe(0);
  });

  it('does not lift from an empty tube', () => {
    const db = start();
    const empty = readBoard(db).findIndex((t) => t.length === 0);
    db.transactions.tapTube({ tube: empty });
    expect(db.resources.heldTube).toBe(-1);
  });

  it('rejects an illegal drop: the ball goes back and nothing else changes', () => {
    const db = start();
    const before = readBoard(db);
    const { from, to } = firstIllegal(before);
    db.transactions.tapTube({ tube: from });
    db.transactions.tapTube({ tube: to });
    expect(readBoard(db)).toEqual(before);
    expect(db.resources.heldTube).toBe(-1);
    expect(db.resources.moves).toBe(0);
    expect(db.resources.history).toEqual([]);
  });

  it('applies a legal drop and counts the move', () => {
    const db = start();
    const before = readBoard(db);
    const move = firstLegal(before);
    db.transactions.tapTube({ tube: move.from });
    db.transactions.tapTube({ tube: move.to });
    expect(readBoard(db)).toEqual(applyMove(before, move));
    expect(db.resources.moves).toBe(1);
  });

  it('undo restores the previous state, at most 3 times per level', () => {
    const db = start();
    const boards = [readBoard(db)];
    for (let i = 0; i < 4; i++) {
      const move = firstLegal(boards[boards.length - 1]);
      db.transactions.tapTube({ tube: move.from });
      db.transactions.tapTube({ tube: move.to });
      boards.push(readBoard(db));
    }
    expect(db.resources.moves).toBe(4);
    for (let i = 3; i >= 1; i--) {
      db.transactions.undo();
      expect(readBoard(db)).toEqual(boards[i]);
      expect(db.resources.moves).toBe(i);
    }
    expect(db.resources.undosLeft).toBe(0);
    db.transactions.undo(); // none left
    expect(readBoard(db)).toEqual(boards[1]);
    expect(db.resources.moves).toBe(1);
  });

  it('restart rebuilds the level from its seed and refills undos', () => {
    const db = start();
    const initial = readBoard(db);
    const move = firstLegal(initial);
    db.transactions.tapTube({ tube: move.from });
    db.transactions.tapTube({ tube: move.to });
    db.transactions.undo();
    db.transactions.restartLevel();
    expect(readBoard(db)).toEqual(initial);
    expect(db.resources.moves).toBe(0);
    expect(db.resources.undosLeft).toBe(UNDOS_PER_LEVEL);
  });

  it('wins when the solution is played, marks tubes done and adds to the run total', () => {
    const db = start();
    const solution = solve(readBoard(db)) ?? [];
    for (const { from, to } of solution) {
      db.transactions.tapTube({ tube: from });
      db.transactions.tapTube({ tube: to });
    }
    expect(isWon(readBoard(db))).toBe(true);
    expect(db.resources.phase).toBe('won');
    expect(db.resources.runMoves).toBe(solution.length);
    expect(db.resources.runPar).toBe(20);
    const done = [...db.select(['tubeIndex', 'done'])].filter(
      (e) => db.read(e, ['done'])?.done,
    );
    expect(done).toHaveLength(5);
    // Input after the win is ignored.
    db.transactions.tapTube({ tube: 0 });
    expect(db.resources.heldTube).toBe(-1);
  });
});

describe('events', () => {
  it('reports a lift, a legal move and an illegal drop', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 2, colors: 5, level: 0 });
    drainEvents(db);
    const board = readBoard(db);
    const move = firstLegal(board);
    db.transactions.tapTube({ tube: move.from });
    db.transactions.tapTube({ tube: move.to });
    expect(drainEvents(db)).toEqual([
      { type: 'lifted', tube: move.from },
      { type: 'moved', from: move.from, to: move.to, moves: 1 },
    ]);
    const bad = firstIllegal(readBoard(db));
    db.transactions.tapTube({ tube: bad.from });
    db.transactions.tapTube({ tube: bad.to });
    expect(drainEvents(db)).toEqual([
      { type: 'lifted', tube: bad.from },
      { type: 'putBack', tube: bad.from, illegal: true },
    ]);
  });

  it('reports each sorted tube and the win once', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, colors: 4, level: 0 });
    for (const { from, to } of solve(readBoard(db)) ?? []) {
      db.transactions.tapTube({ tube: from });
      db.transactions.tapTube({ tube: to });
    }
    const events = drainEvents(db);
    expect(events.filter((e) => e.type === 'tubeDone')).toHaveLength(4);
    expect(events.filter((e) => e.type === 'phase')).toEqual([
      { type: 'phase', phase: 'won' },
    ]);
    expect(events[events.length - 1]).toEqual({ type: 'phase', phase: 'won' });
  });
});

describe('stuck', () => {
  it('reports a board with no legal move once, blocks taps, and a restart clears it', () => {
    const db = createGameWorld();
    // Seed 3, 4 colours: three moves out of tube 2 leave no legal move.
    db.transactions.startRun({ seed: 3, colors: 4, level: 0 });
    for (const { from, to } of [
      { from: 2, to: 4 },
      { from: 2, to: 5 },
      { from: 2, to: 4 },
    ]) {
      db.transactions.tapTube({ tube: from });
      db.transactions.tapTube({ tube: to });
    }
    expect(hasLegalMove(readBoard(db))).toBe(false);
    expect(db.resources.stuck).toBe(true);
    expect(db.resources.phase).toBe('playing');
    const events = drainEvents(db);
    expect(events.filter((e) => e.type === 'stuck')).toEqual([
      { type: 'stuck', moves: 3 },
    ]);
    db.transactions.tapTube({ tube: 0 }); // ignored while stuck
    expect(db.resources.heldTube).toBe(-1);
    db.transactions.restartLevel(); // the Retry button
    expect(db.resources.stuck).toBe(false);
    expect(readBoard(db)).toEqual(generateBoard(3, 4));
  });

  it('an undo out of a stuck board clears it', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 3, colors: 4, level: 0 });
    for (const { from, to } of [
      { from: 2, to: 4 },
      { from: 2, to: 5 },
      { from: 2, to: 4 },
    ]) {
      db.transactions.tapTube({ tube: from });
      db.transactions.tapTube({ tube: to });
    }
    expect(db.resources.stuck).toBe(true);
    db.transactions.undo();
    expect(db.resources.stuck).toBe(false);
  });
});

describe('input', () => {
  it('turns a tap on a tube into a lift and a drop, and ignores a miss', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, colors: 4, level: 0 });
    const board = readBoard(db);
    const rects = tubeRects(db.resources.tubeCount);
    const move = firstLegal(board);
    const at = (tube: number) => ballPosition(rects[tube], 0);
    db.transactions.tap({ x: 5, y: 5 });
    expect(db.resources.heldTube).toBe(-1);
    db.transactions.tap(at(move.from));
    expect(db.resources.heldTube).toBe(move.from);
    db.transactions.tap(at(move.to));
    expect(db.resources.moves).toBe(1);
    expect(readBoard(db)).toEqual(applyMove(board, move));
  });

  it('every tube is hit by a tap on its balls, on the design canvas', () => {
    for (const count of [6, 7, 9]) {
      const rects = tubeRects(count);
      const db = createGameWorld();
      db.transactions.startRun({ seed: 1, colors: count - EMPTY_TUBES });
      const board = readBoard(db);
      rects.forEach((r, tube) => {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(390);
        expect(r.y + r.h).toBeLessThanOrEqual(844 - 140); // clear of the buttons
        for (let slot = 0; slot < TUBE_CAPACITY; slot++) {
          db.transactions.tap(ballPosition(r, slot));
          const full = board[tube].length > 0;
          expect(db.resources.heldTube).toBe(full ? tube : -1);
          if (full) db.transactions.tapTube({ tube }); // put it back
        }
      });
    }
  });

  it('keyboard: arrows move the cursor, action taps the tube under it', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, colors: 4, level: 0 });
    expect(db.resources.cursor).toBe(-1);
    db.transactions.pressCursor(); // first press shows the cursor on tube 0
    expect(db.resources.cursor).toBe(0);
    expect(db.resources.heldTube).toBe(-1);
    db.transactions.pressCursor(); // lift from tube 0
    expect(db.resources.heldTube).toBe(0);
    db.transactions.moveCursor({ dir: 'right' });
    expect(db.resources.cursor).toBe(1);
    db.transactions.moveCursor({ dir: 'left' });
    db.transactions.moveCursor({ dir: 'left' }); // clamps at 0
    expect(db.resources.cursor).toBe(0);
    db.transactions.pressCursor(); // same tube: put back
    expect(db.resources.heldTube).toBe(-1);
    expect(db.resources.moves).toBe(0);
  });

  it('cursor steps wrap rows: up / down move a whole row', () => {
    expect(neighborTube(9, 1, 'down')).toBe(6); // 5 per row
    expect(neighborTube(9, 6, 'up')).toBe(1);
    expect(neighborTube(9, 8, 'right')).toBe(8);
    expect(neighborTube(6, 2, 'down')).toBe(5); // one row: clamps
  });
});
