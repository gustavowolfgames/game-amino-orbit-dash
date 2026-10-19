# Progress persistence

Save what must survive a reload with `createVersionedStore` from `~/core`. The code is `src/core/utils/storage.ts`. Do not edit it. Gameplay state still lives in ECS, so read `.agents/recipes/ecs.md` first.

## How the store works

The store is a thin wrapper over `GameSaveService` from `@wolfgames/client`. It saves to localStorage on the device. It is not a cloud save.

`key` is the SDK app id. The payload lives under `${key}_save_data`. A raw payload found under the bare `key` is adopted into that envelope once.

The save is stamped with the resolved player id. `src/core/systems/identity/README.md` explains how that id is chosen and why the store uses a no-network identity service.

Each store starts loading when it is constructed. `src/entry-client.tsx` awaits `resolvePlayerId()` and then `whenStoresReady()` before the first render. Construct stores at module scope so boot waits for them. After boot, `load()` returns real saved data.

`save()` writes the in-memory cache at once, then writes through to the SDK without waiting. `clear()` resets the cache to `defaults`. A save or clear that happens before loading finishes is replayed after it. If loading fails, for example on corrupt JSON or blocked storage, the store logs a warning and runs on in-memory defaults.

## API

```ts
interface VersionedStoreConfig<T> {
  key: string;        // SDK app id
  version: number;    // current schema version
  defaults: T;        // used for new players and invalid data
  migrations?: Record<number, (old: unknown) => Partial<T>>;
  validate?: (data: unknown) => boolean; // false resets to defaults
}

interface VersionedStore<T> {
  load(): T;          // sync copy of the cache
  save(data: T): void;
  clear(): void;
  key: string;
}
```

`getStored`, `setStored`, and `removeStored` are plain localStorage helpers in the same file. Use them for one small value.

Migrations are keyed by target version. `migrations[2]` receives a version 1 payload and returns only the fields that changed. The wrapper hands them to the SDK, which runs every step from the stored version up to `version`. Add an entry for each version that changes the shape.

## What goes in the store

Cross-session meta goes in the store: best score, highest level reached, finished pack ids.

Mid-level state stays in ECS. To resume a level, copy the resources you need from `getGameWorld().resources` into the store. To restore, pass the saved values into a transaction such as `startLevel`. Do not write `db.store` directly, and do not keep a second copy in a Solid signal.

Transactions and systems stay pure. Read and write the store from a screen or a sibling module of the controller, never inside a transaction or system.

Volume and music are already saved by `src/core/systems/audio/state.ts`. Do not copy them.

The sample already has one: `src/game/setup/progress.ts` saves the level to resume on and the Content Pack it belongs to. It migrates a v1 save, repairs bad fields in `sanitizeProgress`, and resets when a new pack becomes active. Extend it rather than adding a second progress store. The snippet below is the minimal shape.

```ts
// For example src/game/progress.ts
import { createVersionedStore } from '~/core';
import { getGameWorld } from '~/game/mygame/world';

interface Progress { version: number; bestScore: number; levelReached: number }

export const progressStore = createVersionedStore<Progress>({
  key: 'mygame_progress',
  version: 1,
  defaults: { version: 1, bestScore: 0, levelReached: 0 },
});

export function recordRun(): void {
  const { score, level } = getGameWorld().resources;
  const p = progressStore.load();
  progressStore.save({ ...p, bestScore: Math.max(p.bestScore, score), levelReached: Math.max(p.levelReached, level) });
}

export const clearProgress = (): void => progressStore.clear();
```

## Reset

`src/game/screens/components/GameSettingsMenu.tsx` already shows a dev-only Reset Progress row when it gets `onResetProgress`. `src/app.tsx` passes `handleResetProgress`, which calls `clearProgress()` from `src/game/setup/progress.ts` and then reloads the page. Clear any new store there too.

## Verify

A unit test saves, loads, and clears the store, and runs each migration on an old payload. Run `bun run test:run` and `bun run typecheck:baseline`.
