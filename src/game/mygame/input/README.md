# input: player actions become intents

Input never changes game state directly. It records what the player did, in
design-space coordinates, and a system resolves it on the next fixed step. That
keeps input on the deterministic timeline, and a test can replay the same
actions with no screen.

`pointer.ts` already does this for taps: a tap anywhere on the canvas queues
`submitTap({ x, y })` while a run is live.

A different gesture follows the same shape: a resource that queues it, a
transaction that adds to the queue, and a system that drains it.

```ts
// in ../sim/plugin.ts
resources: {
  pendingSwipes: { default: [] as { dx: number; dy: number }[] },
},
transactions: {
  submitSwipe(store, swipe: { dx: number; dy: number }) {
    store.resources.pendingSwipes = [...store.resources.pendingSwipes, swipe];
  },
},
```

Pointer gestures are read here, on the Pixi stage. Keyboard keys are DOM
events, so they are wired in the Solid screen (`src/game/screens/GameScreen.tsx`)
and call the same transaction. Game code under `src/game/mygame/` never adds a
DOM listener (`bun run check:agent` fails on one).
