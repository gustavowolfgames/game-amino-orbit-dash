# .agents/

Hand-written agent notes. Nothing here is generated on install, and agents do not load this directory up front.

- `recipes/` holds what `AGENTS.md` opens, one file per task. Each has When, Do, Verify, and Example.
- `skills/` holds the longer Pixi and controller guidance the recipes point at.
- `specs/` is where a large feature plan goes. Copy `specs/SPEC.template.md` to `specs/<feature>.md`.
- `decisions.tsv` logs each structural change to this repo with its evidence.

## Harnesses

`AGENTS.md` is the instruction file. `CLAUDE.md` tells Claude Code to read it. `GEMINI.md` is a symlink to it. `src/game/AGENTS.md` adds the game-folder rules.

`.claude/settings.json` sets permissions only. It denies edits to `src/core/` and reads of real env files.

This repo does not install Cortex. The gitignored rules, commands, and skills folders under .agents and .claude were Cortex output. Do not recreate them or add a `postinstall` that writes rules. Project instructions belong in a recipe.

## Keeping it slim

`bun run check:agent` enforces the shape of this directory, `AGENTS.md`, and the docs: size caps, routing, cited paths that must exist, and the Cortex ban. The caps and the full list of checks live at the top of `scripts/check-agent-surface.mjs`. Change a rule there, not in a doc. `bun run typecheck:baseline` guards the inherited type errors in `scripts/typecheck-baseline.txt`.
