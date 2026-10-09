# DynamicData from Games Manager

## When

Open this recipe when a daily edition, a vault schedule, or any Games Manager config should change the running game.

## Do

Register two schemas, `catalog` and `pack`, with `bundleSyncEnabled: false`. The client type comes from `@wolfgames/client`.

Build one client per GameKIT instance.

```ts
gameKit.execute(new GetDynamicDataClientCommand(registry, ['pack']))
```

`pack` is the schema an embedding parent frame may serve. Read `catalog` from storage.

The shipped Stacks catalog maps a pack entry key to a `YYYY-MM-DD` string. The productionization checklist writes the pair the other way, a date to an edition id, and it says the vault contract was not final on 2026-09-18. Follow the shipped map until that page and the games match.

Boot calls `loadActivePack` before play. On a null client, a fetch error, or invalid JSON, seed the bundled pack from `.agents/recipes/content.md` and continue. `?pack=` selects an entry key. A miss leaves the current pack in place.

Share one in-flight client promise. Two boot readers must not open two parent-frame bridges.

Reset mid-play storage when the loaded pack id changes.

Do not copy Solid session state from the Stacks or Off the Record repos. Copy the client and the pack load.

The Games Vault host is a separate path. `src/integrations/vault/README.md` covers `VaultHostBridge`. Its `catalog` prop is `{ contentId, availableFrom }` scheduling metadata sent to the Vault. It is not the DynamicData `catalog` schema. Map the Vault `contentId` to a pack entry key in `onContext`.

## Verify

A unit test covers three cases. A valid remote pack replaces the bundled one. Invalid JSON keeps the bundled pack. A `?pack=` key selects that entry.

When you are ready to publish, ask the user to register the schema with `wolf-dev` in a terminal. The CLI does not run for agents. Until then the unit test is the check.

## Example

GetDynamicDataClientCommand is imported from `@wolfgames/client` in the Stacks dynamic-client file. The registry in that repo sets bundleSyncEnabled to false on catalog and pack. This template depends on `@wolfgames/client` and does not ship that client yet.
