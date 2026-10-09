/**
 * Loading content + brand together — the one call boot and the Vault bridge share.
 *
 *   loadContent(kit)            boot: `?wolfPack=` or the default pack, plus its brand
 *   loadContent(kit, contentId) a Vault edition: that pack, plus its brand
 *
 * Both fetches never throw and share one Dynamic Data client (and one cached bundle), so this
 * only ever resolves. It is also bounded: past `CONTENT_BUDGET_MS` the caller moves on with
 * whatever is in force (the bundled pack, the build brand) and a late arrival still applies —
 * to the next run for levels, immediately for colours.
 *
 * A frozen build (`VITE_IS_FROZEN`, served with no CDN behind it) skips the network entirely.
 */

import type { ScheduledContentMetadata } from '@wolfgames/client';
import { loadBrand } from '~/game/brand';
import { type KitLike, loadActivePack, loadCatalog, resolvePackKey } from '~/game/content';
import { inVault } from '~/integrations/vault';
import wolfGameKit from '../../../wolf-game-kit.json';

/** The registered Nucleo slug. template-amino dropped `config/identity.ts` in its identity
 *  rework (#97, ENG-4222); its scaffold now reads the slug from the config service, which
 *  this plain module cannot reach, so it reads the same value from wolf-game-kit.json. */
const GAME_SLUG = wolfGameKit.gameSlug;

/** How long boot (or Play) waits on Dynamic Data before going with what it has. */
export const CONTENT_BUDGET_MS = 4000;

const isFrozen = () => import.meta.env.VITE_IS_FROZEN === 'true';

let settled: Promise<void> = Promise.resolve();
let editions: ScheduledContentMetadata[] = [];

/**
 * The Daily Editions schedule loaded at boot, for the Vault runtime's `content_catalog`. The
 * runtime starts after loading, so it is always settled by the time the bridge reads it.
 */
export function getEditions(): readonly ScheduledContentMetadata[] {
  return editions;
}

/**
 * Fetch and apply the pack and brand for `selection` (a Vault `contentId`), bounded. The boot
 * call (no selection) inside a Vault also loads the edition schedule the manager harvests.
 */
export function loadContent(gameKit: KitLike | null | undefined, selection: string | null = null): Promise<void> {
  if (!gameKit || isFrozen()) return Promise.resolve();
  const packKey = resolvePackKey(selection);
  const schedule =
    selection === null && inVault()
      ? loadCatalog(gameKit, GAME_SLUG).then((list) => {
          editions = list;
        })
      : null;
  const work = Promise.all([loadActivePack(gameKit, packKey, selection), loadBrand(gameKit, packKey), schedule]).then(
    () => undefined,
  );
  const bounded = Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, CONTENT_BUDGET_MS))]);
  settled = bounded;
  return bounded;
}

/**
 * Resolves once the latest `loadContent` has settled (or run out of budget). The start screen
 * awaits it on Play, so a Vault edition selected a moment before the tap is the one that plays.
 */
export function whenContentSettled(): Promise<void> {
  return settled;
}
