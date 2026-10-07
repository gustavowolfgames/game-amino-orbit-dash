# Start a new game from this copy

## When

Open this recipe right after the template is copied into a new game repo, before the first feature.

## Do

Get the Nucleo slug from the user. Do not invent one.

1. Set `gameSlug` and `gameName` in `wolf-game-kit.json`. Set `VITE_GAME_KIT_PROJECT_ID` in `.env.example` to the same slug. Assets publish under that slug, and a mismatch makes players 404. Do this before you change `src/`. If the copy kept the template's git history, `bun run check:agent` fails on any src change while the slug is still `mygame`.
2. Run `cp .env.example .env`, then `bun install`.
3. Write the new game into `docs/GAME-DESIGN.md`: the loop, win and lose, and the tuning numbers. It still describes the Spiral Pop sample.
4. Replace the sample, keep its shape. Do not rename `src/game/mygame/`. `scripts/check-agent-surface.mjs` reads `src/game/mygame/screens/gameController.ts`, `knip.config.ts` lists files under it, the Solid screens in `src/game/screens/` import from it, and the unit tests import it. A rename breaks all of those.
   - State: rewrite `src/game/mygame/ecs/gamePlugin.ts` and `src/game/mygame/ecs/systems/`. Keep `src/game/mygame/world.ts` as the one `getGameWorld()`. Follow `.agents/recipes/ecs.md`.
   - Cadence: a game that waits for the player calls a turn function from input and drops the frame loop. A game that moves on its own keeps `src/game/mygame/engine/` and `stepWorld`.
   - Rules and constants: replace `src/game/mygame/bubble/` with pure modules for the new game.
   - Controller: `src/game/mygame/screens/gameController.ts` keeps the contract in `src/game/mygame-contract.ts` and stays thin. Follow `.agents/recipes/game-controller.md`.
   - Update `tests/unit/schedule.test.ts` to the new transactions.
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

`git grep mygame` may still list the folder path `src/game/mygame/` and imports of it, `src/game/mygame-contract.ts`, the unit tests, `knip.config.ts`, `scripts/check-agent-surface.mjs`, paths in `.agents/`, comments under `src/core/`, the fixture URL in `tests/unit/assets/cdn-manifest.test.ts`, example names in `docs/` and `README.md`, and entries in `.agents/decisions.tsv`. Any other hit is a leftover to rename.

## Verify

- `bun run check:agent` prints `PASS agent surface`.
- `bun run typecheck:baseline` passes.
- `bun run test:run` and `bun run test:e2e` exit 0.
- `bun run check:assets` and `bun run check:manifest` exit 0.
- `git grep mygame` shows only the lines listed above. `wolf-game-kit.json` and `.env.example` hold the new slug.

## Example

The slug lives in `wolf-game-kit.json` and `.env.example`. The world holder is `src/game/mygame/world.ts`. The sample's model and cadence are described in `src/game/mygame/ecs/README.md`. ECS patterns beyond the rules are in `docs/reference/ecs-patterns.md`.
