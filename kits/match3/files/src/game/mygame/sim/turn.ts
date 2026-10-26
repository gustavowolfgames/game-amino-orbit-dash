/**
 * turn — the match-3 turn function (turn-based cadence: no system runs it).
 *
 * Input calls `applySwap` with two cells. It reads the tile entities into a
 * plain board (`./tiles.ts`), resolves the swap with the pure rules
 * (`./rules/board.ts`), commits the result through `commitMove` (which emits
 * `scored` / `rejected` / `phase` events), and returns the ruling so the view
 * can animate the swap (or the swap back), the clears, the falls and refills.
 */

import type { GameDatabase } from './plugin';
import { type Cell, resolveSwap, type SwapRuling } from './rules/board';
import { readBoard } from './tiles';

/** Try swapping two cells. An invalid swap changes nothing (no move is spent). */
export function applySwap(db: GameDatabase, a: Cell, b: Cell): SwapRuling {
  const ruling = resolveSwap(readBoard(db), a, b, db.resources.rng);
  if (db.resources.phase !== 'playing') return { ...ruling, valid: false };
  db.transactions.commitMove(ruling);
  return ruling;
}
