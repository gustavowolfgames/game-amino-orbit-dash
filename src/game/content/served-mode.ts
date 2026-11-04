/**
 * Served modes — how a Vault selection maps onto Content Packs (pure).
 *
 *   default   the creative team's own content: the deployment's default pack.
 *   daily     one edition (the Vault's `contentId` IS a pack key); its completion exits to the Vault.
 *
 * The game never reads a schedule. The Vault names the pack for the day and the game loads it.
 * `unlocked_editions` is a reserved `contentId` the Vault sends for its unlocked run; it is a
 * signal, never a pack key, and plays the default pack (game-amino-sort `levels/served-mode.ts`
 * does the same). Like all Vault context it is unauthenticated: never gate entitlement on it.
 */

import type { VaultGameContext } from '@wolfgames/client';

/** Reserved Vault `contentId` for the Vault's unlocked run. Not a pack. */
export const UNLOCKED_EDITIONS_CONTENT_ID = 'unlocked_editions';

export type ServedModeName = 'default' | 'daily';

export interface ServedMode {
  readonly mode: ServedModeName;
  /** The pack key to play. Null for `default` (the deployment's own default pack). */
  readonly pack: string | null;
}

const DEFAULT_MODE: ServedMode = { mode: 'default', pack: null };

/**
 * Which mode a Vault selection asks for, and the pack it plays.
 *
 *   `{type:'default'}`                      → default
 *   `{type:'content', contentId: sentinel}` → default
 *   `{type:'content', contentId: <key>}`    → daily for that pack. The pack fetch is the
 *                                             validation: a key that fails to load leaves the
 *                                             pack in play (see `./load.ts`).
 *   anything else (an unknown shape, an empty id) → default
 */
export function resolveServedMode(
  context: Pick<VaultGameContext, 'content'> | null | undefined,
): ServedMode {
  const content = context?.content as
    | { type?: unknown; contentId?: unknown }
    | undefined;
  if (content?.type !== 'content') return DEFAULT_MODE;
  const { contentId } = content;
  if (typeof contentId !== 'string' || contentId === '') return DEFAULT_MODE;
  if (contentId === UNLOCKED_EDITIONS_CONTENT_ID) return DEFAULT_MODE;
  return { mode: 'daily', pack: contentId };
}
