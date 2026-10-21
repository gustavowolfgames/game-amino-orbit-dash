# Start a new game from this copy

## When

Open this recipe when you build a new game in this template: right after a copy, or when a task asks for a game.

## Do

Get the Nucleo slug from the user. Do not invent one. If the task is a local build with no slug, set `gameSlug` to `mygame` and do not publish; the assets recipe stops at `mygame`.

1. Set `gameSlug` and `gameName` in `wolf-game-kit.json`. Set `VITE_GAME_KIT_PROJECT_ID` in `.env.example` to the same slug. Assets and Dynamic Data publish under that slug, and a mismatch makes players 404. Do this before you change `src/`. Once the game has files of its own, `bun run check:agent` fails while `gameSlug` is still the template's own (`aminoecspure`). Then empty the inherited asset lockfile: set `files` to `{}` (and drop `releaseId`) in `assets/asset-manifest.cdn.json`, and the same `files` in `assets/registry.ts`. Those entries are the template's files on the template's CDN slug; under the new slug they 404 and the loader hangs. Until the game's first `assets_publish`, local dev serves `public/assets/`.
2. Run `cp .env.example .env`, then `bun install`.
3. Write the new game into `docs/GAME-DESIGN.md`: the loop, win and lose, and the tuning numbers. Its sections are empty.
4. **Fill the skeleton in `src/game/mygame/`.** There is no sample game to replace: the template runs a level of the active Content Pack and draws only a background and the HUD. Each folder says what goes in it and shows a short example in its `README.md`. **One game folder:** keep `src/game/mygame/`; the paths below say `mygame`.
   - State: add the game's components, archetypes and transactions to `src/game/mygame/sim/plugin.ts`, and build the level's starting state in `startRun`. Follow `.agents/recipes/ecs.md`.
   - Systems: one file per system in `src/game/mygame/sim/systems/`, registered in `SYSTEM_ORDER` there. A game that waits for the player can resolve turns in a transaction called from input instead, and leave `SYSTEM_ORDER` empty.
   - Rules and constants: pure functions in `src/game/mygame/sim/rules/`. Per-level numbers go in the level shape (`schemas/levels/schema.ts`), the content recipe.
   - Input: `bindTapInput` (`src/game/mygame/input/pointer.ts`) hands each tap to the example `tap` transaction. Point it at the game's move, or queue intents for a system (`src/game/mygame/input/README.md`). Replace the example `tap` in `plugin.ts`.
   - Events: declare what the game reports (`GameEvent` in `plugin.ts`) and `emit` it from transactions; sounds and screen-reader lines are rows in the controller's cue table (`src/game/mygame/screens/README.md`).
   - Rendering: one view per kind of thing in `src/game/mygame/render/`, created and updated from the controller's `render`.
   - Controller: `src/game/mygame/screens/gameController.ts` keeps the contract in `src/game/mygame-contract.ts` and stays thin. Follow `.agents/recipes/game-controller.md`.
   - Agent surface: declare the game's states and actions in `createGameAgentService` (`src/game/mygame/agent/agentPlugin.ts`).
   - Tests: add the game's transactions and systems to `tests/unit/schedule.test.ts`.
5. Tuning lives in `src/game/tuning/types.ts` (`GameTuning`, `GAME_DEFAULTS`). Team overrides go in `public/config/tuning/game.json`. Stored values load first, so clear the `tuning_game` key in the browser when the shape changes. `tuning_scaffold` holds core values. Leave it.
6. Replace the sample flags in `src/game/setup/flags.ts` (`GameFeatureFlags`, `DEFAULT_FLAGS`, validators) and the trackers in `src/game/setup/tracking.ts`. The flag cache key is `<slug>_ff_`, so it changes with the slug.
7. Put levels, questions, or cards in one pack. Follow `.agents/recipes/content.md`.
8. Build screens and HUD from catalog modules. Follow `.agents/recipes/components.md`.
9. Get art, audio, and VFX from the wolf-game-kit MCP. Follow `.agents/recipes/assets.md` and `docs/reference/asset-naming.md`. Rename the sample channel `audio-sfx-mygame` in `src/game/audio/sounds.ts` and the example bundle names in `src/game/asset-manifest.ts`.

Ship with the wolf-game-kit MCP once the verify steps pass.

1. Run `game_check_setup`, `game_check_local`, and `game_check_deploy`.
2. Run `assets_release` and commit the lockfile. Art reaches players only through a release, then a build.
3. Push the branch. Call `game_deploy` with the slug, a `release-name`, and the `source` branch or commit. Release follows the build.
4. Call `game_promote` with the slug, the release, and the `phase` (`qa`, `staging`, or `production`). Confirm production with the user.
5. If a phase breaks, call `game_rollback` with the slug and the phase.

## Verify

- `bun run check:agent` prints `PASS agent surface` (no DOM in game code, a thin controller, the game's own slug) and `PASS snippets`.
- `bun run typecheck:baseline` passes.
- `bun run test:run` and `bun run test:e2e` exit 0.
- `bun run check:assets` and `bun run check:manifest` exit 0.
- `wolf-game-kit.json` and `.env.example` hold the new slug.

## Example

The slug lives in `wolf-game-kit.json` and `.env.example`. The world holder is `src/game/mygame/world.ts`. How the world, systems and fixed step fit together is `src/game/mygame/sim/README.md`. ECS patterns beyond the rules are in `docs/reference/ecs-patterns.md`.
