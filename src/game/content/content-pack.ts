/**
 * The authored shape of a Content Pack — what `packs/*.json` hold, what the game plays, and what
 * `bun run decompose:content` splits into entries.
 *
 * NOT a Dynamic Data schema. The server stores the pieces (`blocks` and `levels` entries,
 * `schemas/`) and the Content Pack itself is the GamePack that points at them; this is the
 * joined-back form. A pack is its blocks in play order; a block is its levels in play order.
 */

import { type } from 'arktype';
import { LevelsDef } from '../../../schemas/levels/schema';

export const ContentBlockDef = type({
  /** Block id: the `blocks` entry key, and the prefix of its level keys. Unique per release. */
  id: 'string',
  name: 'string',
  levels: LevelsDef.array(),
});

export const ContentPackDef = type({
  /** The Content Pack key (`?wolfPack=<id>`). */
  id: 'string',
  blocks: ContentBlockDef.array(),
});

export type ContentPack = typeof ContentPackDef.infer;

/**
 * A pack as joined from a bundle, before the game parses its levels: the same shape with each
 * level still unvalidated, so one bad level costs that level rather than the pack.
 */
export interface AssembledPack {
  id: string;
  blocks: { id: string; name: string; levels: unknown[] }[];
}

/** Every level of a pack, in play order (blocks in order, each block's levels in order). */
export function packLevels<L>(pack: { blocks: readonly { levels: readonly L[] }[] }): L[] {
  return pack.blocks.flatMap((b) => b.levels);
}
