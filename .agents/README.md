# .agents/

Hand-written agent notes. Nothing here is generated on install, and agents do not load this directory up front.

- `recipes/` holds what `AGENTS.md` opens, one file per task. Each has When, Do, Verify, and Example.
- `skills/` holds the longer Pixi and controller guidance the recipes point at.
- `specs/` is where a large feature plan goes. Copy `specs/SPEC.template.md` to `specs/<feature>.md`.
- `decisions.tsv` logs each structural change to this repo with its evidence.

## Harnesses

`AGENTS.md` is the instruction file. `CLAUDE.md` imports it with `@AGENTS.md`, so Claude Code loads it on every turn without a tool call. `GEMINI.md` is a symlink to it.

`.claude/settings.json` sets permissions only. It denies edits to `src/core/` and reads of real env files.

Cortex rules are not loaded here (the package is still a dependency, but its `setup.mjs` is off `postinstall` and `predev`). The gitignored rules, commands, and skills folders under .agents and .claude were Cortex output. Do not recreate them or add a `postinstall` that writes rules. Project instructions belong in a recipe.

## Keeping it slim

`bun run check:agent` runs `scripts/check-agent-surface.mjs`: no DOM or timers in game code outside `src/game/screens/`, no orb-sample leftovers once a new game exists, a thin game controller, cortex off `postinstall`, and every path a recipe cites exists. The limits live at the top of that script. Change a rule there, not in a doc. `bun run typecheck:baseline` guards the inherited type errors in `scripts/typecheck-baseline.txt`.
