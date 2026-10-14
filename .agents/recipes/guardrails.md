# What breaks the game

## When

Open this recipe when you are about to touch input (tap, swipe, keyboard), rendering, animation, files under `src/core/`, or package install.

## Do

### DOM stays in screens

After the GPU starts, draw gameplay with Pixi. DOM is for the Solid screen shells in `src/game/screens/`, app wiring in `src/game/setup/`, and brand theming (CSS variables, font loading) in `src/game/brand/`. **Anywhere else under `src/game/`** (whatever you name the game folder) do not create elements, set `element.style`, use CSS transitions, or add `window` or `document` listeners.

### Input

- **Taps and swipes** go through Pixi: `eventMode = 'static'` on the hit target, `'passive'` on its parents, and `pointertap` / `pointerdown` / `pointermove` handlers. Setup is in `.agents/skills/pixi-gameplay/SKILL.md`.
- **Keyboard** is DOM, so it lives in a Solid screen, for example a `useGameKeyboard()` hook called from `src/game/screens/GameScreen.tsx`. It maps keys to intents and calls a controller method such as `controller.input('left')`. Add the listener in `onMount` and remove it in `onCleanup`.
- Either way, input becomes an intent that a transaction or `systemInput` applies. Input never writes state directly.

### Animation and lifetime

Kill GSAP tweens of a sprite before you remove it and destroy it. Destroy children after the tween is dead.

Do not drive gameplay with `requestAnimationFrame`, `setInterval`, or `setTimeout`. Use the cadence in `.agents/recipes/ecs.md`. For delays use `gsap.delayedCall`.

### Repo boundaries

Do not edit `src/core/`. It is scaffold synced from template-amino with `bun run amino:sync`. If the scaffold lacks something, keep the change in `src/game/` or raise it on template-amino.

Install with bun. Do not commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. Do not add a `postinstall` or `predev` step that writes rules or agent files.

Screens sit on the design canvas. Do not use `100vh`, `window.innerHeight`, or `position: fixed` in a screen. The layout rules are in `.agents/recipes/components.md`.

Keep the game controller thin. That rule is `.agents/skills/game-controller/SKILL.md`. Pixi performance rules are in `.agents/skills/pixi-gameplay/SKILL.md`.

## Verify

`bun run check:agent` passes: it fails on DOM or timer calls in game code outside `src/game/screens/`. `bun run typecheck:baseline` passes. An input or render change also gets `bun run test:e2e`.

## Example

The ECS boundary is `src/game/mygame/world.ts`. The DOM boundary is `src/game/screens/`. The install boundary is the `postinstall` script in `package.json`.
