---
name: game-controller
description: Keep setupGame a thin Pixi bridge. Use when editing gameController.ts, adding a screen transition, or about to put drawing, rules, or VFX into the controller.
---

# Game controller

`setupGame` in `src/game/mygame/screens/gameController.ts` returns the contract in `src/game/mygame-contract.ts`. The contract is `init`, `destroy`, `ariaText`, and an optional `gameMode`. It defaults to `'dom'`, so a Pixi game sets `gameMode: 'pixi'`. `GameScreen` calls `init`.

The controller may do four things.

1. Call `getGameWorld()`.
2. Start Pixi's async `init` and mount `app.canvas` when it resolves. `init` in the contract returns `void`. The Pixi calls are `.agents/skills/pixi-gameplay/SKILL.md`.
3. Start `startFixedStepLoop`. The cadence is `.agents/recipes/ecs.md`.
4. Call `deps.goto` when the phase is terminal.

Drawing, hit tests, HUD text, pops, and VFX go in sibling modules next to the controller. Input calls a transaction such as `submitFire`. The render function copies ECS into display objects. It does not score, spawn rules, or pick the next level.

Sound, screen-reader text and one-shot effects come from the sim's events: `render` calls `cues(drainEvents(db), db.resources.elapsedMs)` once a frame, and the cue table (`createCues`, `src/game/mygame/screens/cues.ts`) maps each event type to a sound, a line and a hook. Audio goes through `createGameAudio` (`src/game/mygame/screens/gameAudio.ts`). Do not keep a "heard last frame" snapshot and diff counters; emit an event from the transaction instead. `src/game/mygame/screens/README.md` shows the wiring.

The template's controller is thin: the renderer, the level flow, the fixed-step loop and the HUD. Keep it that way: views go in `src/game/mygame/render/`, input in `src/game/mygame/input/`, rules in `src/game/mygame/sim/`. The same file in game-amino-sort grew to thousands of lines with audio, blur, atlas packing, image cards, and a Solid store. Do not copy it.

`scripts/check-agent-surface.mjs` fails when a new game's `gameController.ts` grows past `CONTROLLER_MAX_LINES` (400). Move the new function into a sibling module. Do not raise the cap.

Keyboard listeners do not belong here. The controller exposes an input method (`input('left')`), and a Solid screen hook in `src/game/screens/` calls it. See `.agents/recipes/guardrails.md`.

End of play stays on the game screen. A terminal phase (`won` / `lost`) goes to `src/game/mygame/screens/endOfPlay.ts`: it records the win, celebrates (flash and confetti), and after a beat brings up the end card over the board (`src/game/mygame/render/endScreen.ts`, catalog `screen-results`). Its primary button starts the next run with no screen change; Main menu is `deps.goto?.('start')`. When the Vault takes over a finished pack (`completeActivePack()` returns `'vault'`), the game shows no card. The card's text is `endCopy` in `endScreen.ts`; its stars and character are grey boxes (`ensureResultsArt`) until the game publishes a `core-results` atlas and adds its bundle to `src/game/asset-manifest.ts`. Put more end-of-run behaviour in `endOfPlay.ts`, not the controller.

Screen ids are `loading`, `start`, `game`, and `results` (`src/core/systems/screens/types.ts`). There is no `game_over`. `results` exists only because core requires it: it sends the player to the menu. `deps.goto` is typed `(screen: string) => void`, so a wrong id compiles and fails at runtime. Do not construct a second `Application` for an end screen.

Load a level with `deps.coordinator.loadBundle`. Unload the old level with `deps.coordinator.unloadBundle` only after its sprites are destroyed.

The controller owns one canvas, `app.canvas`, inside the container `init` receives. Do not touch its context or its style. Pixi's `init` is async, so `destroy` can arrive first. Guard async work with a `destroyed` flag and chain teardown on the init promise, as the sample does.

In-scene motion is `gsap` on a display object. Kill it in `destroy` before `app.destroy`.
