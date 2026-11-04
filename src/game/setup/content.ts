/**
 * Loading content + brand together — the one call boot and the Vault bridge share.
 *
 *   loadBootContent(kit)        boot: in a Vault, the first context's selection (waited for,
 *                               bounded); else `?wolfPack=` or the default pack. Plus its brand
 *   loadContent(kit)            `?wolfPack=` or the default pack, plus its brand
 *   loadContent(kit, contentId) a Vault edition: that pack, plus its brand
 *
 * Both fetches never throw and share one Dynamic Data client (and one cached bundle), so this
 * only ever resolves. It is also bounded: past `CONTENT_BUDGET_MS` the caller moves on with
 * whatever is in force (the bundled pack, the build brand) and a late arrival still applies —
 * to the next run for levels, immediately for colours.
 *
 * A frozen build (`VITE_IS_FROZEN`, served with no CDN behind it) skips the network entirely.
 */

import { loadBrand } from '~/game/brand';
import {
  type KitLike,
  loadActivePack,
  resolvePackKey,
  UNLOCKED_EDITIONS_CONTENT_ID,
} from '~/game/content';
import { awaitFirstVaultContext, inVault } from '~/integrations/vault';

/** How long boot (or Play) waits on Dynamic Data before going with what it has. */
export const CONTENT_BUDGET_MS = 4000;

/**
 * The first-context gate: how long a Vault boot waits for the host's first `context` before
 * it resolves the pack. Spent before `CONTENT_BUDGET_MS`, and only inside a Vault. On timeout
 * the boot goes with `?wolfPack=` / the default pack, and the selection still applies when the
 * Vault re-sends it on `ready` (via the bridge).
 */
export const VAULT_CONTEXT_WAIT_MS = 3000;

const isFrozen = () => import.meta.env.VITE_IS_FROZEN === 'true';

let settled: Promise<void> = Promise.resolve();
let bootSelection: string | null = null;
let warnedNoContext = false;

/**
 * The Vault `contentId` the boot applied, or null (outside a Vault, a `default` context, or the
 * gate timed out). The Vault bridge starts from it, so the context re-sent on `ready` is not
 * fetched a second time — and one the boot missed is.
 */
export function getBootSelection(): string | null {
  return bootSelection;
}

/** Pack + brand, raced against `CONTENT_BUDGET_MS`. */
function fetchContent(
  gameKit: KitLike,
  selection: string | null,
): Promise<void> {
  const packKey = resolvePackKey(selection);
  const work = Promise.all([
    loadActivePack(gameKit, packKey, selection),
    loadBrand(gameKit, packKey),
  ]).then(() => undefined);
  return Promise.race([
    work,
    new Promise<void>((resolve) => setTimeout(resolve, CONTENT_BUDGET_MS)),
  ]);
}

/**
 * Fetch and apply the pack and brand for `selection` (a Vault `contentId`), bounded.
 */
export function loadContent(
  gameKit: KitLike | null | undefined,
  selection: string | null = null,
): Promise<void> {
  if (!gameKit || isFrozen()) return Promise.resolve();
  settled = fetchContent(gameKit, selection);
  return settled;
}

/**
 * The boot load. Outside a Vault it is `loadContent(kit)`, with no wait. Inside one it is the
 * first-context gate: wait (at most `VAULT_CONTEXT_WAIT_MS`) for the host's first `context`
 * and load its selection, so a Vault boot never plays the bundled pack first. A timeout logs
 * once and boots as before. Never rejects.
 */
export function loadBootContent(
  gameKit: KitLike | null | undefined,
): Promise<void> {
  if (!gameKit || isFrozen()) return Promise.resolve();
  if (!inVault()) return loadContent(gameKit);
  settled = awaitFirstVaultContext(VAULT_CONTEXT_WAIT_MS).then((context) => {
    if (context === null && !warnedNoContext) {
      warnedNoContext = true;
      console.warn(
        `[vault] no host context within ${VAULT_CONTEXT_WAIT_MS}ms — booting the default pack; the selection applies when it arrives.`,
      );
    }
    // `unlocked_editions` is a Vault signal, not a pack: it boots the default pack.
    const asked =
      context?.content.type === 'content' ? context.content.contentId : null;
    bootSelection = asked === UNLOCKED_EDITIONS_CONTENT_ID ? null : asked;
    return fetchContent(gameKit, bootSelection);
  });
  return settled;
}

/**
 * Resolves once the latest `loadContent` has settled (or run out of budget). The start screen
 * awaits it on Play, so a Vault edition selected a moment before the tap is the one that plays.
 */
export function whenContentSettled(): Promise<void> {
  return settled;
}
