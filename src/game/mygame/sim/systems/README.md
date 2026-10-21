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
    db.transactions.setPhase('won'); // emits { type: 'phase', phase: 'won' }
  }
}
```

A system that should be heard or seen (a hit, a landing, a lap) calls a
transaction that `emit`s the event; it never leaves a counter for the
controller to diff. See "Events" in `../README.md`.

Real-time input arrives as an intent resource that the first system drains
(`../../input/README.md` shows the queue and its transaction):

```ts
/** Order: first. Resolves queued swipes, then clears them. */
export function systemSwipes(db: GameDatabase): void {
  const swipes = db.resources.pendingSwipes;
  if (swipes.length === 0) return;
  for (const s of swipes) db.transactions.movePlayer(s); // emits 'moved'
  db.transactions.clearSwipes();
}
```

Register every system in `index.ts`, in order. Order is contract: a system can
rely on what an earlier one wrote this step.

```ts
export const SYSTEM_ORDER = [systemSwipes, systemMove, systemGoal];
```

A turn-based game (nothing moves until the player acts) can skip systems:
resolve the turn in a transaction called from input, as the template's `tap`
does, and leave `SYSTEM_ORDER` empty.
