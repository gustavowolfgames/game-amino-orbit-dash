# Draw with Pixi 8

## When

Open this recipe when you draw a game screen, a sprite, a canvas HUD, a transition, or VFX.

## Do

Open `.agents/skills/pixi-gameplay/SKILL.md` and follow it. This repo is Pixi 8. Await `app.init`, append `app.canvas`, and build shapes with `.fill()` and `.stroke()`.

Textures come from `.agents/recipes/assets.md`. Rules stay in `.agents/recipes/ecs.md`. The controller file stays thin. That rule is `.agents/skills/game-controller/SKILL.md`.

A catalog component still wins for a HUD or menu. Check `.agents/recipes/components.md` before you draw a button.

## Verify

The new pixels use `pixi.js` imports from the skill. `bun run check:agent` passes. A screen change also runs `bun run test:e2e`.

## Example

`setupGame` mounts the app in `src/game/mygame/screens/gameController.ts`. Its scene lays out on `DESIGN_CANVAS` (390×844) through a `DesignLayer`, the same canvas as the title screen, per the skill. Views go in `src/game/mygame/render/`; its README shows one.
