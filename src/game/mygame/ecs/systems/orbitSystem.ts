/**
 * orbitSystem — advance the orbiter ring (the per-frame path).
 *
 * Order:  3 of 3 (after movers integrate; a second, independent per-frame system)
 * Reads:  resources.frameDeltaMs, every Orbiter's angle/orbitSpeed/orbitRadius
 * Writes: via advanceOrbiters → each Orbiter's angle + derived position
 * Pure:   yes — the ring spins purely from the injected fixed `dt`, so it's
 *         identical on every replay. Runs every frame with no input.
 */

import type { GameDatabase } from '../gamePlugin';

export function orbitSystem(db: GameDatabase): void {
  const dtSec = db.resources.frameDeltaMs / 1000;
  if (dtSec <= 0) return;
  db.transactions.advanceOrbiters({ dtSec });
}
