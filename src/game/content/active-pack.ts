/**
 * The active-pack seam. ONE place decides which levels the game plays.
 *
 * The game controller asks `levelAt(n)` instead of reading constants, so the selection — the
 * bundled pack, a published default, a `?wolfPack=` override, a Vault edition — changes in this
 * one spot without touching gameplay code. Three rules make it safe:
 *
 *   1. It is read SYNCHRONOUSLY and starts out holding the bundled pack, so a read before boot
 *      (dev, tests, headless) still resolves to a playable level.
 *   2. Only validated, playable levels are ever seeded (`./load.ts`); anything else leaves the
 *      pack in play as it was.
 *   3. A published pack and the bundled one produce the identical `ResolvedLevel`. Selecting a
 *      pack changes provenance only, never behaviour.
 *
 * Not game state: which levels exist is content, chosen before a run. The run's progress (the
 * level index, the score) lives in ECS.
 */

import { packLevels } from './content-pack';
import { BUNDLED_PACK, parseLevel, type ResolvedLevel } from './level';

export interface ActivePack {
  /** The Content Pack key, recorded on analytics and in the Inspector. */
  readonly id: string;
  /** Playable levels, in play order. Never empty. */
  readonly levels: readonly ResolvedLevel[];
  /** Where it came from: shipped in the build, or fetched from Dynamic Data. */
  readonly source: 'bundled' | 'published';
  /** The Vault `contentId` that selected it, when one did — reported back on completion. */
  readonly contentId: string | null;
}

const bundled: ActivePack = {
  id: BUNDLED_PACK.id,
  levels: packLevels(BUNDLED_PACK).map((l) => parseLevel(l) as ResolvedLevel),
  source: 'bundled',
  contentId: null,
};

let active: ActivePack = bundled;
const listeners = new Set<(pack: ActivePack) => void>();

/** Install the pack in play; `null` restores the bundled pack (tests, a Vault deselection). */
export function seedActivePack(pack: ActivePack | null): void {
  active = pack && pack.levels.length > 0 ? pack : bundled;
  for (const fn of listeners) fn(active);
}

/** The pack in play — the bundled one until a published pack is seeded. */
export function getActivePack(): ActivePack {
  return active;
}

/** Subscribe to pack changes (a Vault selection mid-session). Returns the unsubscribe. */
export function onActivePackChange(fn: (pack: ActivePack) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The level at 0-based `index`, wrapping so "play again" past the end loops the pack. */
export function levelAt(index: number): ResolvedLevel {
  const { levels } = active;
  const i =
    ((Math.trunc(index) % levels.length) + levels.length) % levels.length;
  return levels[i];
}

/** True when `index` is the pack's last level — the edition's completion boundary. */
export function isLastLevel(index: number): boolean {
  return Math.trunc(index) >= active.levels.length - 1;
}
