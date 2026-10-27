/**
 * board — the match-3 rules as pure functions over a plain board copy.
 *
 * A board is a flat `number[]` of `BOARD_SIZE * BOARD_SIZE` colour indices,
 * row-major (`row * BOARD_SIZE + col`, row 0 at the top). Nothing here touches
 * ECS: the turn function (`../turn.ts`) reads the tile entities into a board,
 * resolves a swap here, and writes the result back as entities. Randomness is
 * the caller's rng state in, the next state out (`../rng.ts`).
 */

import { nextRng } from '../rng';
import { pointsFor } from './scoring';

export const BOARD_SIZE = 8;
export const COLOR_COUNT = 5;
/** Colour index → name. The level's goal colour is one of these. */
export const COLOR_NAMES = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export type Board = number[];

export interface Cell {
  col: number;
  row: number;
}

export const indexOf = (col: number, row: number) => row * BOARD_SIZE + col;
export const cellOf = (i: number): Cell => ({
  col: i % BOARD_SIZE,
  row: Math.floor(i / BOARD_SIZE),
});

/** Draw a colour in [0, COLOR_COUNT) from the rng. */
function drawColor(rng: number): { rng: number; color: number } {
  const s = nextRng(rng);
  // High bits: the LCG's low bits cycle with short periods.
  return { rng: s, color: (s >>> 16) % COLOR_COUNT };
}

export function areAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

const inBounds = (c: Cell) =>
  c.col >= 0 && c.col < BOARD_SIZE && c.row >= 0 && c.row < BOARD_SIZE;

/** Every cell index that sits in a horizontal or vertical run of 3+, ascending. */
export function findMatches(board: Board): number[] {
  const hit = new Set<number>();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; ) {
      const color = board[indexOf(col, row)];
      let end = col + 1;
      while (end < BOARD_SIZE && board[indexOf(end, row)] === color) end++;
      if (color >= 0 && end - col >= 3) {
        for (let c = col; c < end; c++) hit.add(indexOf(c, row));
      }
      col = end;
    }
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row < BOARD_SIZE; ) {
      const color = board[indexOf(col, row)];
      let end = row + 1;
      while (end < BOARD_SIZE && board[indexOf(col, end)] === color) end++;
      if (color >= 0 && end - row >= 3) {
        for (let r = row; r < end; r++) hit.add(indexOf(col, r));
      }
      row = end;
    }
  }
  return [...hit].sort((x, y) => x - y);
}

function swapped(board: Board, a: Cell, b: Cell): Board {
  const next = board.slice();
  const ia = indexOf(a.col, a.row);
  const ib = indexOf(b.col, b.row);
  [next[ia], next[ib]] = [next[ib], next[ia]];
  return next;
}

/** True when at least one adjacent swap on this board makes a match. */
export function hasAnyMove(board: Board): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const a = { col, row };
      for (const b of [
        { col: col + 1, row },
        { col, row: row + 1 },
      ]) {
        if (inBounds(b) && findMatches(swapped(board, a, b)).length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * A fresh board with no ready-made match and at least one legal move. Each cell
 * avoids the colour that would complete a run with the two cells to its left or
 * above, so the fill never needs a retry for matches; a board with no move is
 * redrawn (rare) from the advanced rng.
 */
export function generateBoard(seedState: number): {
  board: Board;
  rng: number;
} {
  let rng = seedState;
  for (;;) {
    const board: Board = new Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const banned = new Set<number>();
        if (col >= 2) {
          const l = board[indexOf(col - 1, row)];
          if (l === board[indexOf(col - 2, row)]) banned.add(l);
        }
        if (row >= 2) {
          const u = board[indexOf(col, row - 1)];
          if (u === board[indexOf(col, row - 2)]) banned.add(u);
        }
        let color: number;
        do {
          ({ rng, color } = drawColor(rng));
        } while (banned.has(color));
        board[indexOf(col, row)] = color;
      }
    }
    if (hasAnyMove(board)) return { board, rng };
  }
}

/** A tile that moved down one or more rows in a cascade step. */
export interface Fall {
  col: number;
  fromRow: number;
  toRow: number;
}

/** A new tile dropped in from above the board. `fromRow` is negative (off-board). */
export interface Spawn {
  col: number;
  fromRow: number;
  toRow: number;
  color: number;
}

/** One clear-and-fall pass of a move. `chain` is 1 for the swap's own clear. */
export interface CascadeStep {
  chain: number;
  cleared: Cell[];
  /** Colour of each cleared cell, same order as `cleared`. */
  clearedColors: number[];
  points: number;
  falls: Fall[];
  spawns: Spawn[];
}

export interface SwapRuling {
  valid: boolean;
  a: Cell;
  b: Cell;
  steps: CascadeStep[];
  /** The board once every cascade has settled (unchanged when invalid). */
  board: Board;
  rng: number;
  points: number;
  /** Tiles cleared this move, per colour index. */
  clearedByColor: number[];
  /** True when the settled board had no move and was redrawn. */
  reshuffled: boolean;
}

/**
 * Resolve one swap: if it makes no run of 3+ it is invalid and nothing changes.
 * Otherwise clear the runs, let tiles fall, fill from the top with the rng, and
 * repeat while new runs form, each pass scoring at the next chain multiplier.
 */
export function resolveSwap(
  board: Board,
  a: Cell,
  b: Cell,
  rngState: number,
): SwapRuling {
  const clearedByColor = new Array(COLOR_COUNT).fill(0);
  const invalid: SwapRuling = {
    valid: false,
    a,
    b,
    steps: [],
    board,
    rng: rngState,
    points: 0,
    clearedByColor,
    reshuffled: false,
  };
  if (!inBounds(a) || !inBounds(b) || !areAdjacent(a, b)) return invalid;

  let current = swapped(board, a, b);
  let matches = findMatches(current);
  if (matches.length === 0) return invalid;

  let rng = rngState;
  let points = 0;
  const steps: CascadeStep[] = [];
  for (let chain = 1; matches.length > 0; chain++) {
    const clearedColors = matches.map((i) => current[i]);
    for (const color of clearedColors) clearedByColor[color]++;
    const stepPoints = pointsFor(matches.length, chain);
    points += stepPoints;

    const next = current.slice();
    for (const i of matches) next[i] = -1;
    const falls: Fall[] = [];
    const spawns: Spawn[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Compact the column downward, bottom first.
      let write = BOARD_SIZE - 1;
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        const color = next[indexOf(col, row)];
        if (color < 0) continue;
        if (write !== row) {
          next[indexOf(col, write)] = color;
          next[indexOf(col, row)] = -1;
          falls.push({ col, fromRow: row, toRow: write });
        }
        write--;
      }
      // `write + 1` empty cells remain at the top: fill them from above.
      const empty = write + 1;
      for (let row = write; row >= 0; row--) {
        let color: number;
        ({ rng, color } = drawColor(rng));
        next[indexOf(col, row)] = color;
        spawns.push({ col, fromRow: row - empty, toRow: row, color });
      }
    }
    steps.push({
      chain,
      cleared: matches.map(cellOf),
      clearedColors,
      points: stepPoints,
      falls,
      spawns,
    });
    current = next;
    matches = findMatches(current);
  }

  let reshuffled = false;
  if (!hasAnyMove(current)) {
    ({ board: current, rng } = generateBoard(rng));
    reshuffled = true;
  }
  return {
    valid: true,
    a,
    b,
    steps,
    board: current,
    rng,
    points,
    clearedByColor,
    reshuffled,
  };
}
