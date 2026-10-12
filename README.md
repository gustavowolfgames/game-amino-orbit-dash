# Template Amino — Game Production Template

A production-ready template for building mobile web games — from prompt to
polished, shippable product. Describe a game idea and AI agents design and
build it; the template handles loading, screens, audio, tuning, analytics,
and errors so every game starts at production quality.

**North star:** games players can't put down — instantly playable, deeply
satisfying, compulsively replayable. The quality bar lives in
[`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md).

## Agent surface: how agents get their instructions

**This template guides agents with a small router plus on-demand recipes, not an
always-on rule pack.** The agent always loads a 47-line router (`AGENTS.md`), then
opens the one recipe the task needs. Benchmarks behind the default: recipes built the
same games about 19% cheaper than the cortex rule pack, with equal build and test
results (ENG-4734, ENG-4735). Reading instructions is about half of an agent's cost,
so what loads every turn matters.

```
CLAUDE.md                  GENERATED from the toggles below; imports AGENTS.md
AGENTS.md                  the router: task → which recipe to open (always loaded)
.agents/
├── recipes/               opened only when the task needs one
│   ├── new-game.md          build a new game / replace the sample
│   ├── ecs.md               state, turns, score, entities, frame loop
│   ├── guardrails.md        input, leaks, DOM, "do not" rules
│   ├── pixi.md              sprites, canvas HUD, VFX
│   ├── game-controller.md   setupGame, screen changes
│   ├── components.md        any visible element → @wolfgames/components
│   ├── reskin.md            colors, type, logos, partner skin
│   ├── content.md           levels, questions, content packs
│   ├── dynamic-data.md      daily editions, vault, Games Manager
│   ├── analytics.md         analytics events
│   ├── assets.md            images, audio, VFX via the wolf-game-kit MCP
│   ├── systems.md           @wolfgames/game-systems steer (toggle, off)
│   └── verify.md            before saying "it works"
├── skills/                longer Pixi and controller guidance the recipes point at
├── specs/                 large feature plans (copy SPEC.template.md)
└── decisions.tsv          every structural change, with its evidence
```

### The `agentSurface` toggles

`package.json` switches each guidance layer on or off:

```json
"agentSurface": {
  "recipes": true,
  "cortex": false,
  "systems": false
}
```

| Toggle | What it loads | Default |
|---|---|---|
| `recipes` | `AGENTS.md` router + always-on core + on-demand `.agents/recipes/` | **on** |
| `cortex` | the `@wolfgames/cortex` alwaysApply rule pack (generated `.claude/rules/`, skills, commands) | off |
| `systems` | `.agents/recipes/systems.md`, the `@wolfgames/game-systems` catalog steer, every turn | off |

```bash
bun run agent:surface                                # apply the toggles (also runs on postinstall and predev)
AGENT_SURFACE=recipes,cortex bun run agent:surface   # try a combination without editing package.json
bun run check:agent                                  # fails if CLAUDE.md drifts from the toggles, a recipe cites a missing path, …
```

- **Never edit `CLAUDE.md` by hand.** Change the toggles; `agent:surface` regenerates it.
- **Project instructions go in a recipe,** not in a cortex rule or a `postinstall` that writes rules.
- **`dev` is plain `vite`, not `nucleo dev`:** `nucleo dev` runs `cortex:setup`, which
  reinstalls the rule pack, and it refuses to run without an interactive terminal.

Details: [`.agents/README.md`](.agents/README.md).

## Pick your path

### I'm a designer / artist / producer

You don't need to write code to shape the game.

1. Open [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md) — it's the design source
   of truth, written in plain language. Fill in (or edit) the concept,
   mechanics, screens, and asset list. Agents read it before building
   anything.
2. Talk to the AI agent in your editor (Cursor, Claude Code, …) — describe
   what you want changed. The agent will ask when something is ambiguous and
   will update the design doc as decisions are made.
3. Ask the agent to generate art, sound, and music — it uses the Wolf Games
   asset generator and publishes everything to the CDN by default. If you
   have finished files of your own, tell the agent where they are and it
   will stage, name, and publish them through the same pipeline. (For quick
   local experiments the agent can also work with files in `public/assets/`
   — they move to the CDN before release.)
4. Tune the feel live: press backtick (`` ` ``) in the running game to open
   the tuning panel — no code, no rebuild.

### I'm an engineer

Prerequisites: [Bun](https://bun.sh), Node >= 22, and a GitHub Packages token
for `@wolfgames/*` (see [Setup](#setup) below).

```bash
git clone <repo-url>
bun install     # also wires AI rules/skills into .agents/ and .claude/
bun run dev     # http://localhost:5173
```

| Task | Command |
|------|---------|
| Dev server | `bun run dev` |
| Unit tests | `bun run test:run` |
| E2E smoke | `bun run test:e2e` |
| Typecheck | `bun run typecheck` |
| Format | `bun run format` |
| Build | `bun run build` |

Start with [`docs/INDEX.md`](docs/INDEX.md) — it routes every task to the
right doc. Required pre-reads before writing game code:
[best-practices](docs/standards/best-practices.md) and
[guardrails](docs/standards/guardrails.md); the hard boundaries live in
[`AGENTS.md`](AGENTS.md).

### I'm an AI agent

Read [`AGENTS.md`](AGENTS.md). It is the single source of truth for commands,
structure, boundaries, workflow, and the self-maintenance mandate.

## Setup

### GitHub Packages token

`@wolfgames/*` packages live on GitHub Packages. [`.npmrc`](.npmrc) reads
`NODE_AUTH_TOKEN` from your shell:

1. Create a classic token with `read:packages` at
   https://github.com/settings/tokens (or run `gh auth token`).
2. Add `export NODE_AUTH_TOKEN="ghp_..."` to `~/.zshrc` and reload.
3. Verify with `echo $NODE_AUTH_TOKEN`.

Full walkthrough (including the Cursor non-interactive-shell gotcha):
[`docs/guides/game-kit-setup.md`](docs/guides/game-kit-setup.md).

### MCP servers

Asset generation runs through the **wolf-game-kit MCP** — it lets agents
generate sprites, audio, music, and VFX directly, and publish them to the
CDN. Its config is machine-local (`.mcp.json` stays gitignored) and is
provisioned by the workspace setup / Nucleo Studio CLI. One key activates
it, in the server's `env` block:

```json
{
  "mcpServers": {
    "wolf-game-kit": {
      "command": "bunx",
      "args": ["-p", "@wolfgames/dev@latest", "wolf-dev-mcp"],
      "env": { "PROD_ASSET_GEN_API_KEY": "wg_ag_..." }
    }
  }
}
```

`bunx` fetches the server on demand. A bare `wolf-dev-mcp` command only works
if you installed `@wolfgames/dev` globally — without it the server never
starts and no wolf-game-kit tools appear at all.

Keys belong to one environment and the name says which. The tools call
whichever environment you are signed into with `wolf-dev`, so a QA key sent
to Production comes back `Invalid API key` — mint the key from the app you
work against ([production](https://asset-gen.wolf.games/),
[QA](https://asset-gen.qa.wolf.games/)) and name it to match.
`wolf-dev auth asset-gen` prints where calls will land.

A shell `export` works too. The project `.env` does not reliably reach the
MCP server, and a value in `.mcp.json` or your shell wins over it either
way. No keys live in committed files — pre-commit blocks real keys. Full
setup: [Asset-Gen MCP Setup](https://app.notion.com/p/wolfgames/Asset-Gen-MCP-Setup-30d4a337719980248e1ed1c5419f11cc).

Add other servers (e.g. Playwright for E2E debugging) to your local
`.mcp.json` the same way.

## How the AI context stays fresh

Agent instructions live in this repo (see [Agent surface](#agent-surface-how-agents-get-their-instructions)),
so they change with the code in the same PR. The repo also learns over time: agents
append to [`docs/LEARNINGS.md`](docs/LEARNINGS.md) and keep
[`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md) current as part of every task.

## Architecture

```
src/
├── core/              # Scaffold framework — DO NOT EDIT
│   ├── systems/       # Assets, screens, tuning, audio, errors, pause, vfx
│   ├── ui/            # Button, Logo, MobileViewport, PauseOverlay
│   └── dev/           # TuningPanel (Tweakpane), inspector
│
├── game/              # YOUR GAME
│   ├── config.ts      # Identity, environment, screen wiring
│   ├── state.ts       # Runtime signals
│   ├── asset-manifest.ts  # Asset bundles (see manifest-contract recipe)
│   ├── screens/       # Loading, Start, Game, Results shells
│   ├── setup/ audio/ tuning/
│   └── mygame/        # Placeholder game — replace with yours
│
└── integrations/      # Publisher embed integration
```

Dependency rule: `core/` never imports from `game/`. Reusable building blocks
come from [`@wolfgames/components`](https://github.com/wolfgames/game-components)
(see [shared-components guide](docs/guides/shared-components.md)).

Full picture: [`docs/core/architecture.md`](docs/core/architecture.md).

## Tech stack

| Category | Technology |
|----------|------------|
| UI | SolidJS |
| Graphics | PixiJS 8 |
| Audio | Howler.js |
| Animation | GSAP |
| Build | Vite |
| Styling | TailwindCSS |

## Documentation

Everything routes through [`docs/INDEX.md`](docs/INDEX.md). Highlights:

| Topic | Doc |
|-------|-----|
| Design source of truth | [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) |
| Creating a new game | [docs/guides/new-game.md](docs/guides/new-game.md) |
| Best practices (required) | [docs/standards/best-practices.md](docs/standards/best-practices.md) |
| Guardrails (required) | [docs/standards/guardrails.md](docs/standards/guardrails.md) |
| Asset naming | [docs/guides/naming-convention.md](docs/guides/naming-convention.md) |
| Debugging | [docs/guides/debugging.md](docs/guides/debugging.md) |
| Agent harness support | [docs/AGENT-HARNESSES.md](docs/AGENT-HARNESSES.md) |
| Team learnings | [docs/LEARNINGS.md](docs/LEARNINGS.md) |
