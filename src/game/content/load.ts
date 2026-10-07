/**
 * Content Pack fetch — the only async step in the content path.
 *
 * Called at boot from the loading screen (and again when a Vault edition is selected), before a
 * level is read. It fetches the Content Pack, joins it, validates every level, and seeds
 * `./active-pack`; from then on the game reads levels synchronously through `levelAt`.
 *
 * It NEVER throws. GameSDK missing, network down, no pack bound, a key the bundle cannot
 * resolve, a pack for another game, no playable level — every one of those leaves the pack in
 * play untouched, which at boot is the bundled pack. The game always boots playable.
 */

import { GAME_SLUG } from '~/game/config/identity';
import { type ActivePack, seedActivePack } from './active-pack';
import { assemblePack } from './assemble';
import { dynamicClient, isPackNotFound, type KitLike } from './dynamic-client';
import { DEFAULT_PACK_KEY, parseLevel, type ResolvedLevel } from './level';

/**
 * Which Content Pack to ask for, in order: `?wolfPack=<key>` — the SDK's own override, so one
 * link shows QA an edition with no deploy; the Vault's `selection` (its `contentId` IS a pack
 * key); else the default key the build's own pack is published under. Every environment honours
 * the param: a deployed QA build is where a pack is tried, and a tester's link beats the host.
 */
export function resolvePackKey(selection?: string | null): string {
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('wolfPack');
  return asked || selection || DEFAULT_PACK_KEY;
}

const fallback = "keeping the pack in play";

/**
 * Fetch, join, validate and seed the pack under `packKey`. Resolves to the pack now in play, or
 * null when nothing was seeded (the pack in play is unchanged).
 */
export async function loadActivePack(
  gameKit: KitLike | null | undefined,
  packKey: string,
  contentId: string | null = null,
): Promise<ActivePack | null> {
  if (!gameKit) return null;

  let assembled: ReturnType<typeof assemblePack>;
  try {
    const client = await dynamicClient(gameKit);
    assembled = assemblePack(await client.getPack(packKey), GAME_SLUG);
  } catch (err) {
    // No pack under the default key is every ordinary boot with nothing published — not worth
    // a line. No pack under a key someone typed or a Vault sent is.
    if (!isPackNotFound(err) || packKey !== DEFAULT_PACK_KEY) {
      console.warn(`[content] pack "${packKey}" unavailable — ${fallback}.`, err);
    }
    return null;
  }
  if (typeof assembled === 'string') {
    console.warn(`[content] pack "${packKey}" refused: ${assembled} — ${fallback}.`);
    return null;
  }

  const levels: ResolvedLevel[] = [];
  assembled.levels.forEach((raw, i) => {
    const level = parseLevel(raw);
    if (level) levels.push(level);
    else console.warn(`[content] pack "${assembled.id}" level ${i + 1} is not playable here — dropped.`);
  });
  if (levels.length === 0) {
    if (assembled.levels.length > 0) {
      console.warn(`[content] pack "${assembled.id}" has no playable level — ${fallback}.`);
    }
    return null;
  }

  const pack: ActivePack = { id: assembled.id, levels, source: 'published', contentId };
  seedActivePack(pack);
  return pack;
}
