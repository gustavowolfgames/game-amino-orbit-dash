/**
 * The served session — the one owner of the Vault served mode, pack sequencing and the exit.
 *
 *   select(content)   a Vault selection → `resolveServedMode` → load the mode's first pack
 *   packCompleted()   the active pack's last level was won → report, advance, or exit
 *
 * What a completed pack does, by mode:
 *
 *   default   `reportGameCompleted()` — the authored run is done (as before).
 *   daily     `reportContentCompleted(contentId)` — the edition is done and the Vault takes the
 *             player back (a completion report tears the Vault iframe down). Sent once.
 *   unlocked  advance the cursor to the next open edition and load it (`seedActivePack` fires
 *             `onActivePackChange`, and the next run starts on its level 1). No per-edition
 *             report: any completion would end the session mid-walk (amino-word-game
 *             `platform/unlocked.ts`). After the last edition, `reportGameCompleted()` once, as
 *             game-amino-memory-match does for its unlocked run.
 *
 * `play_ended` is NOT the exit: it means "the player left", never completion (host-bridge.ts).
 *
 * Collaborators are injected so the decisions are unit-tested without Solid, a GameSDK or a Vault;
 * `vault-content.tsx` installs the real ones. Outside a Vault nothing installs a session, and
 * `completeActivePack()` reports nothing.
 */

import type {
  ScheduledContentMetadata,
  VaultGameContext,
} from '@wolfgames/client';
import {
  createEditionCursor,
  type EditionCursor,
  resolveServedMode,
  type ServedModeName,
} from '~/game/content/served-mode';

export interface ServedSessionDeps {
  /** Load a pack key (seeds the active pack), or `null`: drop any edition, back to the default. */
  load(packKey: string | null): void;
  /** The pack in play's Vault `contentId` (`getActivePack().contentId`). */
  activeContentId(): string | null;
  /** The Daily Editions schedule loaded at boot. */
  catalog(): readonly ScheduledContentMetadata[];
  now(): Date;
  reportContentCompleted(contentId: string): void;
  reportGameCompleted(): void;
}

export interface ServedSession {
  /** The mode in force. */
  mode(): ServedModeName;
  /** Obey a Vault selection. Identical re-sends are ignored. */
  select(content: VaultGameContext['content']): void;
  /** The active pack's last level was won. True when a completion report went out: the Vault
   *  takes the player from here (its own end screen), so the game shows none of its own. */
  packCompleted(): boolean;
}

export function createServedSession(deps: ServedSessionDeps): ServedSession {
  let mode: ServedModeName = 'default';
  /** The raw `contentId` last selected; null = default (nothing selected). */
  let selected: string | null = null;
  let cursor: EditionCursor | null = null;
  /** The session's terminal report went out (daily exit / unlocked end). */
  let ended = false;

  return {
    mode: () => mode,

    select(content) {
      const id = content.type === 'content' ? content.contentId : null;
      if (id === selected) return; // a re-send, or `default` with nothing selected
      selected = id;
      const was = mode;
      const served = resolveServedMode({ content }, deps.catalog(), deps.now());
      mode = served.mode;
      ended = false;
      cursor =
        served.mode === 'unlocked' ? createEditionCursor(served.packs) : null;
      if (served.mode === 'default') {
        // A deselection drops the edition; a default with nothing loaded leaves the boot content.
        if (was !== 'default') deps.load(null);
        return;
      }
      deps.load(cursor ? cursor.current() : served.packs[0]);
    },

    packCompleted() {
      if (ended) return false;
      switch (mode) {
        case 'default':
          // A pending deselection still has the edition in play — that run is not the default.
          if (deps.activeContentId() !== null) return false;
          deps.reportGameCompleted();
          return true;
        case 'daily':
          // Only the edition itself completes the edition: a pack that failed to load (the
          // bundled one still in play) never reports it.
          if (selected === null || deps.activeContentId() !== selected)
            return false;
          ended = true;
          deps.reportContentCompleted(selected);
          return true;
        case 'unlocked': {
          const next = cursor?.advance() ?? null;
          if (next !== null) {
            deps.load(next);
            return false;
          }
          ended = true;
          deps.reportGameCompleted();
          return true;
        }
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
 * the served mode; inert outside a Vault (no session installed). True when the Vault takes over.
 */
export function completeActivePack(): boolean {
  return session?.packCompleted() ?? false;
}
