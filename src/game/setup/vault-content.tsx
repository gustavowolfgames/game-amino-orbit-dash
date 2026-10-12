/**
 * Daily Editions consumer — maps the Vault's selection onto a Content Pack.
 *
 * The Vault's `contentId` IS a pack key (the manager's harvest reads `catalog/<slug>`, see
 * docs/recipes/game-packs.md), so a selection is just `loadContent(kit, contentId)`. Handles the
 * consumer hazards in `src/integrations/vault/README.md`:
 *
 *   1. Completion is game-owned: the game controller reports it when the pack's last level is
 *      won (`reportContentCompleted(contentId)`, else `reportGameCompleted()`).
 *   2. A new selection mid-play never yanks the board: loading only re-seeds the pack, and the
 *      controller reads it at the next run's start.
 *   3. Nothing activates during `loading`: the bridge starts the runtime only after it.
 *   4. `default` after a selection is a deselection: drop the edition and its brand, then reload
 *      the deployment's own default pack and theme.
 *
 * It also answers the manager's Daily Editions harvest: the schedule (`catalog/<slug>`) loaded at
 * boot goes out as `content_catalog` when the runtime starts.
 *
 * Inert outside a Vault (the bridge renders nothing). Mount inside `<ScreenProvider>`.
 */

import { useConfigState, useSignal } from '@wolfgames/components/solid';
import { resetBrand } from '~/game/brand';
import { seedActivePack } from '~/game/content';
import { type VaultGameContext, VaultHostBridge } from '~/integrations/vault';
import { getEditions, loadContent } from './content';

export function VaultContentBridge() {
  const gameKit = useSignal(useConfigState().gameKit);
  let selected: string | null = null;

  const onContext = (ctx: VaultGameContext) => {
    if (ctx.content.type === 'default') {
      if (selected === null) return; // nothing was selected — the boot content stands
      selected = null;
      seedActivePack(null);
      resetBrand();
      void loadContent(gameKit());
      return;
    }
    const { contentId } = ctx.content;
    if (contentId === selected) return;
    selected = contentId;
    void loadContent(gameKit(), contentId);
  };

  // `catalog` is read when the runtime starts (after loading, when boot has loaded the schedule);
  // Solid passes it as a getter, so the bridge sees the settled list, not the empty initial one.
  return <VaultHostBridge onContext={onContext} catalog={getEditions()} />;
}
