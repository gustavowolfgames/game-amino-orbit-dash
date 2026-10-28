# What breaks the game

## When

Open this recipe when you are about to touch input (tap, swipe, keyboard), rendering, animation, files under `src/core/`, or package install.

## Do

### DOM stays in screens

After the GPU starts, draw gameplay with Pixi. DOM is for the Solid screen shells in `src/game/screens/`, app wiring in `src/game/setup/`, and brand theming (CSS variables, font loading) in `src/game/brand/`. **Anywhere else under `src/game/`** (whatever you name the game folder) do not create elements, set `element.style`, use CSS transitions, or add `window` or `document` listeners.

### Input

- **Taps and swipes** go through Pixi: `eventMode = 'static'` on the hit target, `'passive'` on its parents, and `pointerdown` / `pointermove` handlers. Use `pointerdown`, not `pointertap`, for taps: `pointertap` drops a tap with the slightest drag or a fast double tap (`src/game/mygame/input/pointer.ts`). Setup is in `.agents/skills/pixi-gameplay/SKILL.md`.
- **Keyboard** is DOM, so it lives in a Solid screen such as `src/game/screens/GameScreen.tsx`: a `keydown` listener added in `onMount` and removed in `onCleanup`. It maps keys to intents and passes them to the controller, which calls a transaction or queues the intent. The template ships this as `useGameKeyboard` (`src/game/screens/useGameKeyboard.ts`): arrows, WASD, Enter and Space become a `GameIntent` for `controller.input`, Escape and P pause, and nothing fires while the settings menu is open. Change its key map and the `GameIntent` union in `src/game/mygame-contract.ts` for the game. Space never reaches the scaffold's pause toggle during play (it would pause on every press); `bun run check:agent` fails if `GameScreen.tsx` stops calling `useGameKeyboard` or `useSpaceKey`.
- Either way, input calls a transaction, or queues an intent that a system applies on the next step (taps: `bindTapInput` in `src/game/mygame/input/pointer.ts`). Input never writes state directly.

### Animation and lifetime

Kill GSAP tweens of a sprite before you remove it and destroy it. Destroy children after the tween is dead.

Do not drive gameplay with `requestAnimationFrame`, `setInterval`, or `setTimeout`. Use the cadence in `.agents/recipes/ecs.md`. For delays use `gsap.delayedCall`.

### Audio: art first, music last, nothing waits for it

Browsers keep audio locked until the player's first tap or key press, so nothing plays on the loading screen or the title before that tap. Do not plan or generate music or sound for them.

- **Loading order.** The loader and the title wait for art only. Audio loads last, in the background, through `loadAudioInBackground` (`src/game/setup/audioLoad.ts`). Never `await` an audio load before a screen shows: a big track on a slow phone held the Play button about 10 seconds, and with no tap yet the components Howler loader stalls between sounds until there is one.
- **The game starts the music, not a button.** The game screen calls `audio.music(id)` when its scene is up. `gameAudio` plays the track once its file has loaded and the first tap has unlocked audio, whichever comes last. The same code covers the title's Play tap, `?screen=game` and a Vault launch (`src/game/screens/unlockAudioOnFirstTap.ts` unlocks on the first tap on the board).
- **Unlock inside the tap.** Call `unlockAudio()` in the tap's own handler, not after an animation: iOS Safari only lets a gesture's handler resume audio.

### One renderer

The game draws with Pixi, on the one canvas the scaffold owns. Do not add a second `<canvas>`, a second engine (Phaser, Three.js), or a hand-built WebGL context; custom shapes are Pixi `Graphics`. The one exception is `gameMode: 'layered'` in `src/game/mygame-contract.ts`: an opt-in extra GPU layer (a 3D layer, an embedded 3D widget) that the controller creates, tears down in reverse order, and draws only as a read-only view of the same ECS world, never a second game-state store.

### Repo boundaries

Do not edit `src/core/`. It is scaffold synced from template-amino-ecs-pure with `bun run amino:sync`, which also overwrites `.agents/recipes/` and `.agents/skills/`. If the scaffold lacks something, keep the change in `src/game/` or raise it on template-amino-ecs-pure.

Install with bun. Do not commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. Do not add a `postinstall` or `predev` step that writes rules or agent files.

Screens sit on the design canvas. Do not use `100vh`, `window.innerHeight`, or `position: fixed` in a screen. The layout rules are in `.agents/recipes/components.md`.

Keep the game controller thin. That rule is `.agents/skills/game-controller/SKILL.md`. Pixi performance rules are in `.agents/skills/pixi-gameplay/SKILL.md`.

## Verify

`bun run check:agent` passes: it fails on DOM or timer calls in game code outside `src/game/screens/`. `bun run typecheck:baseline` passes. An input or render change also gets `bun run test:e2e`.

## Example

The ECS boundary is `src/game/mygame/world.ts`. The DOM boundary is `src/game/screens/`. The install boundary is the `postinstall` script in `package.json`.
