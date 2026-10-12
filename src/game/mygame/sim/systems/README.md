# systems: what changes each step

One file per system. A system is `(db: GameDatabase) => void`: it reads the
world and changes it only through transactions. No Pixi, no DOM, no
`Math.random()`. Time is `db.resources.frameDeltaMs`, the fixed step.

```ts
// check: systemGoal.ts
import type { GameDatabase } from '../plugin';

/** Order: last. Reads score and goal. Writes phase: the level is won at its goal. */
export function systemGoal(db: GameDatabase): void {
  const { phase, goal, score } = db.resources;
  if (phase === 'playing' && goal > 0 && score >= goal) {
    db.transactions.setPhase('won');
  }
}
```

Input arrives as queued taps. The system that resolves them runs first and
clears the queue:

```ts
// check: systemTaps.ts
import type { GameDatabase } from '../plugin';

/**
 * Order: first. Reads pendingTaps (design space). Clears them once resolved.
 * This one scores a point per tap; a game finds what is under each tap
 * (`tap.x`, `tap.y`) and calls the transaction for it.
 */
export function systemTaps(db: GameDatabase): void {
  const taps = db.resources.pendingTaps;
  if (taps.length === 0) return;
  db.transactions.addScore({ points: taps.length });
  db.transactions.clearTaps();
}
```

Register every system in `index.ts`, in order. Order is contract: a system can
rely on what an earlier one wrote this step.

```ts
export const SYSTEM_ORDER = [systemTaps, systemGoal];
```

A turn-based game (nothing moves until the player acts) can skip the frame loop:
resolve the turn in a transaction called from input, and leave `SYSTEM_ORDER`
empty.
