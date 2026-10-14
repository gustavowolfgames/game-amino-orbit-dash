# .agents/

Hand-written agent notes. Nothing here is generated on install, and agents do not load this directory up front.

- `recipes/` holds what `AGENTS.md` opens, one file per task. Each has When, Do, Verify, and Example.
- `skills/` holds the longer Pixi and controller guidance the recipes point at.
- `specs/` is where a large feature plan goes. Copy `specs/SPEC.template.md` to `specs/<feature>.md`.
- `decisions.tsv` logs each structural change to this repo with its evidence.

## Harnesses

`AGENTS.md` is the one agent instruction file. `CLAUDE.md` only imports it with `@AGENTS.md`, because Claude Code loads `CLAUDE.md` (not `AGENTS.md`) on every turn. Both are tracked, plain files: nothing generates them, and nothing runs on `bun install` or `bun run dev` to write rules, skills or agent files.

`.claude/settings.json` sets permissions only. It denies edits to `src/core/` and reads of real env files.

Project instructions belong in a recipe. The recipes' own skills (`.agents/skills/`) are tracked files too.

`.agents/recipes/systems.md` (the `@wolfgames/game-systems` catalog steer) is opt-in: to load it every turn, add `@.agents/recipes/systems.md` to `CLAUDE.md` and `bun add @wolfgames/game-systems`.

Why recipes: in aminoBench A/Bs on ClearPop and Tetris (ENG-4734), recipes built the same games about 19% cheaper than an always-on rule pack, with equal build and test results. Recipes v2 (ENG-4735) adds the always-on core and the checks that close the code-quality gaps that audit found.

## Keeping it slim

`bun run check:agent` runs `scripts/check-agent-surface.mjs`: no DOM or timers in game code outside `src/game/screens/`, no orb-sample leftovers once a new game exists, a thin game controller, `CLAUDE.md` importing `AGENTS.md` with no install or dev step writing agent files, and every path a recipe cites exists. The limits live at the top of that script. Change a rule there, not in a doc. `bun run typecheck:baseline` guards the inherited type errors in `scripts/typecheck-baseline.txt`.
