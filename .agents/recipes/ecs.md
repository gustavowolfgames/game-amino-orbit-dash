# Gameplay state in ECS

## When

Open this recipe when you add or change gameplay state, a turn, a score, a timer that changes rules, or a per-frame system.

## Do

Read and write gameplay state through `getGameWorld()` in `src/game/mygame/world.ts`.

Write that state only inside `db.transactions`. A DOM screen may read the database to render. The screen does not keep a second copy of the rules in a signal or a store.

Pick the cadence from the game.

If the board changes when the player acts, and then waits, call the turn function from that action. Do not call `stepWorld`.

If something moves every frame with no input, call `stepWorld` from `src/game/mygame/ecs/schedule.ts` through the fixed step in `src/game/mygame/engine/fixedStep.ts`. Pass a constant `dt`. Do not pass the raw frame delta.

The sample in this repo is the second kind. `src/game/mygame/ecs/README.md` describes a bubble chain that moves every frame. Trivia and sort games are the first kind.

Do not copy `createGameState` from game-amino-sort or `createSession` from game-amino-trivia-eda. Those games keep rules in Solid. This template does not.

Inside a transaction or a system, do not import Pixi, read the DOM, or call `Math.random` or `Date.now`. Pass a seeded rng in as an argument.

Do not edit `src/core/`.

Level data and other swappable content come from the pack in `.agents/recipes/content.md`. Plugin shape, computed values, and the known foot-guns are in `docs/reference/ecs-patterns.md`.

## Verify

Add a unit test that calls the transaction or the turn function and asserts the resource you changed.

Run `bun run test:run` and `bun run typecheck:baseline`.

## Example

`getGameWorld` is `src/game/mygame/world.ts`. `stepWorld` is `src/game/mygame/ecs/schedule.ts`. The fixed step is `src/game/mygame/engine/fixedStep.ts`.
