/**
 * progress — the saved run: which level of which Content Pack to resume on.
 *
 * ECS stays the source of truth while a run is live (`level`, `packId` resources). This store
 * only copies the resume point out so a reload lands on the same level, and hands it back to
 * the `startRun` transaction on the next run. Rules:
 *
 *   • Versioned on `createVersionedStore` (src/core/utils/storage.ts): `version`, a migration
 *     per shape change, and a `validate` that resets unusable data. A save from a newer build
 *     (future version) reads as defaults — the core guards that.
 *   • Sanitised on read: a usable record with a bad field (negative, fractional, `null` level) is
 *     repaired, not thrown away; a level past the pack's end clamps to its last level.
 *   • Scoped to one pack: the save carries the pack id. A new Content Pack (a Vault edition, a
 *     published default) resets it — `onActivePackChange` clears a save from another pack, and
 *     `resumeLevel` ignores one that does not match the pack in play.
 *   • Cleared when the pack's last level is won, so the next run starts the pack over.
 *
 * Built at module scope so boot's `whenStoresReady()` hydrates it before the first screen.
 * A new game keeps this shape and swaps the fields (see .agents/recipes/dynamic-data.md, "Saved progress").
 */

import { createVersionedStore } from '~/core/utils/storage';
import {
  type ActivePack,
  BUNDLED_PACK,
  onActivePackChange,
} from '~/game/content';
import wolfGameKit from '../../../wolf-game-kit.json';

export const PROGRESS_VERSION = 2;

/** SDK app id — the envelope lives under `${PROGRESS_KEY}_save_data`. One per game slug. */
export const PROGRESS_KEY = `${wolfGameKit.gameSlug}:progress`;

export interface RunProgress {
  version: number;
  /** The Content Pack the saved level belongs to; '' when nothing is saved. */
  packId: string;
  /** 0-based index of the level to resume on. */
  level: number;
}

export const PROGRESS_DEFAULTS: RunProgress = {
  version: PROGRESS_VERSION,
  packId: '',
  level: 0,
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A whole, non-negative level index; anything else repairs to 0. */
const toLevel = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;

/**
 * v1 → v2. v1 (`{ version: 1, level }`) predates Content Packs: it held only the level index,
 * and every v1 save was the bundled pack's. Migrations are keyed by the version they produce.
 */
export function migrateProgressV2(old: unknown): Partial<RunProgress> {
  return {
    packId: BUNDLED_PACK.id,
    level: toLevel(isRecord(old) ? old.level : undefined),
  };
}

/** Usable enough to repair: a record with a string pack id. Anything else resets to defaults. */
export function isProgress(data: unknown): boolean {
  return isRecord(data) && typeof data.packId === 'string';
}

/** The record as the game may trust it: defaults when unusable, fields repaired otherwise. */
export function sanitizeProgress(data: unknown): RunProgress {
  if (!isProgress(data)) return { ...PROGRESS_DEFAULTS };
  const record = data as Record<string, unknown>;
  return {
    version: PROGRESS_VERSION,
    packId: record.packId as string,
    level: toLevel(record.level),
  };
}

/** The level to resume `pack` on: the saved one when it is this pack's, clamped; else 0. */
export function resumeLevelFrom(
  data: RunProgress,
  pack: Pick<ActivePack, 'id' | 'levels'>,
): number {
  if (data.packId !== pack.id) return 0;
  return Math.min(data.level, Math.max(0, pack.levels.length - 1));
}

const store = createVersionedStore<RunProgress>({
  key: PROGRESS_KEY,
  version: PROGRESS_VERSION,
  defaults: PROGRESS_DEFAULTS,
  migrations: { 2: migrateProgressV2 },
  validate: isProgress,
});

/** The saved run, sanitised. */
export function loadProgress(): RunProgress {
  return sanitizeProgress(store.load());
}

/** The level index to start `pack` on after a reload (0 for a fresh or another pack's save). */
export function resumeLevel(pack: Pick<ActivePack, 'id' | 'levels'>): number {
  return resumeLevelFrom(loadProgress(), pack);
}

/** Save the resume point: level `level` of pack `packId`. */
export function saveProgress(packId: string, level: number): void {
  store.save({ version: PROGRESS_VERSION, packId, level: toLevel(level) });
}

/** Drop the saved run (pack completed, Reset Progress). */
export function clearProgress(): void {
  store.clear();
}

/** A level was won: resume on the next one, or start over when it was the pack's last. */
export function recordLevelWon(
  packId: string,
  level: number,
  wasLast: boolean,
): void {
  if (wasLast) clearProgress();
  else saveProgress(packId, level + 1);
}

/** A pack is now in play: a save from a different pack is mid-play state for content that is gone. */
export function syncProgressPack(packId: string): void {
  const saved = loadProgress();
  if (saved.packId !== '' && saved.packId !== packId) clearProgress();
}

onActivePackChange((pack) => syncProgressPack(pack.id));
