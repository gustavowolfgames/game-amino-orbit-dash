/**
 * readStateFromEcs — plain snapshots of the world for pure logic, systems, the
 * renderer, the agent surface, and tests.
 *
 * ECS is the source of truth; consumers read a plain object so they never touch
 * the database internals. The parameter is a structural `EcsStateSource`,
 * satisfied by both the live `Database` and a transaction `store`, so the same
 * readers work inside systems, tests, and the renderer. A game adds one reader
 * per archetype next to this one (`readPieces(db)` returning `{ entity, ... }[]`).
 */

import type { GamePhase } from './plugin';
import { BOARD_SIZE, type Board, indexOf } from './rules/board';

/** Whole-run snapshot. */
export interface GameSnapshot {
  level: number;
  goal: number;
  score: number;
  phase: GamePhase;
  elapsedMs: number;
}

/**
 * Minimal read surface a snapshot needs. The @adobe/data `Database` and
 * transaction `store` both satisfy it structurally.
 */
export interface EcsStateSource {
  readonly resources: {
    readonly level: number;
    readonly goal: number;
    readonly score: number;
    readonly phase: GamePhase;
    readonly elapsedMs: number;
  };
}

/** Rebuild a full snapshot from the current ECS state. */
export function readStateFromEcs(source: EcsStateSource): GameSnapshot {
  const { level, goal, score, phase, elapsedMs } = source.resources;
  return { level, goal, score, phase, elapsedMs };
}

/** One tile entity as plain data. */
export interface TileSnapshot {
  col: number;
  row: number;
  color: number;
}

/** Read surface for tiles: the live `Database` and a transaction `store` both fit. */
export interface TileSource {
  select(components: ['col', 'row', 'color']): Iterable<number>;
  read(entity: number): { col?: number; row?: number; color?: number } | null;
}

/** Every tile entity, as plain data (unordered). */
export function readTiles(source: TileSource): TileSnapshot[] {
  const out: TileSnapshot[] = [];
  for (const e of source.select(['col', 'row', 'color'])) {
    const t = source.read(e);
    if (t?.col === undefined || t.row === undefined || t.color === undefined)
      continue;
    out.push({ col: t.col, row: t.row, color: t.color });
  }
  return out;
}

/** The tiles as a flat row-major board (`rules/board.ts`); -1 where no tile is. */
export function readBoard(source: TileSource): Board {
  const board: Board = new Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  for (const t of readTiles(source)) board[indexOf(t.col, t.row)] = t.color;
  return board;
}
