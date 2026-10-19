/**
 * systems — the ordered per-frame schedule.
 *
 * `SYSTEM_ORDER` is the single, explicit list of systems `stepWorld` runs every
 * fixed step, in sequence. Order is contract: a system may depend on state
 * written by an earlier one. Each system is `(db: GameDatabase) => void`: it
 * reads ECS, calls transactions, returns nothing. `dt` is read from
 * `resources.frameDeltaMs` (injected by `stepWorld`), never from wall-clock time.
 *
 * Empty until the game adds its systems: usually an input system first (drain
 * `pendingTaps`), then movement, spawning, collisions. `./README.md` shows one.
 * A turn-based game can leave this empty and resolve turns on input instead.
 */

import type { GameDatabase } from '../plugin';

/** Per-frame systems, in execution order. */
export const SYSTEM_ORDER: ReadonlyArray<(db: GameDatabase) => void> = [];
