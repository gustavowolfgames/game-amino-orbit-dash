/**
 * One Dynamic Data client per GameKIT, shared by every reader.
 *
 * The SDK memoises the client in a static slot, but only checks it at the START of `execute()`,
 * before any `await` — so two readers firing side by side each build one, and inside a Vault each
 * opens its own `ParentFrameBridge`: two handshakes, two `message` listeners, the first bridge
 * orphaned. The level pack and the brand sheet are fetched together at boot, so sharing the
 * promise here is what keeps it a single client.
 *
 * Keyed by instance, not a module-level memo, so distinct GameKITs never share and an entry dies
 * with its kit. A rejection drops the entry, so the next caller retries instead of inheriting a
 * cached failure.
 */

import { GetDynamicDataClientCommand } from '@wolfgames/client';
import { registry } from '../../../schemas/registry';

/** Just enough of the SDK surface to execute one command — the rest of GameKIT is not ours. */
export interface KitLike {
  execute(command: unknown): { promise: Promise<unknown> };
}

/**
 * A Content Pack as the CDN serves it: the entries of every schema the pack points at, keyed by
 * schema then by entry key. The slice of the SDK's `DataPackBundle` the readers use.
 */
export interface PackBundle {
  packKey: string;
  schemas: Record<string, { entries: Record<string, unknown> } | undefined>;
}

export interface EntryClient {
  /**
   * The pack under `packKey` for this game and release. Rejects with `code: 'PACK_NOT_FOUND'`
   * when none is bound — which is every ordinary boot of a game with nothing published.
   */
  getPack(packKey: string): Promise<PackBundle>;
  getEntry(key: string, entryKey: string, options?: { fallbackToDefault?: boolean }): Promise<unknown>;
}

/** The SDK's own "no pack bound under that key" rejection, as opposed to a network failure. */
export function isPackNotFound(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'PACK_NOT_FOUND';
}

/**
 * Every schema an embedding admin frame (the Game Manager preview) may serve instead of the CDN.
 * One client serves the whole registry, so this is the union of what all readers want.
 */
const INTERCEPTED: (keyof typeof registry)[] = ['blocks', 'levels', 'brand'];

const clients = new WeakMap<object, Promise<EntryClient>>();

export function dynamicClient(gameKit: KitLike): Promise<EntryClient> {
  const key = gameKit as object;
  let pending = clients.get(key);
  if (!pending) {
    pending = gameKit
      .execute(new GetDynamicDataClientCommand(registry, null, INTERCEPTED))
      .promise.then((client) => client as EntryClient)
      .catch((err) => {
        clients.delete(key);
        throw err;
      });
    clients.set(key, pending);
  }
  return pending;
}
