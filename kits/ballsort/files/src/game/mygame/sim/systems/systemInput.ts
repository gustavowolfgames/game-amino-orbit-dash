import type { GameDatabase } from '../plugin';
import { tubeAt } from '../rules/layout';

/**
 * Order: first. Reads pendingCommands and pendingTaps (design space). Resolves
 * button presses (undo, restart), then the first tap, as a tube tap. Later taps
 * in the same step are dropped: one action per step. Clears both queues.
 */
export function systemInput(db: GameDatabase): void {
  const { pendingCommands, pendingTaps } = db.resources;
  if (pendingCommands.length === 0 && pendingTaps.length === 0) return;
  if (pendingCommands.length > 0) {
    db.transactions.clearCommands();
    db.transactions.clearTaps();
    const command = pendingCommands[0];
    if (command === 'undo') db.transactions.undo();
    else db.transactions.restartLevel();
    return;
  }
  db.transactions.clearTaps();
  const tap = pendingTaps[0];
  const tube = tubeAt(tap.x, tap.y, db.resources.tubeCount);
  if (tube >= 0) db.transactions.tapTube({ tube });
}
