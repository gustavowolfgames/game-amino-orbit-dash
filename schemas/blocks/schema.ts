import { type } from 'arktype';

/**
 * A block: a run of levels, and the parent entry that holds their play order.
 *
 * The Content Pack (the server's GamePack) only says WHICH entries belong to an edition; it
 * carries no order. Blocks carry it: blocks play by `order`, and each block plays its `levels`
 * (keys into the `levels` schema) in list order. Keeping the order on the parent, not on the
 * level, is what lets one level sit at a different position in two editions.
 *
 * Shared values for a run of levels (a name, later a theme or art style) go here, never
 * repeated on every level. Same shape as The Stacks' `blocks` (game-amino-sort).
 */
export const BlocksDef = type({
  /** The block's own id. Also the prefix of its level keys (`<id>-1`, `<id>-2`, …). */
  id: 'string',
  /** Display name for the run of levels. */
  name: 'string',
  /** Play position among the pack's blocks, ascending. */
  order: 'number',
  /** `levels` entry keys, in play order. */
  levels: 'string[]',
});

export type BlockEntry = typeof BlocksDef.infer;

/** A block has no meaningful default: the manager starts a new entry empty. */
export const defaultData: BlockEntry | null = null;
