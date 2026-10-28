# Show that it works

## When

Open this recipe before you say a change is done, and when you wire a daily edition or a content pack.

## Do

Run the checks that match the change.

- Every change runs `bun run check:agent`, `bun run typecheck:baseline`, and `bun run test:run`.
- A screen or input change also runs `bun run test:e2e`.
- An asset change also runs `bun run check:assets` and `bun run check:manifest`. After a publish, call the `assets_verify` MCP tool with `budget: true`.
- A gameplay rule change includes a unit test that calls the transaction and asserts the new value. The ecs recipe has the rule.
- A pack change includes a test that rejects an invalid pack and loads the bundled default when the remote payload is bad. The dynamic-data recipe has the three cases.

`bun run typecheck` reports 0 errors on the template. `bun run typecheck:baseline` compares the errors to `scripts/typecheck-baseline.txt` (empty) and fails on any new one. If it reports fewer, run `bun run typecheck:baseline -- --update` and commit the file. Do not add an error to the baseline to make a change pass.

Paste the command and the exit status. Do not say the tests passed unless you ran them in this checkout.

In dev and QA builds two URL shortcuts help you look (`src/game/setup/devLinks.ts`; off for players): `?screen=results` opens the game screen with the end card already up for the level in play, and `?unlock=all` runs each save's `onUnlockAll` hook at boot (the template resumes the active pack on its last level). They show a screen; they do not replace the unit test.

In dev, the backtick key toggles the ECS Inspector. What it shows is not proof of ECS state. Proof is the unit test or a value read from `getGameWorld()`.

`bun run amino:drift` reports local changes to the template-owned paths (`src/core/`, `.agents/recipes/`, `.agents/skills/`, build configs) against template-amino-ecs-pure. `bun run amino:verify` runs the typecheck baseline, lint, and build after `amino:sync`. `bunx biome check .` reports 0 errors on the template (warnings remain). Run them when you touched scaffold sync, not for an ordinary feature.

## Verify

`bun run check:agent` prints `PASS agent surface`. The other commands you listed exit 0.

## Example

The agent check is `scripts/check-agent-surface.mjs` (DOM in game code, controller size, the agent surface, cited paths, the game's slug, Space kept off the pause toggle in `GameScreen.tsx`, no tap-sample leftovers, paths in the `src/game/mygame/` READMEs). The baseline check is `scripts/typecheck-baseline.mjs`.
