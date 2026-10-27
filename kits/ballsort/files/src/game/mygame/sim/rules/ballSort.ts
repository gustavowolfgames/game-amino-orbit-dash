/**
 * ballSort — the rules of ball sort as pure functions over a plain board.
 *
 * A board is one array per tube, bottom ball first, each ball a colour index.
 * No ECS, no Pixi, no randomness of its own: `generateBoard` takes a seed and
 * advances its own copy of the LCG from `../rng.ts`.
 */

import { nextRng, rngFloat } from '../rng';

/** Balls a tube holds. Also the number of balls of each colour. */
export const TUBE_CAPACITY = 4;
/** Empty tubes added to every level on top of one full tube per colour. */
export const EMPTY_TUBES = 2;
/** Undos a level allows. */
export const UNDOS_PER_LEVEL = 3;

export type Board = readonly (readonly number[])[];

export interface Move {
  from: number;
  to: number;
}

const top = (tube: readonly number[]) => tube[tube.length - 1];

/** A drop is legal onto an empty tube, or onto the same colour with room left. */
export function canDrop(board: Board, from: number, to: number): boolean {
  const src = board[from];
  const dst = board[to];
  if (!src || !dst || from === to || src.length === 0) return false;
  if (dst.length >= TUBE_CAPACITY) return false;
  return dst.length === 0 || top(dst) === top(src);
}

/** The board after moving the top ball of `from` onto `to` (no legality check). */
export function applyMove(board: Board, { from, to }: Move): number[][] {
  const next = board.map((t) => [...t]);
  const ball = next[from].pop();
  if (ball !== undefined) next[to].push(ball);
  return next;
}

/** Four balls of one colour. */
export function isTubeComplete(tube: readonly number[]): boolean {
  return (
    tube.length === TUBE_CAPACITY && tube.every((ball) => ball === tube[0])
  );
}

/** Won when every tube is empty or complete. */
export function isWon(board: Board): boolean {
  return board.every((t) => t.length === 0 || isTubeComplete(t));
}

/** Every legal move on the board. */
export function legalMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < board.length; from++)
    for (let to = 0; to < board.length; to++)
      if (canDrop(board, from, to)) moves.push({ from, to });
  return moves;
}

export function hasLegalMove(board: Board): boolean {
  for (let from = 0; from < board.length; from++)
    for (let to = 0; to < board.length; to++)
      if (canDrop(board, from, to)) return true;
  return false;
}

/** Order-independent key: two boards with the same tubes in any order are one state. */
const stateKey = (board: Board) =>
  board
    .map((t) => t.join(','))
    .sort()
    .join('|');

/**
 * A solution (list of moves) from `board`, or null when there is none.
 * Depth-first with a visited set; prunes moves that cannot help (moving a
 * complete tube, moving a single-colour tube into an empty one).
 */
export function solve(board: Board, maxStates = 200_000): Move[] | null {
  const seen = new Set<string>();
  const path: Move[] = [];
  const dfs = (b: number[][]): boolean => {
    if (isWon(b)) return true;
    const key = stateKey(b);
    if (seen.has(key) || seen.size >= maxStates) return false;
    seen.add(key);
    const candidates = legalMoves(b).filter(({ from, to }) => {
      const src = b[from];
      if (isTubeComplete(src)) return false;
      const uniform = src.every((ball) => ball === src[0]);
      return !(uniform && b[to].length === 0);
    });
    // Moves onto a matching colour first: they make progress.
    candidates.sort((m1, m2) => b[m2.to].length - b[m1.to].length);
    for (const m of candidates) {
      path.push(m);
      if (dfs(applyMove(b, m))) return true;
      path.pop();
    }
    return false;
  };
  return dfs(board.map((t) => [...t])) ? path : null;
}

/**
 * A level's start: `colors` full tubes of mixed balls plus `EMPTY_TUBES` empty
 * ones, shuffled from `seed`. A layout is kept only when no tube starts complete
 * and the solver finds a solution, so every level it returns is solvable.
 */
export function generateBoard(seed: number, colors: number): number[][] {
  let state = seed >>> 0;
  for (let attempt = 0; ; attempt++) {
    const balls: number[] = [];
    for (let c = 0; c < colors; c++)
      for (let i = 0; i < TUBE_CAPACITY; i++) balls.push(c);
    // Fisher–Yates on the seeded LCG.
    for (let i = balls.length - 1; i > 0; i--) {
      state = nextRng(state);
      const j = Math.floor(rngFloat(state) * (i + 1));
      [balls[i], balls[j]] = [balls[j], balls[i]];
    }
    const board: number[][] = [];
    for (let c = 0; c < colors; c++)
      board.push(balls.slice(c * TUBE_CAPACITY, (c + 1) * TUBE_CAPACITY));
    for (let e = 0; e < EMPTY_TUBES; e++) board.push([]);
    if (!board.some(isTubeComplete) && solve(board)) return board;
    if (attempt > 1000)
      throw new Error(`no solvable layout for seed ${seed}, ${colors} colours`);
  }
}

/** Stars for a run: 3 at or under par, 2 within half again, else 1. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3;
  if (moves <= par * 1.5) return 2;
  return 1;
}
