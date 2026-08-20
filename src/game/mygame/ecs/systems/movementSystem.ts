/**
 * movementSystem — integrate mover velocity (the per-frame path).
 *
 * Order:  2 of 3 (after input may have spawned movers; before orbit updates)
 * Reads:  resources.frameDeltaMs, every Mover's position/velocity
 * Writes: via advanceMovers → each Mover's position (and velocity on a bounce)
 * Pure:   yes — `dt` is the injected fixed step, so a mover's path (and its wall
 *         bounces) is identical on every replay. This is the canonical "runs
 *         every frame with no input" velocity system.
 */

import type { GameDatabase } from '../gamePlugin';

export function movementSystem(db: GameDatabase): void {
  const dtSec = db.resources.frameDeltaMs / 1000;
  if (dtSec <= 0) return;
  db.transactions.advanceMovers({ dtSec });
}
