/**
 * turn — the match-3 turn function (turn-based cadence: no frame loop).
 *
 * Input calls `applySwap` with two cells. It reads the tile entities into a
 * plain board, resolves the swap with the pure rules (`./rules/board.ts`),
 * commits the result through `commitMove`, and returns the ruling so the view
 * can animate the swap (or the swap back), the clears, the falls and refills.
 */

import type { GameDatabase } from './plugin';
import { readBoard } from './readStateFromEcs';
import { type Cell, resolveSwap, type SwapRuling } from './rules/board';

/** Try swapping two cells. An invalid swap changes nothing (no move is spent). */
export function applySwap(db: GameDatabase, a: Cell, b: Cell): SwapRuling {
  const ruling = resolveSwap(readBoard(db), a, b, db.resources.rng);
  if (db.resources.phase !== 'playing') return { ...ruling, valid: false };
  if (ruling.valid) db.transactions.commitMove(ruling);
  return ruling;
}
