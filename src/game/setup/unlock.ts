/**
 * unlock — the dev/QA `?unlock=all` start: everything open, so any level or feature can be
 * reached for a feel pass, a QA check or a frame capture.
 *
 * Each save says what "everything open" means for itself, next to its store:
 *
 *   onUnlockAll('progress', () => saveProgress(pack.id, pack.levels.length - 1));
 *
 * A hook writes through its registered store (./saves.ts), so the game then reads the real save
 * with no dev branch, and Reset Progress undoes it. `LoadingScreen` calls `unlockAllAtBoot` once
 * the content has settled, so "the active pack" is the one that will play. The gate is
 * `asksUnlockAll` (./devLinks.ts): off for players.
 */

import { asksUnlockAll } from './devLinks';

const hooks = new Map<string, () => void>();

/**
 * Register what `?unlock=all` does for save `name`. Registering a name again replaces the hook
 * (a hot reload re-runs the module). Returns a remover.
 */
export function onUnlockAll(name: string, unlock: () => void): () => void {
  hooks.set(name, unlock);
  return () => {
    if (hooks.get(name) === unlock) hooks.delete(name);
  };
}

/** Run every hook, in registration order. A hook that throws is logged and skipped.
 *  Returns the names that ran. */
export function unlockAll(): string[] {
  const ran: string[] = [];
  for (const [name, unlock] of hooks) {
    try {
      unlock();
      ran.push(name);
    } catch (err) {
      console.warn(`?unlock=all: the "${name}" hook failed`, err);
    }
  }
  return ran;
}

/** `unlockAll` when the URL asks for it in a dev/QA build; else nothing. */
export function unlockAllAtBoot(search?: string, on?: boolean): string[] {
  return asksUnlockAll(search, on) ? unlockAll() : [];
}
