/**
 * tiles — the Tile entities as plain data, for the turn function, the board
 * view, the agent surface and tests.
 *
 * ECS is the source of truth; consumers read a plain board so they never touch
 * the database internals. The parameter is a structural `TileSource`,
 * satisfied by both the live `Database` and a transaction `store`, so the same
 * readers work inside transactions, tests and the renderer.
 */

import { BOARD_SIZE, type Board, indexOf } from './rules/board';

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
