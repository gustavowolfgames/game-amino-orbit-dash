# Docs Index

Routing table for everything in `docs/`. Start from what you're trying to do.
Agents start from [`AGENTS.md`](../AGENTS.md) and its recipes in
[`.agents/recipes/`](../.agents/recipes/); the reference docs below go deeper
than a recipe.

## Start here

| Doc | Who it's for |
|-----|--------------|
| [GAME-DESIGN.md](GAME-DESIGN.md) | **Everyone.** The design source of truth — designers write it, agents read it before building |
| [LEARNINGS.md](LEARNINGS.md) | Durable team memory — append dated learnings, newest first |
| [AGENT-HARNESSES.md](AGENT-HARNESSES.md) | How Claude Code / Codex / Zed / new harnesses plug into this repo |

## I want to… (task routing)

| Task | Read |
|------|------|
| Start a new game from this template | [`.agents/recipes/new-game.md`](../.agents/recipes/new-game.md) |
| Understand how the app is put together | [reference/architecture.md](reference/architecture.md) |
| Write any game code (required pre-read) | [standards/best-practices.md](standards/best-practices.md) + [standards/guardrails.md](standards/guardrails.md) |
| Generate assets (images, spritesheets, SFX, music, VFX) | [recipes/asset-pipeline.md](recipes/asset-pipeline.md) — the wolf-game-kit MCP workflow |
| Publish assets to the CDN | [recipes/asset-pipeline.md](recipes/asset-pipeline.md) (`bun run assets:publish` → committed lockfile), [reference/asset-pipeline.md](reference/asset-pipeline.md) |
| Add or name assets | [reference/asset-naming.md](reference/asset-naming.md), [recipes/asset-pipeline.md](recipes/asset-pipeline.md) |
| Register assets in the manifest | [reference/manifest-contract.md](reference/manifest-contract.md) |
| Add music or sound effects | [recipes/audio-setup.md](recipes/audio-setup.md), [reference/audio.md](reference/audio.md) |
| Build gameplay state (ECS — the default, pre-wired in `src/game/mygame/ecs/`) | [guides/state-architecture.md](guides/state-architecture.md), [reference/ecs-patterns.md](reference/ecs-patterns.md) |
| Add a real-time / per-frame loop (physics, movement, orbit, matter.js) | [../src/game/mygame/ecs/README.md](../src/game/mygame/ecs/README.md) (fixed-step + systems), [guides/state-architecture.md](guides/state-architecture.md) |
| Animate things / improve game feel | [reference/animation.md](reference/animation.md) |
| Use shared components (check before writing new ones) | [guides/shared-components.md](guides/shared-components.md), catalog at `node_modules/@wolfgames/components/src/modules/INDEX.md` |
| Write a new module | [guides/shared-components.md](guides/shared-components.md) (incubate in the game, promote to game-components), [modules/index.md](modules/index.md) |
| Save/load player progress | [reference/progress-persistence.md](reference/progress-persistence.md) |
| Add levels, a daily edition, or a partner reskin (Game Packs / Dynamic Data) | [recipes/game-packs.md](recipes/game-packs.md) — content and brand are data, published without a redeploy |
| Debug a problem | [reference/debugging.md](reference/debugging.md), then [guides/troubleshooting.md](guides/troubleshooting.md) |
| Set up GitHub Packages auth | [README → Setup](../README.md#setup) |

## Standards (rules to follow)

| Doc | What it covers |
|-----|----------------|
| [best-practices.md](standards/best-practices.md) | Project structure, assets, modules, game contract, animation |
| [guardrails.md](standards/guardrails.md) | Anti-patterns that silently break games |

## Reference

| Doc | What it covers |
|-----|----------------|
| [reference/architecture.md](reference/architecture.md) | Tiers, boot sequence, contracts |
| [reference/ecs-patterns.md](reference/ecs-patterns.md) | ECS plugin, transactions, systems |
| [reference/animation.md](reference/animation.md) | GSAP patterns |
| [reference/asset-pipeline.md](reference/asset-pipeline.md) | CDN-first assets in depth |
| [reference/asset-naming.md](reference/asset-naming.md) | Asset filename convention (`bun run check:assets`) |
| [reference/manifest-contract.md](reference/manifest-contract.md) | Bundle names, loaders, the manifest (`bun run check:manifest`) |
| [reference/audio.md](reference/audio.md) | Howler channels, sprites, music |
| [reference/debugging.md](reference/debugging.md) | Inspector, devtools, common failures |
| [reference/progress-persistence.md](reference/progress-persistence.md) | Saving and loading player progress |
| GameKit API | See the game-sdk repo — auth, analytics, assets, Sentry, data CRUD |

---

**Keeping this index current is part of every task** — when you add, move, or
delete a doc, update the tables above in the same change.
