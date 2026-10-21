# Game Index

Game-specific code. It can import from `src/core/` and `@wolfgames/components`. Nothing outside `src/game/` imports from here. The rules for each part are in the recipes routed from `AGENTS.md`.

## Structure

```
src/game/
  config.ts            # identity, environment, fonts, screens, manifest
  asset-manifest.ts    # bundles (see .agents/recipes/assets.md, Names)
  mygame-contract.ts   # what setupGame / the controller must provide
  settingsTheme.ts     # the settings menu's theme tokens

  mygame/              # the game: one folder, kept as mygame
    world.ts           # getGameWorld(): the one ECS world
    sim/               # plugin (resources, archetypes, transactions), events, rng, systems, rules
    engine/            # fixed step and the frame source
    input/             # pointer → transaction or intent
    render/            # Pixi views, textures
    agent/             # states and actions for agents and bots
    screens/           # gameController, cue table, gameAudio, startView

  screens/             # Solid screen shells: loading, start, game, results
  content/             # content packs: loading, active pack, served modes
  brand/               # brand sheets and the theme
  setup/               # analytics, flags, progress, Vault content, boot content
  tuning/              # tuning types and defaults
```

Each folder under `mygame/` has a `README.md` with what goes in it and a short example.

## Where to put new files

| New thing | Where | Recipe |
|---|---|---|
| Game state, a move, a score, an entity | `mygame/sim/plugin.ts` (transactions), `mygame/sim/systems/` (per-frame) | `ecs.md` |
| Input | `mygame/input/` | `guardrails.md` |
| A sprite, HUD, VFX | `mygame/render/` | `pixi.md`, `components.md` |
| Controller wiring, sounds for events | `mygame/screens/gameController.ts`, `cues.ts` | `game-controller.md` |
| A screen shell | `screens/` | `components.md` |
| Levels, packs, editions | `content/`, `schemas/` | `dynamic-data.md` |
| Colors, fonts, logos | `brand/` | `reskin.md` |
| Tuning values | `tuning/types.ts` | `new-game.md` |
| Reusable across games | not here: `@wolfgames/components` | `components.md` |
