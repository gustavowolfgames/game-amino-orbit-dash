/**
 * Daily Editions consumer — maps the Vault's selection onto Content Packs through the served
 * session (`./served-session.ts`): default, one daily edition, or the unlocked walk.
 *
 * The Vault's `contentId` IS a pack key (the manager's harvest reads `catalog/<slug>`, see
 * .agents/recipes/dynamic-data.md), so loading a pack is just `loadContent(kit, packKey)`. Handles the
 * consumer hazards in `src/integrations/vault/README.md`:
 *
 *   1. Completion is game-owned: the game controller calls `completeActivePack()` when the pack's
 *      last level is won, and the served mode decides what that means (report, next edition, or
 *      exit to the Vault).
 *   2. A new selection mid-play never yanks the board: loading only re-seeds the pack, and the
 *      controller reads it at the next run's start.
 *   3. Nothing activates during `loading`: the bridge starts the runtime only after it.
 *   4. `default` after a selection is a deselection: drop the edition and its brand, then reload
 *      the deployment's own default pack and theme.
 *
 * The first selection is normally applied during `loading` by the boot's first-context gate
 * (`loadBootContent`); this bridge starts from it, so the Vault's re-send on `ready` is a no-op.
 *
 * It also answers the manager's Daily Editions harvest: the schedule (`catalog/<slug>`) loaded at
 * boot goes out as `content_catalog` when the runtime starts.
 *
 * Inert outside a Vault (the bridge renders nothing). Mount inside `<ScreenProvider>`.
 */

import { useConfigState, useSignal } from '@wolfgames/components/solid';
import { onCleanup } from 'solid-js';
import { resetBrand } from '~/game/brand';
import { getActivePack, seedActivePack } from '~/game/content';
import {
  inVault,
  reportContentCompleted,
  reportGameCompleted,
  type VaultGameContext,
  VaultHostBridge,
} from '~/integrations/vault';
import { getBootSelection, getEditions, loadContent } from './content';
import { createServedSession, installServedSession } from './served-session';

export function VaultContentBridge() {
  const gameKit = useSignal(useConfigState().gameKit);

  // The boot's first-context gate already loaded the Vault's first selection (or the default):
  // the session's first load of that same pack is skipped, so it is not loaded twice.
  let bootPending = true;
  const session = createServedSession({
    load: (packKey) => {
      const fromBoot = bootPending && packKey === getBootSelection();
      bootPending = false;
      if (fromBoot) return;
      if (packKey === null) {
        seedActivePack(null);
        resetBrand();
      }
      void loadContent(gameKit(), packKey);
    },
    activeContentId: () => getActivePack().contentId,
    catalog: getEditions,
    now: () => new Date(),
    reportContentCompleted: (contentId) => {
      reportContentCompleted(contentId);
    },
    reportGameCompleted: () => {
      reportGameCompleted();
    },
  });
  // Installed only inside a Vault: standalone, `completeActivePack()` reports nothing.
  if (inVault()) {
    installServedSession(session);
    onCleanup(() => installServedSession(null));
  }

  const onContext = (ctx: VaultGameContext) => session.select(ctx.content);

  // `catalog` is read when the runtime starts (after loading, when boot has loaded the schedule);
  // Solid passes it as a getter, so the bridge sees the settled list, not the empty initial one.
  return <VaultHostBridge onContext={onContext} catalog={getEditions()} />;
}
