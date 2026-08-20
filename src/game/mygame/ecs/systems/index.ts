/**
 * systems — the ordered per-frame schedule.
 *
 * `SYSTEM_ORDER` is the single, explicit list of systems `stepWorld` runs every
 * fixed step, in sequence. Order is contract: a system may depend on state
 * written by an earlier one. Each system is `(db: GameDatabase) => void`: it
 * reads ECS, calls transactions, returns nothing. `dt` is read from
 * `resources.frameDeltaMs` (injected by `stepWorld`), never from wall-clock time.
 */

import type { GameDatabase } from '../gamePlugin';
import { inputSystem } from './inputSystem';
import { movementSystem } from './movementSystem';
import { orbitSystem } from './orbitSystem';

export { inputSystem, movementSystem, orbitSystem };

/**
 * Per-frame systems, in execution order:
 *   1. inputSystem    — drain queued taps → spawn a mover / collect an orbiter
 *   2. movementSystem — integrate mover velocity (+ wall bounce)
 *   3. orbitSystem    — advance the orbiter ring
 * Input runs first so this step's spawns/collects are reflected immediately.
 */
export const SYSTEM_ORDER: ReadonlyArray<(db: GameDatabase) => void> = [
  inputSystem,
  movementSystem,
  orbitSystem,
];
