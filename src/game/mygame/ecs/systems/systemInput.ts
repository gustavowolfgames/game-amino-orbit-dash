/**
 * systemInput — drain queued taps and resolve them.
 *
 * Order:  1 of 3 (first — the mover it spawns is integrated later this same step
 *         by the movement system)
 * Reads:  resources.pendingTaps, the orbiter ring (snapshot)
 * Writes: via collectOrbiter / spawnMoverSeeded
 * Pure:   yes — no Date.now/Math.random/Pixi/DOM. Input arrives as an intent
 *         resource, not a native event ("input as intent"), which is what makes
 *         the whole sim steppable in a headless test. The nearest-orbiter search
 *         is deterministic math; the spawned mover's direction/colour come from
 *         the seeded `rng` resource inside the transaction.
 */

import { COLLECT_RADIUS } from '../../demo/config';
import type { GameDatabase } from '../gamePlugin';
import { readOrbiters } from '../readStateFromEcs';

export function systemInput(db: GameDatabase): void {
  const queued = db.resources.pendingTaps;
  if (queued.length === 0) return;
  // Snapshot then clear before resolving — a tap never re-reads its own trigger.
  db.transactions.clearTaps();

  const r2 = COLLECT_RADIUS * COLLECT_RADIUS;
  for (const tap of queued) {
    // Every tap spawns a mover flying off from the tap point (spawn + move),
    // so a tap always shows something even when it misses the ring.
    db.transactions.spawnMoverSeeded({ x: tap.x, y: tap.y });

    // Collect the nearest orbiter within reach, if any.
    const orbiters = readOrbiters(db);
    let best = -1;
    let bestD = r2;
    for (let i = 0; i < orbiters.length; i++) {
      const dx = orbiters[i].position[0] - tap.x;
      const dy = orbiters[i].position[1] - tap.y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0)
      db.transactions.collectOrbiter({ entity: orbiters[best].entity });
  }
}
