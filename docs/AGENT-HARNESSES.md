# Agent harness compatibility

How this repo stays readable by multiple AI coding tools with **one source of
truth** and no duplicated instructions.

## Principle

`AGENTS.md` is the canonical instruction file (an open standard read by most
tools). Every other tool either reads it natively or points to it via an
import. **Never copy instructions between files — point at `AGENTS.md`.**
The only other instruction file in the repo is `CLAUDE.md`, a one-line import.

## Instructions: what each tool reads

| Tool | Reads | Status here |
| --- | --- | --- |
| **Zed** (primary) | **one** instruction file, first match wins — `.rules`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` ([docs](https://zed.dev/docs/ai/instructions)). Reads **no** directories. | resolves `AGENTS.md`. ⚠ Reads no rule dirs — guidance reaches it only via `AGENTS.md` content. ⚠ A leftover Cursor-era rules file (position 2) would silently outrank `AGENTS.md` — delete it if present. |
| **Claude Code** | `CLAUDE.md` (not `AGENTS.md`) | `CLAUDE.md` imports `@AGENTS.md` — wired |
| **Codex** | `AGENTS.md` natively | nothing to add |
| **Gemini CLI** | `GEMINI.md` by default (`DEFAULT_CONTEXT_FILENAME`); reads `AGENTS.md` only when `contextFileName` is configured | no `GEMINI.md` committed — set `contextFileName` to `AGENTS.md` in your Gemini settings |
| Aider | `CONVENTIONS.md` via `.aider.conf.yml` | add if adopted |
| Copilot / VS Code | `.github/copilot-instructions.md` | add if adopted |

Tool-specific tweaks go **below** the import in that tool's own file — never
by forking `AGENTS.md`.

## Rules & skills: tracked files, nothing generated

There is no rule pack and no install step that writes agent files. Everything
an agent reads is a tracked, hand-written file:

```
AGENTS.md            the router (the one instruction file)
CLAUDE.md            @AGENTS.md (Claude Code's entry point)
.agents/recipes/     opened on demand, one per task
.agents/skills/      longer Pixi and controller guidance the recipes point at
```

Project instructions go in a recipe. `bun run check:agent` fails if `CLAUDE.md`
stops importing `AGENTS.md` or if an install or dev script is added that would
write agent files.

## MCP: wolf-game-kit (asset generation)

The wolf-game-kit MCP server (asset generation + CDN publish) is
**machine-local, not committed**: `.mcp.json` is gitignored and provisioned
by the workspace setup / Nucleo Studio CLI. The server reads a
per-environment key (`PROD_ASSET_GEN_API_KEY`, or `QA_ASSET_GEN_API_KEY` for
QA) from that file's `env` block or a shell export — see README → MCP
servers; pre-commit blocks any staged real `wg_ag_` key.

Keep the server key `wolf-game-kit`: skill `allowed-tools` frontmatter
references tool names like `mcp__wolf-game-kit__*`, and a different key
silently breaks those allowlists. If the tools don't appear, fix the setup or
use the documented local fallback — see
[`docs/recipes/asset-pipeline.md`](../docs/recipes/asset-pipeline.md).

## Permissions & autonomy policy

Permission rules can't be shared across tools — each harness has its own
schema. The *policy* below is the single source of truth (tool-agnostic
prose); each tool's config implements it. Claude Code's implementation is
committed at `.claude/settings.json`.

- **Auto-allow (run unattended):** reads/searches, builds, tests, linters,
  formatters, dependency installs, dev-server runs, and file deletes
  (recoverable via git).
- **Prompt first (irreversible or outward-facing):** `git reset`,
  `git rebase`, `git push`, package publishes, deploys
  (`bun run amino:release`, `/deploy`).
- **Never (denied):** reading or printing secrets — `.env*`, `*.key`,
  `*.pem`, service tokens.

## Adding a new harness

1. Find its instruction file → symlink or point it to `AGENTS.md`.
2. If it can't import or read `AGENTS.md`, give it a one-line file that
   points there (like `CLAUDE.md`) — never a copy of the instructions.
3. Map its permission/approval mechanism to the policy above.
4. Add a row to the table above so this doc stays in sync.
