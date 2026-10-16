/**
 * The Daily Editions schedule this game answers the Game Manager's harvest with
 * (`content_catalog`): every Content Pack key in the game's `catalog/<slug>` entry with the day it
 * opens, oldest first. The Vault owns selection and pacing; this is metadata only.
 *
 * Read only inside a Vault (the harvest boots the game hidden there and asks), never on a plain
 * launch. It NEVER throws: no GameSDK, nothing published, a malformed entry — all answer an empty
 * list, which the Vault shows as a game with no editions.
 */

import type { ScheduledContentMetadata } from '@wolfgames/client';
import { type } from 'arktype';
import { type CatalogData, CatalogDef } from '../../../schemas/catalog/schema';
import { dynamicClient, type KitLike } from './dynamic-client';

/** Parse one payload into the wire shape, sorted by day then key; null when it is not a catalog. */
export function toEditions(raw: unknown): ScheduledContentMetadata[] | null {
  const out = CatalogDef(raw);
  if (out instanceof type.errors) return null;
  return Object.entries(out as CatalogData)
    .map(([contentId, availableFrom]) => ({ contentId, availableFrom }))
    .sort(
      (a, b) =>
        a.availableFrom.localeCompare(b.availableFrom) ||
        a.contentId.localeCompare(b.contentId),
    );
}

export async function loadCatalog(
  gameKit: KitLike | null | undefined,
  gameSlug: string,
): Promise<ScheduledContentMetadata[]> {
  if (!gameKit) return [];
  let raw: unknown;
  try {
    const client = await dynamicClient(gameKit);
    raw = await client.getEntry('catalog', gameSlug, {
      fallbackToDefault: true,
    });
  } catch (err) {
    console.warn(
      `[content] catalog "${gameSlug}" unavailable — answering no editions.`,
      err,
    );
    return [];
  }
  const editions = toEditions(raw);
  if (!editions) {
    console.warn(
      `[content] catalog "${gameSlug}" refused: not a schedule — answering no editions.`,
    );
    return [];
  }
  return editions;
}
