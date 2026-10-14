# Start a new game from this copy

## When

Open this recipe when you build a new game in this template: right after a copy, or when a task asks for a game that is not the orb sample.

## Do

Get the Nucleo slug from the user. Do not invent one. If the task is a local build with no slug, set `gameSlug` to `mygame` and do not publish; the assets recipe stops at `mygame`.

1. Set `gameSlug` and `gameName` in `wolf-game-kit.json`. Set `VITE_GAME_KIT_PROJECT_ID` in `.env.example` to the same slug. Assets and Dynamic Data publish under that slug, and a mismatch makes players 404. Do this before you change `src/`. Once the game is no longer the sample, `bun run check:agent` fails while `gameSlug` is still the template's own (`aminoecspure`). Then empty the inherited asset lockfile: set `files` to `{}` (and drop `releaseId`) in `assets/asset-manifest.cdn.json`, and the same `files` in `assets/registry.ts`. Those entries are the template's files on the template's CDN slug; under the new slug they 404 and the loader hangs. Until the game's first `assets_publish`, local dev serves `public/assets/`.
2. Run `cp .env.example .env`, then `bun install`.
3. Write the new game into `docs/GAME-DESIGN.md`: the loop, win and lose, and the tuning numbers. It still describes the Spiral Pop sample.
4. **Replace the sample in place, then delete what you don't reuse.** The sample is the orb demo: `Orbiter` and `Mover` archetypes, `systemOrbit`, `systemMovement`, `src/game/mygame/demo/config.ts`. **One game folder, never two.** Either keep `src/game/mygame/`, or, if the task wants a game-named folder, `git mv src/game/mygame src/game/<name>` and update every importer (the Solid screens in `src/game/screens/`, `src/game/mygame-contract.ts`, `src/game/asset-manifest.ts`, `knip.config.ts`, the unit tests). Do not build the new game in a sibling folder next to the sample. The paths below say `mygame`; read them as your folder.
   - State: rewrite `src/game/mygame/ecs/gamePlugin.ts` with the new game's archetypes and resources, and `src/game/mygame/ecs/systems/` with its systems. Keep `src/game/mygame/world.ts` as the one `getGameWorld()`. Follow `.agents/recipes/ecs.md`.
   - Cadence: a game that waits for the player calls a turn function from input and drops the frame loop. A game that moves on its own keeps `src/game/mygame/engine/` and `stepWorld`.
   - Rules and constants: replace `src/game/mygame/demo/config.ts` with pure modules for the new game (`src/game/mygame/rules/`, `src/game/mygame/levels.ts`, ...). Keep `src/game/mygame/demo/rng.ts` if you want the seeded generator; move it next to the rules.
   - Rendering: replace the orb drawing in `src/game/mygame/screens/gameController.ts` and `src/game/mygame/render/` with the new game's views in sibling modules.
   - Controller: `src/game/mygame/screens/gameController.ts` keeps the contract in `src/game/mygame-contract.ts` and stays thin. Follow `.agents/recipes/game-controller.md`.
   - Agent surface: rewrite `src/game/mygame/ecs/agentPlugin.ts` with the new game's states and actions.
   - Update `tests/unit/schedule.test.ts` and `tests/unit/mygame-contract.test.ts` to the new transactions.
   - **Delete every sample file and export you no longer use.** `bun run check:agent` fails while any orb-sample code (`Orbiter`, `systemOrbit`, `systemMovement`, `ORBITER_COUNT`) is left once the new game exists.
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

`git grep -n -E 'Orbiter|systemOrbit|systemMovement|ORBITER_COUNT' src tests` must print nothing once the new game exists. `git grep mygame` may still list the folder path `src/game/mygame/` and imports of it; that is expected.

## Verify

- `bun run check:agent` prints `PASS agent surface` (no orb-sample leftovers, no DOM in game code, a thin controller).
- `bun run typecheck:baseline` passes.
- `bun run test:run` and `bun run test:e2e` exit 0.
- `bun run check:assets` and `bun run check:manifest` exit 0.
- `git grep` for the orb sample's names prints nothing. `wolf-game-kit.json` and `.env.example` hold the new slug.

## Example

The slug lives in `wolf-game-kit.json` and `.env.example`. The world holder is `src/game/mygame/world.ts`. The sample's model and cadence are described in `src/game/mygame/ecs/README.md`; rewrite that README for the new game. ECS patterns beyond the rules are in `docs/reference/ecs-patterns.md`.
