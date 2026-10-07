/**
 * The join and the split between a Content Pack bundle and the pack the game plays.
 *
 * A bundle holds `pack` entries (each a list of level keys) and `level` entries. `assemblePack`
 * picks the `pack` entry addressed to this game and follows its keys, in order; `decomposePack`
 * is its inverse, run by `bun run decompose:content` before a publish. They live together so the
 * script can prove the round trip on every pack it emits.
 *
 * Pure: no SDK, no Pixi, no DOM. Importable from a bun script as much as from the loader.
 */

import { type } from 'arktype';
import { LevelDef, type LevelEntry, type LevelValue } from '../../../schemas/level/schema';
import { type PackData, type PackEntry, PackEntryDef } from '../../../schemas/pack/schema';
import type { PackBundle } from './dynamic-client';

/** A pack is ours when it names this game, or names none (an unscoped pack). */
export function packIsForGame(pack: { game: string }, gameSlug: string): boolean {
  return pack.game === '' || pack.game === gameSlug;
}

const entriesOf = (bundle: PackBundle, schema: string) => bundle.schemas[schema]?.entries ?? {};

/**
 * Join the bundle into the pack this game plays, or say why it cannot.
 *
 * Among several `pack` entries the one naming this game wins over an unscoped one. A key the
 * bundle does not resolve refuses the whole pack: a pack missing one level is not the pack that
 * was authored.
 */
export function assemblePack(bundle: PackBundle, gameSlug: string): PackData | string {
  const candidates = Object.values(entriesOf(bundle, 'pack'))
    .map((raw) => PackEntryDef(raw))
    .filter((out): out is PackEntry => !(out instanceof type.errors));
  const entry = candidates.find((p) => p.game === gameSlug) ?? candidates.find((p) => p.game === '');
  if (!entry) {
    const others = candidates.map((p) => `"${p.game}"`).join(', ');
    return others ? `it holds packs for ${others}, none for "${gameSlug}"` : 'it holds no pack entry';
  }

  const levelEntries = entriesOf(bundle, 'level');
  const levels: LevelValue[] = [];
  for (const key of entry.levels) {
    if (!(key in levelEntries)) return `level "${key}" is not in the bundle`;
    const out = LevelDef(levelEntries[key]);
    if (out instanceof type.errors) return `level "${key}" is not a level entry (${out.summary})`;
    levels.push(out.level);
  }
  return { id: entry.id, game: entry.game, levels };
}

/** The `level` entry key for the n-th level (1-based) of a pack. */
export const levelKey = (packId: string, n: number): string => `${packId}-${n}`;

/**
 * Split an authored pack into the entries a publish creates. The `pack` entry is keyed by the
 * pack's id, and so are its levels (`<id>-1`, `<id>-2`, …), because entries are shared by every
 * Content Pack on a release: two packs with one id would overwrite each other's levels.
 */
export function decomposePack(pack: PackData): PackBundle {
  const keys = pack.levels.map((_, i) => levelKey(pack.id, i + 1));
  const entry: PackEntry = { id: pack.id, game: pack.game, levels: keys };
  const wrapped = (level: LevelValue): LevelEntry => ({ level });
  return {
    packKey: pack.id,
    schemas: {
      pack: { entries: { [pack.id]: entry } },
      level: { entries: Object.fromEntries(keys.map((k, i) => [k, wrapped(pack.levels[i])])) },
    },
  };
}
