# Use a catalog component

## When

Open this recipe before you add a HUD, button, menu, screen, background, popup, timer, overlay, tap target, or any other visible control. Adding one to an existing screen counts. A gameplay tap still writes ECS. The thing the player sees is a catalog module.

## Do

Read `node_modules/@wolfgames/components/src/modules/INDEX.md` before the first edit. It lists every module with what it does, when to use it, and its folder; the import is `@wolfgames/components/modules/<folder>`. Each module's `manifest.ts` gives its `surface`.

Pick the closest modules and read each module's `README.md` in that folder. Check its Variants section before you change how it looks. Open its `manifest.ts` and match `surface` to where the element will live. `src/game/screens/**/*.tsx` may use `dom` or `logic`. The Pixi scene may use `pixi` or `logic`.

Import from the module folder, `@wolfgames/components/modules/<Path>`. Shared APIs come from `@wolfgames/components/solid`, `/pixi`, `/core`, or `/howler`. Do not import a `renderers/` file. There is no React entry.

In the task output, name the modules you considered and why you kept or skipped each one. If you cannot name one, you have not done the check.

Use a module in this order. Use it, then pick a variant or config, then compose it. Write a new element only after those three fail. If the module lacks something the game needs, stop and tell the user what is missing and the options.

Game-specific wrappers stay in `src/game/`. Pass atlas, font, and config in. Do not copy a catalog module into the repo. To change the package itself, set `VITE_COMPONENTS_LOCAL=1` in `.env.local` with a sibling game-components checkout. `.env.example` has the flags.

### Layout

Screens are authored on one design canvas, `DESIGN_CANVAS` from `@wolfgames/components/core`. Read its size from there. Do not write scale math, read `window.innerWidth`, or use `100vh` or `position: fixed` inside a screen.

A screen root uses the `design-box-span` class. GameShell passes pointer events through to the canvas, so a DOM screen that takes taps adds `pointer-events-auto`. `src/game/screens/LoadingScreen.tsx` shows both.

The full rules are section 9 of `node_modules/@wolfgames/components/docs/standards/components.md`. Code comments that cite docs/standards/components.md mean that file.

The settings menu is the catalog `settings-menu-dom` module, mounted once in `src/game/screens/components/GameSettingsMenu.tsx`. Pause and settings UI extend that, from a screen in `src/game/screens/`. Do not build a menu in `src/core/ui/`; that is scaffold.

### SolidJS mechanics (shells only — game state lives in ECS, per `ecs.md`)

The shells use SolidJS. The rules in order of how often they break things:

- Access props as properties: `props.score`. Do not destructure: `({ score })` loses reactivity.
- Use `createSignal` not `useState`. Use `createEffect` not `useEffect`. Use `createMemo` for a derived value.
- Read ECS state straight from the world: `getGameWorld().resources.score`, or subscribe to a resource observable for reactivity. Never write game state into a signal; ECS is the single source of truth and the screen only reads it.
- For complex nested shell-only state (level config, screen-local UI toggles), use `createStore` from `solid-js/store`. Not ECS.
- There is no React entry in `@wolfgames/components`. If you reach for `useState` or JSX destructuring, you are in the wrong framework.

## Verify

The task output names the catalog modules you opened. `bun run typecheck:baseline` passes. A new visible element has an import from `@wolfgames/components`. A screen change also runs `bun run test:e2e`.

## Example

`src/game/screens/LoadingScreen.tsx` shows the `design-box-span` root and `pointer-events-auto`. `src/game/screens/ResultsScreen.tsx` reads the final score from `getGameWorld()`. `src/app.tsx` mounts `GameShell` from the package.
