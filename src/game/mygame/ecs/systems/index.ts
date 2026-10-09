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
import { systemInput } from './systemInput';
import { systemMovement } from './systemMovement';
import { systemOrbit } from './systemOrbit';

export { systemInput, systemMovement, systemOrbit };

/**
 * Per-frame systems, in execution order:
 *   1. systemInput    — drain queued taps → spawn a mover / collect an orbiter
 *   2. systemMovement — integrate mover velocity (+ wall bounce)
 *   3. systemOrbit    — advance the orbiter ring
 * Input runs first so this step's spawns/collects are reflected immediately.
 */
export const SYSTEM_ORDER: ReadonlyArray<(db: GameDatabase) => void> = [
  systemInput,
  systemMovement,
  systemOrbit,
];
