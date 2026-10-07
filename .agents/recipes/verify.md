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

`bun run typecheck` still reports errors inherited from template-amino. `bun run typecheck:baseline` compares them to `scripts/typecheck-baseline.txt` and fails on any new one. If it reports fewer, run `bun run typecheck:baseline -- --update` and commit the file. Do not add an error to the baseline to make a change pass.

Paste the command and the exit status. Do not say the tests passed unless you ran them in this checkout.

In dev, the backtick key toggles the ECS Inspector. What it shows is not proof of ECS state. Proof is the unit test or a value read from `getGameWorld()`.

`bun run amino:drift` reports local changes to scaffold paths. `bun run amino:verify` runs the typecheck baseline, lint, and build after `amino:sync`. Its lint step fails on Biome errors inherited from template-amino, and its build step runs `nucleo`, which needs an interactive terminal. Run them when you touched scaffold sync, not for an ordinary feature.

## Verify

`bun run check:agent` prints `PASS agent surface`. The other commands you listed exit 0.

## Example

The agent check is `scripts/check-agent-surface.mjs`. The baseline check is `scripts/typecheck-baseline.mjs`.
