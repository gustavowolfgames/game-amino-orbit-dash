# Content packs and Dynamic Data

## When

Open this recipe when you add levels, questions, cards, or anything that should change between editions without a code change; or when a daily edition, a Vault schedule, a partner brand, or other Games Manager data should change the running game.

## The model

A game's levels and its look are data the Games Manager publishes, not code. One build serves the default game, dated daily editions, and any number of partner reskins.

```
build (ships with)                         Games Manager (publish, no redeploy)
──────────────────                         ────────────────────────────────────
src/game/content/packs/default.json  ◀──── blocks + levels entries → Content Pack "<key>"
src/game/brand/defaults.ts (Wolf)    ◀──── brand entry "theme"  (or one inside a Content Pack)
                                     ◀──── catalog/<slug>        (pack key → YYYY-MM-DD, dailies)
```

| Schema (`schemas/`) | Holds | Read by |
|---|---|---|
| `blocks` | `{ id, name, order, levels: ["<level key>", …] }`: a run of levels. Blocks play by `order`, levels in list order. | `src/game/content/assemble.ts` |
| `levels` | One level, keyed `<block id>-<n>`, in the game's own shape | `parseLevel` in `src/game/content/level.ts` |
| `brand` | A partner sheet: grounds, accents, roles, fonts, link | `src/game/brand/load.ts` |
| `catalog` | `{ "<pack key>": "YYYY-MM-DD" }`: the Daily Editions schedule | the manager's harvest (Vault only) |

There is no `pack` schema. A Content Pack only points at entries, so the order lives on `blocks`, which lets one level sit at a different position in two editions. Values shared by a run of levels (a name, a theme) go on the block, not on every level. Content and brand are separate: any edition can wear any partner's brand (`.agents/recipes/reskin.md`).

Schemas are registered in `schemas/registry.ts`, each with `bundleSyncEnabled: false`. **A shape change bumps the schema's `version` and needs a redeploy. An entry change needs neither.**

## Change what a level holds

The loader, the fallbacks, the Vault wiring and completion reporting are template code. Change the level shape and the bundled pack; do not write a new loader.

1. Edit `LevelsDef` in `schemas/levels/schema.ts` and bump the schema's `version`.
2. Update the defaults and `parseLevel` in `src/game/content/level.ts`.
3. Rewrite the bundled pack `src/game/content/packs/default.json`. The game boots on it when nothing is published, and when a fetch fails.

Gameplay reads a level with `levelAt(n)` from `src/game/content`. Screens read `getActivePack()` from the same module. Nothing imports a pack JSON directly.

A level with more than one part (cards, narrative) gets a sibling schema keyed like `levels` and a line in `src/game/content/assemble.ts`. Words, questions, card layout and level numbers belong in the pack. Systems, input and scoring rules stay in code. Use string ids for anything registered as Dynamic Data.

The game's identity: `gameSlug` in `wolf-game-kit.json` and `VITE_GAME_KIT_PROJECT_ID` in `.env` must both be the game's Nucleo slug. Dynamic Data paths are keyed by it.

## What already loads it

Reuse these; do not build a second copy.

- `src/game/content/dynamic-client.ts` holds the one Dynamic Data client per GameKIT. Call `dynamicClient(kit)`. Inside a Vault each client opens its own parent-frame bridge.
- `src/game/content/load.ts` picks the pack key (`?wolfPack=`, else the Vault `contentId`, else `default`) and fetches it with `getPack`.
- `src/game/brand/load.ts` fetches the brand sheet: the one in the pack, else the `brand/theme` entry.
- `src/game/setup/content.ts` runs the pack and the brand at boot, in parallel with the assets, capped at `CONTENT_BUDGET_MS`. A missing, failing or malformed response falls back to the bundled pack and the build's brand, and the game still plays.
- Inside a Vault, `loadBootContent` in `src/game/setup/content.ts` is the first-context gate: boot waits up to `VAULT_CONTEXT_WAIT_MS` for the host's first `context` (`awaitFirstVaultContext` in `src/integrations/vault/first-context.ts`) and loads that selection, so a Vault boot never shows the bundled pack first. On timeout it boots the default pack and the bridge applies the selection when the Vault re-sends it. Use `inVault()`, `firstVaultContext()` (`~/integrations/vault`) or `getBootSelection()` to ask what boot applied.
- Inside a Vault the start screen is skipped and `start_screen_skipped` reports `skip_source: 'vault'`. Precedence is `vault` > `config` > `dev_mode` > `url_param` (`src/game/screens/skipStartScreen.ts`).

## Daily editions and served modes

Date the packs in the `catalog/<slug>` entry, for example `{ "edition-2026-10-08": "2026-10-08" }` (`schemas/catalog/examples/aminoecspure.json`). The manager's harvest boots the game hidden, and `src/game/setup/vault-content.tsx` answers the catalog as `content_catalog`. The Vault's selection picks a served mode (`resolveServedMode` in `src/game/content/served-mode.ts`, driven by `src/game/setup/served-session.ts`):

| Vault `content` | Mode | Plays | When the pack's last level is won |
|---|---|---|---|
| `{ type: 'default' }` | default | the deployment's own pack | `reportGameCompleted()` |
| `{ contentId: '<pack key>' }` | daily | that edition, from level 1 | `reportContentCompleted(contentId)` once; the Vault takes the player back |
| `{ contentId: 'unlocked_editions' }` | unlocked | every edition with `availableFrom <= today` (UTC), oldest first | load the next edition; after the last, `reportGameCompleted()` once |

The controller calls `completeActivePack()` at a pack's last win. The exit is the completion report, never `play_ended` (that means "the player left").

## Saved progress and a new pack

`src/game/setup/progress.save.ts` saves where the run is, so a reload resumes the same level. It is built on `createVersionedStore` from `src/core/utils/storage.ts`. The run itself stays in ECS; the store only copies the resume point out and hands it back to the `startRun` transaction.

The save holds the pack id next to the level. When a different pack becomes active, `onActivePackChange` clears the save, and `resumeLevel(pack)` ignores a save from another pack. Winning the pack's last level clears it too. Volume and music are saved by core; do not copy them.

To save more, add the field to `RunProgress` and `PROGRESS_DEFAULTS`, repair it in `sanitizeProgress`, bump `PROGRESS_VERSION`, and add `migrations[<new version>]` for the old shape. Read and write the store from the controller or a screen, never inside a transaction or system.

A game with its own save (a colony, unlocks, coins) puts it in a file named `<name>.save.ts` anywhere under `src/game/` and registers it with `registerSave` from `src/game/setup/saves.ts` instead of calling `createVersionedStore`:

```ts
const store = registerSave<ColonySave>({ name: 'colony', version: 1, defaults, validate });
```

`registerSave` stores it under `saveKey(name)`, which is `<gameSlug>:<name>` with the slug from `wolf-game-kit.json`, so a fork with its own slug never loads its parent's saves. Reset Progress calls `clearSaves()`, which clears every registered store. `app.tsx` loads every `*.save.ts` file before boot, so boot hydrates the store and its first `load()` returns the real save; do not edit `app.tsx` for a new store. Build the store at module scope in that file, as `progress.save.ts` does. A `registerSave` in a file with another name runs too late: its first read is the defaults, and dev logs a warning naming the save. A store moving from an older key lists that key in `adoptFrom: ['<old key>']`; its save is moved to the new key once, when the new key is empty. `getSave(name)` returns a registered store.

## Publish

Publishing is the content person's job, in order: deploy (registers the schemas), create entries, bind a Game Pack. The `wolf-dev` CLI refuses to run without an interactive terminal, so agents use the wolf-game-kit MCP tools of the same names: `schema_data_batch-create`, `pack_create`, `pack_assign`, `pack_entries_set`.

To read published data from a dev server, set `VITE_GAME_KIT_PROJECT_ID=<slug>` and `VITE_RELEASE_NAME=main` in `.env`, restart the dev server (`VITE_*` is read at start), then open `?wolfPack=<key>`. Without the release the bundle URL 404s and the game silently plays the bundled pack. A frozen build (`bun run build:frozen`) never touches Dynamic Data.

## Verify

`bun run test:run` passes, including `tests/unit/content/content-load.test.ts` (fallbacks, `?wolfPack=`), `tests/unit/content/schemas.test.ts`, `tests/unit/content/served-mode.test.ts`, `tests/unit/content/brand.test.ts`, `tests/unit/content/boot-gate.test.ts`, `tests/unit/screens/skip-start-screen.test.ts` and `tests/unit/setup/progress.test.ts`.

`bun run decompose:content src/game/content/packs/default.json local/content-packs/default` splits the pack into entries, checks each one against its schema, and proves the round trip.

`bun run test:e2e` runs `tests/e2e/game-packs.spec.ts`: the bundled pack with nothing published, a `?wolfPack=` pack with its brand, a brand switch, and a broken pack falling back.

## Example

`src/game/content/packs/edition-2026-10-08.json` is a second authored pack: one block of two levels, published as a dated edition. `sheetFromPack` in `src/game/brand/load.ts` reads a sheet out of a Content Pack with `client.getPack(packKey)` and treats `PACK_NOT_FOUND` as the ordinary "nothing published" case.
