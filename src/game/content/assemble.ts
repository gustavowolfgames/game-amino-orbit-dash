/**
 * The join and the split between a Content Pack bundle and the pack the game plays.
 *
 * A bundle holds `blocks` entries (each a run of level keys, with its play `order`) and `levels`
 * entries. `assemblePack` sorts the blocks and follows their keys, in order; `decomposePack` is
 * its inverse, run by `bun run decompose:content` before a publish. They live together so the
 * script can prove the round trip on every pack it emits. Same split as The Stacks'
 * `assembler.ts` / `decompose.ts` (game-amino-sort).
 *
 * Pure: no SDK, no Pixi, no DOM. Importable from a bun script as much as from the loader.
 */

import { type } from 'arktype';
import { type BlockEntry, BlocksDef } from '../../../schemas/blocks/schema';
import type { AssembledPack, ContentPack } from './content-pack';
import type { PackBundle } from './dynamic-client';

const entriesOf = (bundle: PackBundle, schema: string) =>
  bundle.schemas[schema]?.entries ?? {};

/**
 * Join the bundle into the pack this game plays, or say why it cannot.
 *
 * A malformed block, or a level key the bundle does not resolve, refuses the whole pack: a pack
 * missing a level is not the pack that was authored. Levels come back unparsed; the loader
 * decides which ones this game can play.
 */
export function assemblePack(bundle: PackBundle): AssembledPack | string {
  const blocks: BlockEntry[] = [];
  for (const [key, raw] of Object.entries(entriesOf(bundle, 'blocks'))) {
    const out = BlocksDef(raw);
    if (out instanceof type.errors)
      return `block "${key}" is not a block entry (${out.summary})`;
    blocks.push(out);
  }
  if (blocks.length === 0) return 'it holds no block entry';
  blocks.sort((a, b) => a.order - b.order);

  const levelEntries = entriesOf(bundle, 'levels');
  const assembled: AssembledPack = { id: bundle.packKey, blocks: [] };
  for (const block of blocks) {
    const levels: unknown[] = [];
    for (const key of block.levels) {
      if (!(key in levelEntries))
        return `level "${key}" of block "${block.id}" is not in the bundle`;
      levels.push(levelEntries[key]);
    }
    assembled.blocks.push({ id: block.id, name: block.name, levels });
  }
  return assembled;
}

/** The `levels` entry key for the n-th level (1-based) of a block. */
export const levelKey = (blockId: string, n: number): string =>
  `${blockId}-${n}`;

/**
 * Split an authored pack into the entries a publish creates. Levels are keyed by their block's
 * id (`<block>-1`, `<block>-2`, …) because entries are shared by every Content Pack on a
 * release: two blocks with one id would overwrite each other's levels.
 */
export function decomposePack(pack: ContentPack): PackBundle {
  const blocks: Record<string, BlockEntry> = {};
  const levels: Record<string, unknown> = {};
  pack.blocks.forEach((block, i) => {
    const keys = block.levels.map((_, n) => levelKey(block.id, n + 1));
    blocks[block.id] = {
      id: block.id,
      name: block.name,
      order: i + 1,
      levels: keys,
    };
    keys.forEach((k, n) => {
      levels[k] = block.levels[n];
    });
  });
  return {
    packKey: pack.id,
    schemas: { blocks: { entries: blocks }, levels: { entries: levels } },
  };
}
