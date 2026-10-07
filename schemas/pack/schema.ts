import { type } from 'arktype';
import { LevelValue } from '../level/schema';

/**
 * A level pack, in the two shapes it takes.
 *
 * **Authored** (`PackDef`): `levels` inline, in play order. What the examples hold, what
 * `bun run decompose:content` reads, and what the game plays once a bundle is joined back
 * together (`src/game/content/assemble.ts`).
 *
 * **Entry** (`PackEntryDef`): the shape stored in Dynamic Data. `levels` is the list of `level`
 * entry KEYS, in play order; each level is its own entry in the `level` schema. A Content Pack
 * groups one of these with the level entries it names, and the server serves them as one
 * bundle. Splitting the levels out is what lets the manager swap, drop or reorder one level, and
 * share a level between editions.
 *
 * `game` scopes a pack to one game when a slug ships several; `''` addresses every game, which
 * is the normal case for a fork of this template (one slug, one game).
 */
export const PackEntryDef = type({
  /** The pack's own id. Also the `level` key prefix and the suggested Content Pack key. */
  id: 'string',
  /** The game slug this pack belongs to, or `''` for any. */
  game: 'string',
  /** `level` entry keys, in play order. */
  levels: 'string[]',
});

export type PackEntry = typeof PackEntryDef.infer;

export const PackDef = type({
  id: 'string',
  game: 'string',
  /** Authored levels, in play order. Opaque here; the game validates each one. */
  levels: LevelValue.array(),
});

export type PackData = typeof PackDef.infer;

/**
 * What the manager offers for a new `pack` entry. Empty on purpose: "no levels" means "play the
 * bundled default pack", so a game with nothing published plays exactly what it ships with.
 */
export const defaultData: PackEntry = {
  id: 'default',
  game: '',
  levels: [],
};
