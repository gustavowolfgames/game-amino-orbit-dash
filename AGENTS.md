# AGENTS.md

Load this file, then open one recipe. Leave the other recipes closed until the task matches them.

This game is SolidJS and Pixi. Gameplay state lives in the `@adobe/data` world behind `getGameWorld()`. Wolf packages you keep are `@wolfgames/components`, `@wolfgames/client`, and `@wolfgames/game-dev`, which checks `.env` at build time. Nucleo runs the dev server. wolf-game-kit publishes assets. This repo does not install Cortex. `bun install` must not write rules.

## Route

Match the task, then open that file.

- Gameplay state, a turn, a score, or a frame loop. Open `.agents/recipes/ecs.md`.
- A sprite, canvas HUD, transition, VFX, or other Pixi drawing. Open `.agents/recipes/pixi.md`.
- `setupGame`, a screen change, or `gameController.ts`. Open `.agents/recipes/game-controller.md`.
- A HUD, button, screen, popup, or other visible element. Open `.agents/recipes/components.md`.
- Colors, type, logos, or a partner skin. Open `.agents/recipes/reskin.md`.
- Levels, questions, cards, or a content pack. Open `.agents/recipes/content.md`.
- A daily edition, a vault schedule, or Games Manager config. Open `.agents/recipes/dynamic-data.md`.
- An analytics event, a PostHog hookup, or an `edition_started`/`edition_completed` wire. Open `.agents/recipes/analytics.md`.
- Images, audio, or VFX. Open `.agents/recipes/assets.md`.
- A leak, DOM in the game, or a "do not" rule. Open `.agents/recipes/guardrails.md`.
- This repo was just copied to start a new game. Open `.agents/recipes/new-game.md`.
- You are about to say the change works. Open `.agents/recipes/verify.md`.

If the task changes what the game is, update `docs/GAME-DESIGN.md` in the same change.

## Wolf infra

A new game, a feature, a button, a screen, or a picture uses Wolf infrastructure in that same change.

Open `.agents/recipes/components.md` before a button, a screen, a menu, or any other visible control. Import `@wolfgames/components`.

Open `.agents/recipes/assets.md` before a picture, a sound, or an effect. Those come from the wolf-game-kit MCP. If those tools are missing, stop and name the one that is missing. Do not draw stand-in art, synthesize audio, or download a substitute.

`@wolfgames/client` is the Games Manager client. Nucleo runs the dev server.

## Commands

Install with `bun install`. Start the dev server with `bun run dev`. Before you claim success, run `bun run check:agent`, `bun run typecheck:baseline`, and `bun run test:run`. Run `bun run test:e2e` when the change touches a screen.

## Boundaries

Do not edit `src/core/`. Do not add a Cortex dependency, and do not put `setup.mjs` back on `postinstall`. Recipes link to `docs/reference/` when a task needs more depth. Open those only from a recipe.
