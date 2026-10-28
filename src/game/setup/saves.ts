/**
 * saves — the one list of this game's saved stores.
 *
 * Every store that persists player data registers here instead of calling `createVersionedStore`
 * directly. That buys two things:
 *
 *   • Keys are tied to the game: `registerSave({ name: 'progress', … })` stores under
 *     `${gameSlug}:progress` (the slug from wolf-game-kit.json), so a fork with its own slug never
 *     reads its parent's saves, even on the same origin.
 *   • One reset: `clearSaves()` clears every registered store. Reset Progress (app.tsx) calls it,
 *     so a new store is covered without touching the reset path.
 *
 * A store that used to live under another key lists it in `adoptFrom`: on registration, a save
 * found there is moved once to the new key (only when the new key holds nothing yet).
 *
 * Register at module scope, like `progress.ts`, so boot's `whenStoresReady()` hydrates the store
 * before the first screen. See .agents/recipes/dynamic-data.md, "Saved progress".
 */

import {
  createVersionedStore,
  removeStored,
  type VersionedStore,
  type VersionedStoreConfig,
} from '~/core/utils/storage';
import wolfGameKit from '../../../wolf-game-kit.json';

/** The game's slug; every save key starts with it. */
export const SAVE_SLUG: string = wolfGameKit.gameSlug;

/** The store key for save `name`: `${slug}:${name}`. */
export function saveKey(name: string, slug: string = SAVE_SLUG): string {
  return `${slug}:${name}`;
}

export interface SaveConfig<T> extends Omit<VersionedStoreConfig<T>, 'key'> {
  /** Short, stable id for this save ('progress', 'colony'); the key adds the slug. */
  name: string;
  /** Old full keys (as passed to `createVersionedStore`) whose save is adopted once. */
  adoptFrom?: string[];
}

type AnyStore = VersionedStore<{ version: number }>;

const stores = new Map<string, AnyStore>();

/** SDK envelope slot for a store key (see `createVersionedStore`). */
const envelopeSlot = (key: string) => `${key}_save_data`;

/**
 * Move a save from an old key to `key`, once. Takes the first old key holding an envelope (or a
 * bare payload, which core then wraps), and only when `key` holds neither. Best-effort.
 */
export function adoptSave(key: string, oldKeys: readonly string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (
      localStorage.getItem(envelopeSlot(key)) !== null ||
      localStorage.getItem(key) !== null
    )
      return;
    for (const old of oldKeys) {
      if (old === key) continue;
      for (const [from, to] of [
        [envelopeSlot(old), envelopeSlot(key)],
        [old, key],
      ]) {
        const raw = localStorage.getItem(from);
        if (raw === null) continue;
        localStorage.setItem(to, raw);
        removeStored(from);
        return;
      }
    }
  } catch {
    // Storage blocked or full: the store starts from its defaults.
  }
}

/**
 * Create a versioned store under `saveKey(name)` and add it to the registry. Registering a name
 * again replaces the entry (a hot reload re-runs the module).
 */
export function registerSave<T extends { version: number }>(
  config: SaveConfig<T>,
): VersionedStore<T> {
  const { name, adoptFrom, ...rest } = config;
  const key = saveKey(name);
  if (adoptFrom?.length) adoptSave(key, adoptFrom);
  const store = createVersionedStore<T>({ ...rest, key });
  stores.set(name, store as unknown as AnyStore);
  return store;
}

/** The registered store for `name`, or undefined. */
export function getSave<T extends { version: number }>(
  name: string,
): VersionedStore<T> | undefined {
  return stores.get(name) as unknown as VersionedStore<T> | undefined;
}

/** Names of every registered save, in registration order. */
export function saveNames(): string[] {
  return [...stores.keys()];
}

/** Clear every registered store (Reset Progress). */
export function clearSaves(): void {
  for (const store of stores.values()) store.clear();
}
