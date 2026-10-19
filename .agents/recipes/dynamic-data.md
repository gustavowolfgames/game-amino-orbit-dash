# DynamicData from Games Manager

## When

Open this recipe when a daily edition, a vault schedule, a partner brand, or any Games Manager data should change the running game.

## Do

The template ships the client, the loaders, and the fallbacks. Reuse them. Full guide: `docs/recipes/game-packs.md`.

- `src/game/content/dynamic-client.ts` holds the one Dynamic Data client per GameKIT. Call `dynamicClient(kit)`. Do not build a second client: inside a Vault each one opens its own parent-frame bridge.
- `src/game/content/load.ts` picks the pack key (`?wolfPack=`, else the Vault `contentId`, else `default`) and fetches it with `getPack`.
- `src/game/brand/load.ts` fetches the brand sheet: the one in the pack, else the `brand/theme` entry.
- `src/game/content/catalog.ts` answers the Daily Editions schedule (`catalog` schema: pack key to `YYYY-MM-DD`).
- `src/game/setup/content.ts` runs the pack and the brand at boot, in parallel with the assets, capped at `CONTENT_BUDGET_MS`. A missing, failing, or malformed response falls back to the bundled pack and the build's brand, and the game still plays.
- `src/game/setup/vault-content.tsx` maps the Vault's selection to a served mode: default, a daily edition (its completion exits to the Vault), or `unlocked_editions` (every open edition in schedule order). The rules are pure in `src/game/content/served-mode.ts` and `src/game/setup/served-session.ts`; the controller calls `completeActivePack()` at a pack's last win.
- Inside a Vault, `loadBootContent` in `src/game/setup/content.ts` is the first-context gate: boot waits up to `VAULT_CONTEXT_WAIT_MS` for the host's first `context` (heard passively by `awaitFirstVaultContext` in `src/integrations/vault/first-context.ts`, before `ready`) and loads that selection, so a Vault boot never shows the bundled pack first. On timeout it boots the default pack, logs once, and the bridge applies the selection when the Vault re-sends it. Outside a Vault there is no wait. Need "are we in the Vault / what did it select first"? Use `inVault()` and `firstVaultContext()` from `~/integrations/vault`, or `getBootSelection()` for what boot applied.
- Inside a Vault the start screen is skipped: loading goes straight to the game and `start_screen_skipped` reports `skip_source: 'vault'`. Precedence is `vault` > `config` > `dev_mode` > `url_param`, in `src/game/screens/skipStartScreen.ts`.

Schemas are registered in `schemas/registry.ts`, each with `bundleSyncEnabled: false`. A new schema goes in that file. A shape change bumps the schema's `version` and needs a redeploy. An entry change needs neither.

Publishing is the content person's job, in order: deploy (registers the schemas), create entries, bind a Game Pack. The `wolf-dev` CLI refuses to run without an interactive terminal, so agents use the wolf-game-kit MCP tools of the same names: `schema_data_batch-create`, `pack_create`, `pack_assign`, `pack_entries_set`.

## Verify

`bun run test:run` passes, including `tests/unit/content/content-load.test.ts` (fallbacks, `?wolfPack=`), `tests/unit/content/served-mode.test.ts` (served modes, cursor, daily exit), `tests/unit/content/brand.test.ts`, `tests/unit/content/boot-gate.test.ts` (the first-context gate) and `tests/unit/screens/skip-start-screen.test.ts`.

`bun run test:e2e` runs `tests/e2e/game-packs.spec.ts`: the bundled pack with nothing published, a `?wolfPack=` pack with its brand, a brand switch, and a broken pack falling back.

## Example

`sheetFromPack` in `src/game/brand/load.ts` reads a sheet out of a Content Pack with `client.getPack(packKey)`, and treats `PACK_NOT_FOUND` as the ordinary "nothing published" case.
