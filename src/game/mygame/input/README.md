# input: player actions become transactions or intents

Input never changes game state itself. It turns what the player did into a
design-space value and hands it to the world.

`pointer.ts` does this for taps: `bindTapInput(app, root, onTap, accepting)`
converts a tap anywhere on the canvas to design space and calls `onTap(point)`
while `accepting()` (off while the settings menu is open or the game is
paused). The controller passes the template's example move:

```ts
bindTapInput(app, root, (p) => db.transactions.tap(p), accepting);
```

Pick the shape from the game's cadence:

- **Turn-based** (the board waits for the player): `onTap` calls the move's
  transaction directly, as above. The transaction applies the rules and
  `emit`s what happened.
- **Real-time** (things move on their own): queue the input as an intent and
  let a system resolve it on the next fixed step, so input stays on the
  deterministic timeline and a test can replay it:

```ts
// in ../sim/plugin.ts
resources: {
  pendingSwipes: { default: [] as readonly { dx: number; dy: number }[] },
},
transactions: {
  submitSwipe(store, swipe: { dx: number; dy: number }) {
    store.resources.pendingSwipes = [...store.resources.pendingSwipes, swipe];
  },
  clearSwipes(store) {
    store.resources.pendingSwipes = [];
  },
},
```

and drain it in the first system (`../sim/systems/README.md`). Clear the queue
in `startRun` too.

Pointer gestures are read here, on the Pixi stage. Keyboard keys are DOM
events, so they are wired in the Solid screen (`src/game/screens/GameScreen.tsx`)
and call the same transaction through a controller method. Game code under
`src/game/mygame/` never adds a DOM listener (`bun run check:agent` fails on one).
