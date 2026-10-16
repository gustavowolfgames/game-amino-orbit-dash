/**
 * Served modes — how a Vault selection maps onto Content Packs (pure; productionization #17).
 *
 *   default   the creative team's own content: the deployment's default pack, as today.
 *   daily     one edition (the Vault's `contentId` IS a pack key); its completion exits to the Vault.
 *   unlocked  every edition opened so far, oldest first, back to back.
 *
 * `unlocked` is a reserved `contentId`, `UNLOCKED_EDITIONS_CONTENT_ID`, the same sentinel the
 * reference games use (game-amino-sort `levels/served-mode.ts`, amino-word-game
 * `platform/unlocked.ts`, game-amino-memory-match `daily-editions.ts`). It is a Vault signal, never
 * a pack key, and — like all context — unauthenticated: never gate entitlement on it.
 *
 * No clock, no I/O: `now` and the schedule are passed in, so every branch is a table test.
 */

import type {
  ScheduledContentMetadata,
  VaultGameContext,
} from '@wolfgames/client';

/** Reserved Vault `contentId` meaning "play every unlocked edition", not a pack. */
export const UNLOCKED_EDITIONS_CONTENT_ID = 'unlocked_editions';

export type ServedModeName = 'default' | 'daily' | 'unlocked';

export interface ServedMode {
  readonly mode: ServedModeName;
  /**
   * The pack keys to play, in order. Empty for `default` (the deployment's own default pack,
   * `loadContent(kit)`); one key for `daily`; the schedule walk for `unlocked`.
   */
  readonly packs: readonly string[];
}

const DEFAULT_MODE: ServedMode = { mode: 'default', packs: [] };

/** The schedule's calendar day for `now` — `YYYY-MM-DD`, UTC, as `schemas/catalog` dates are. */
export function scheduleDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The unlocked walk: every scheduled edition already open on `now` (`availableFrom <= today`),
 * oldest first, each key once. Future editions never leak into it.
 */
export function unlockedPacks(
  catalog: readonly ScheduledContentMetadata[],
  now: Date,
): string[] {
  const today = scheduleDay(now);
  const seen = new Set<string>();
  return [...catalog]
    .filter(
      (e) =>
        e.contentId !== '' &&
        e.contentId !== UNLOCKED_EDITIONS_CONTENT_ID &&
        e.availableFrom <= today,
    )
    .sort(
      (a, b) =>
        a.availableFrom.localeCompare(b.availableFrom) ||
        a.contentId.localeCompare(b.contentId),
    )
    .map((e) => e.contentId)
    .filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Which mode a Vault selection asks for, and the packs it plays.
 *
 *   `{type:'default'}`                     → default
 *   `{type:'content', contentId: sentinel}` → unlocked over the open editions; nothing open yet →
 *                                            default (the authored run, as game-amino-sort does)
 *   `{type:'content', contentId: <key>}`   → daily for that pack. Not checked against `catalog`:
 *                                            the Vault only offers harvested ids, and the pack
 *                                            fetch is the validation (a key that fails to load
 *                                            leaves the pack in play — see `./load.ts`).
 *   anything else (an unknown selection shape, an empty id) → default
 */
export function resolveServedMode(
  context: Pick<VaultGameContext, 'content'> | null | undefined,
  catalog: readonly ScheduledContentMetadata[],
  now: Date,
): ServedMode {
  const content = context?.content as
    | { type?: unknown; contentId?: unknown }
    | undefined;
  if (content?.type !== 'content') return DEFAULT_MODE;
  const { contentId } = content;
  if (typeof contentId !== 'string' || contentId === '') return DEFAULT_MODE;
  if (contentId === UNLOCKED_EDITIONS_CONTENT_ID) {
    const packs = unlockedPacks(catalog, now);
    return packs.length > 0 ? { mode: 'unlocked', packs } : DEFAULT_MODE;
  }
  return { mode: 'daily', packs: [contentId] };
}

/** A walk over the unlocked editions. Ends after the last one — it never wraps. */
export interface EditionCursor {
  /** The pack key in play, or null once the walk has ended. */
  current(): string | null;
  /** Move past the current pack. Returns the next key, or null when the walk has ended. */
  advance(): string | null;
  /** True once every pack has been played. */
  done(): boolean;
}

export function createEditionCursor(
  packs: readonly string[],
  start = 0,
): EditionCursor {
  const order = [...packs];
  let index = Math.max(0, Math.trunc(start));
  const current = () => (index < order.length ? order[index] : null);
  return {
    current,
    advance() {
      if (index < order.length) index++;
      return current();
    },
    done: () => index >= order.length,
  };
}
