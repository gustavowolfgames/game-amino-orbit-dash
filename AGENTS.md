# AGENTS.md

This file is loaded for you. Open a recipe when the task reaches it, not all of them up front.

This game is SolidJS and Pixi 8. Gameplay state lives in the `@adobe/data` ECS world behind `getGameWorld()` in `src/game/mygame/world.ts`. Wolf packages are `@wolfgames/components` and `@wolfgames/client`. wolf-game-kit publishes assets. `bun install` must not write rules or agent files.

## Always

These hold for every change, whether or not you open a recipe.

1. **No DOM in game code.** Outside `src/game/screens/`, `src/game/setup/` and `src/game/brand/` (theming), nothing under `src/game/` touches `document`, `window` listeners, `element.style`, `requestAnimationFrame`, `setTimeout`, or `setInterval`. Keyboard and other DOM input is wired in a Solid screen and passed to the controller as intents.
2. **ECS models the world.** Grid cells, pieces, and bodies are archetype entities with a `spriteKey`. Resources hold only global values (score, phase, level, rng). State changes only inside `db.transactions`, with a seeded rng and no `Math.random`.
3. **`src/core/` is read-only.**
4. **A new game fills the skeleton.** `src/game/mygame/` has a slot for each part (`sim/`, `input/`, `render/`, `agent/`), each with a README. Build the game there, one folder, and finish with `bun run check:agent`. Follow `.agents/recipes/new-game.md`.

## Route

Match the task, then open that file.

- Building a new game in this template. Open `.agents/recipes/new-game.md`.
- A match-3 (swap tiles, clear runs, cascades). Run `bun run add-kit match3` first: it installs a working match-3 you then change. Its guide is `kits/match3/KIT.md`.
- A ball sort or tube sort (move balls between tubes until each is one colour). Run `bun run add-kit ballsort` first: it installs a working ball sort you then change. Its guide is `kits/ballsort/KIT.md`.
- Gameplay state, a turn, a score, entities, or a frame loop. Open `.agents/recipes/ecs.md`.
- Input (tap, swipe, keyboard), a leak, DOM in the game, or a "do not" rule. Open `.agents/recipes/guardrails.md`.
- A sprite, canvas HUD, transition, VFX, or other Pixi drawing. Open `.agents/recipes/pixi.md`.
- `setupGame`, a screen change, or `gameController.ts`. Open `.agents/recipes/game-controller.md`.
- A HUD, button, screen, popup, or other visible element. Open `.agents/recipes/components.md`.
- Colors, type, logos, or a partner skin. Open `.agents/recipes/reskin.md`.
- Levels, questions, cards, or a content pack. Open `.agents/recipes/content.md`.
- A daily edition, a vault schedule, or Games Manager config. Open `.agents/recipes/dynamic-data.md`.
- An analytics event. Open `.agents/recipes/analytics.md`.
- Images, audio, VFX, or the settings menu's volume and music. Open `.agents/recipes/assets.md`.
- You are about to say the change works. Open `.agents/recipes/verify.md`.

If the task changes what the game is, update `docs/GAME-DESIGN.md` in the same change.

## Wolf infra

Open `.agents/recipes/components.md` before a button, a screen, a menu, or any other visible control. Import `@wolfgames/components`.

Open `.agents/recipes/assets.md` before a picture, a sound, or an effect. Those come from the wolf-game-kit MCP. If those tools are missing, stop and name the one that is missing. Do not draw stand-in art, synthesize audio, or download a substitute, unless the task says placeholder geometry is fine.

## Commands

Install with `bun install`. Start the dev server with `bun run dev`. Before you claim success, run `bun run check:agent`, `bun run typecheck:baseline`, and `bun run test:run`. Run `bun run test:e2e` when the change touches a screen.

## Boundaries

Do not edit `src/core/`. Do not add a `postinstall` or `predev` step that writes rules or agent files. Recipes link to `docs/reference/` when a task needs more depth. Open those only from a recipe.
