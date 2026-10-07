import { type } from 'arktype';

/**
 * One authored level, in an envelope: `{ level: <the level> }`.
 *
 * The level itself is the game's, not the schema's: this template's demo reads
 * `{ orbiterCount, seed, … }` (`src/game/content/level.ts`), a word game would read a word,
 * a puzzle game a grid. Opaque here so a fork changes its level shape without a new schema
 * version — **changing a schema needs a redeploy; changing an entry does not**.
 *
 * The envelope is the backend's requirement, not a design choice. An entry must be a JSON
 * object (a bare `"CRANE"` is refused), and every node of a registered schema must carry a
 * `type` (`unknown` is `{}` and is refused), hence the union of JSON types.
 *
 * A `pack` entry names these by key, in play order; a Content Pack carries both.
 */
/** Any JSON value a level can be. Shared with the authored pack (`../pack/schema.ts`). */
export const LevelValue = type('object | string | number | boolean | null');

export type LevelValue = typeof LevelValue.infer;

export const LevelDef = type({
  level: LevelValue,
});

export type LevelEntry = typeof LevelDef.infer;

/** A level has no meaningful default: the manager starts a new entry empty. */
export const defaultData: LevelEntry | null = null;
