/**
 * What one level IS for this game, and the pack every build ships with.
 *
 * The level's shape is the `levels` schema (`schemas/levels/schema.ts`) — the file a fork
 * rewrites when its level changes. This parser is where the game fills what an absent field
 * means. A pack level that fails it is dropped (with a warning), and a pack left with no
 * playable level is refused — a bad entry costs a level, never the boot.
 */

import { type } from 'arktype';
import { type LevelEntry, LevelsDef } from '../../../schemas/levels/schema';
import { DEFAULT_SEED } from '../mygame/config';
import { type ContentPack, ContentPackDef, packLevels } from './content-pack';
import defaultPackJson from './packs/default.json';

export const LevelConfigDef = LevelsDef;

export type LevelConfig = LevelEntry;

/** A level with every optional field filled — what the game actually starts. */
export type ResolvedLevel = Required<LevelConfig>;

/** What an absent optional field means. A game adds a default for each field it adds. */
export const LEVEL_DEFAULTS: ResolvedLevel = {
  seed: DEFAULT_SEED,
  goal: 15, // tiles of `goalColor` to clear
  goalColor: 'red',
  moves: 20,
};

/** The level parser: fields the shape doesn't name (an older shape's) are dropped, not refused. */
const parseEntry = LevelsDef.onUndeclaredKey('delete');

/** Parse one pack level. Null when this game cannot play it. */
export function parseLevel(raw: unknown): ResolvedLevel | null {
  const out = parseEntry(raw);
  if (out instanceof type.errors) return null;
  return { ...LEVEL_DEFAULTS, ...out };
}

/**
 * The pack every build ships with: what plays when nothing is published, the network is down,
 * or a published pack is refused. The same file a content person publishes as the `default`
 * pack (`packs/default.json`), so "bundled" and "published" cannot drift.
 */
export const BUNDLED_PACK: ContentPack = (() => {
  const out = ContentPackDef(defaultPackJson);
  if (out instanceof type.errors) {
    throw new Error(
      `src/game/content/packs/default.json is not a pack: ${out.summary}`,
    );
  }
  if (packLevels(out).length === 0) {
    throw new Error(
      'src/game/content/packs/default.json must hold at least one level',
    );
  }
  return out;
})();

/** Default Content Pack key: what a plain URL asks the CDN for. */
export const DEFAULT_PACK_KEY = BUNDLED_PACK.id;
