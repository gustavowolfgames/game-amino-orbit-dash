# systems: what changes each step

Ball sort ships no systems: nothing moves until the player acts, so every move
resolves in a transaction called from input (`tap`, `tapTube`, `undo`,
`restartLevel`, `moveCursor`, `pressCursor` in `../plugin.ts`) and
`SYSTEM_ORDER` in `index.ts` stays empty. Add a system when something has to
happen on its own as time passes (a timer, a hint after a pause).

One file per system. A system is `(db: GameDatabase) => void`: it reads the
world and changes it only through transactions. No Pixi, no DOM, no
`Math.random()`. Time is `db.resources.frameDeltaMs`, the fixed step.

```ts
// check: systemMoveLimit.ts
import type { GameDatabase } from '../plugin';

/** Order: last. Reads moves and goal. Writes phase: a level with a goal is lost past it. */
export function systemMoveLimit(db: GameDatabase): void {
  const { phase, goal, moves } = db.resources;
  if (phase === 'playing' && goal > 0 && moves > goal) {
    db.transactions.setPhase('lost'); // emits { type: 'phase', phase: 'lost' }
  }
}
```

A system that should be heard or seen calls a transaction that `emit`s the
event; it never leaves a counter for the controller to diff. See "Events" in
`../README.md`.

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
export const SYSTEM_ORDER = [systemSwipes, systemMove, systemMoveLimit];
```
