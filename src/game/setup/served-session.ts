/**
 * The served session — the one owner of the Vault served mode, pack sequencing and the exit.
 *
 *   select(content)   a Vault selection → `resolveServedMode` → load its pack
 *   packCompleted()   the active pack's last level was won → report, or keep the player here
 *
 * The game never reads a schedule: the Vault names the pack and the game loads it. What a
 * completed pack does, by mode:
 *
 *   default   `reportGameCompleted()` — the authored run is done. The Vault's `unlocked_editions`
 *             signal is this mode too.
 *   daily     `reportContentCompleted(contentId)` — the edition is done and the Vault takes the
 *             player back (a completion report tears the Vault iframe down). Sent once.
 *
 * `play_ended` is NOT the exit: it means "the player left", never completion (host-bridge.ts).
 *
 * Collaborators are injected so the decisions are unit-tested without Solid, a GameSDK or a Vault;
 * `vault-content.tsx` installs the real ones. Outside a Vault nothing installs a session, and
 * `completeActivePack()` reports nothing.
 */

import type { VaultGameContext } from '@wolfgames/client';
import {
  resolveServedMode,
  type ServedModeName,
} from '~/game/content/served-mode';

export interface ServedSessionDeps {
  /** Load a pack key (seeds the active pack), or `null`: drop any edition, back to the default. */
  load(packKey: string | null): void;
  /** The pack in play's Vault `contentId` (`getActivePack().contentId`). */
  activeContentId(): string | null;
  reportContentCompleted(contentId: string): void;
  reportGameCompleted(): void;
}

/**
 * Where the end of a pack leads: the Vault takes over (a completion report went out, and the
 * Vault shows its own end screen), or the game keeps the player on this pack (outside a Vault,
 * or a report that doesn't apply).
 */
export type PackEnd = 'vault' | 'replay';

export interface ServedSession {
  /** The mode in force. */
  mode(): ServedModeName;
  /** Obey a Vault selection. Identical re-sends are ignored. */
  select(content: VaultGameContext['content']): void;
  /** The active pack's last level was won: report or neither (`PackEnd`). */
  packCompleted(): PackEnd;
}

export function createServedSession(deps: ServedSessionDeps): ServedSession {
  let mode: ServedModeName = 'default';
  /** The raw `contentId` last selected; null = default (nothing selected). */
  let selected: string | null = null;
  /** The first selection always runs: boot may have loaded a pack the session never chose. */
  let seen = false;
  /** The session's terminal report went out (daily exit / unlocked end). */
  let ended = false;

  return {
    mode: () => mode,

    select(content) {
      const id = content.type === 'content' ? content.contentId : null;
      if (seen && id === selected) return; // a re-send
      seen = true;
      selected = id;
      const was = mode;
      const served = resolveServedMode({ content });
      mode = served.mode;
      ended = false;
      if (served.pack === null) {
        // Drop any edition in play, including one boot loaded before the session saw a selection.
        if (was !== 'default' || deps.activeContentId() !== null)
          deps.load(null);
        return;
      }
      deps.load(served.pack);
    },

    packCompleted() {
      if (ended) return 'replay';
      switch (mode) {
        case 'default':
          // A pending deselection still has the edition in play — that run is not the default.
          if (deps.activeContentId() !== null) return 'replay';
          deps.reportGameCompleted();
          return 'vault';
        case 'daily':
          // Only the edition itself completes the edition: a pack that failed to load (the
          // bundled one still in play) never reports it.
          if (selected === null || deps.activeContentId() !== selected)
            return 'replay';
          ended = true;
          deps.reportContentCompleted(selected);
          return 'vault';
      }
    },
  };
}

let session: ServedSession | null = null;

/** Install the session the Vault bridge drives (`null` uninstalls — tests, teardown). */
export function installServedSession(next: ServedSession | null): void {
  session = next;
}

/**
 * The game controller's completion boundary: the active pack's last level was won. Routed through
 * the served mode; outside a Vault (no session installed) it reports nothing and the pack replays.
 */
export function completeActivePack(): PackEnd {
  return session?.packCompleted() ?? 'replay';
}
