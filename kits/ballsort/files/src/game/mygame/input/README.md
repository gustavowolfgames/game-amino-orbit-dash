# input: player actions become transactions or intents

Input never changes game state itself. It turns what the player did into a
design-space value and hands it to the world.

`pointer.ts` does this for taps: `bindTapInput(app, root, onTap, accepting)`
converts a tap anywhere on the canvas to design space (`DESIGN_CANVAS`, 390×844,
through the `root` `DesignLayer`'s `toDesign`) and calls `onTap(point)`
while `accepting()` (off while the settings menu is open or the game is
paused, and while a ball is moving). Ball sort passes its `tap` transaction,
which hit-tests the tubes (`tubeAt` in `../sim/rules/layout.ts`) and lifts or
drops a ball:

```ts
bindTapInput(app, root, (p) => db.transactions.tap(p), accepting);
```

Pick the shape from the game's cadence:

- **Turn-based** (the board waits for the player, as in ball sort): `onTap`
  calls the move's transaction directly, as above. The transaction applies the rules and
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
events, so they are wired in the Solid screen (`src/game/screens/GameScreen.tsx`
calls `useGameKeyboard` from `src/game/screens/useGameKeyboard.ts`). Each key
reaches the controller as a typed `GameIntent` (`src/game/mygame-contract.ts`)
through `controller.input`, which calls the same transaction. In ball sort the
arrows move a tube cursor (`moveCursor`) and Space / Enter taps the tube under
it (`pressCursor`). Change the key map and the `GameIntent` union for your game. Space never toggles the scaffold pause
there; Escape and P do. Game code under
`src/game/mygame/` never adds a DOM listener (`bun run check:agent` fails on one).
