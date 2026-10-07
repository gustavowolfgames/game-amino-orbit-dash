# What breaks the game

## When

Open this recipe when you are about to touch rendering, animation, input, files under `src/core/`, or package install.

## Do

After the GPU starts, draw gameplay with Pixi. DOM is for Solid screen shells in `src/game/screens/` and the loading screen. Do not create elements, CSS transitions, or DOM click handlers inside `src/game/mygame/`.

Kill GSAP tweens of a sprite before you remove it and destroy it. Destroy children after the tween is dead.

Do not drive gameplay with `requestAnimationFrame`, `setInterval`, or `setTimeout`. Use the cadence in `.agents/recipes/ecs.md`.

Pointer setup is `.agents/skills/pixi-gameplay/SKILL.md`. Drawing is `.agents/recipes/pixi.md`.

Do not edit `src/core/`. It is scaffold synced from template-amino with `bun run amino:sync`. If the scaffold lacks something, keep the change in `src/game/` or raise it on template-amino.

Install with bun. Do not commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`.

Do not put `setup.mjs` on `postinstall`. That script writes harness rules on every install and will overwrite this router.

Screens sit on the design canvas. Do not use `100vh`, `window.innerHeight`, or `position: fixed` in a screen. The layout rules are in `.agents/recipes/components.md`.

Keep `src/game/mygame/screens/gameController.ts` thin. Pixi performance rules are in `.agents/skills/pixi-gameplay/SKILL.md`.

## Verify

`bun run check:agent` passes. `bun run typecheck:baseline` passes. A render change also gets `bun run test:e2e`.

## Example

The ECS boundary is `src/game/mygame/world.ts`. The install boundary is the `postinstall` script in `package.json`.
