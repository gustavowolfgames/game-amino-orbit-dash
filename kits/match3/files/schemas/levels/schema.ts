import { type } from 'arktype';

/**
 * One level, as this game plays it: the schema a game rewrites when it knows its level shape.
 *
 * Match-3: a seed (the sim is deterministic, so a level replays exactly), a goal (clear
 * `goal` tiles of `goalColor`) and a move budget. A game adds its own fields here (a board, a piece
 * count, a time limit) and fills what an absent field means in `src/game/content/level.ts`.
 * Mechanics that never change per level stay in code (`src/game/mygame/sim/rules/`).
 *
 * Keyed `<block id>-<n>`; a `blocks` entry lists the keys in play order. Changing this shape
 * needs a version bump and a redeploy; changing an entry does not. Fields a level carries that
 * this shape doesn't name are ignored, so entries published for an older shape still parse.
 */
export const LevelsDef = type({
  /** Seed for the level's randomness (deterministic sim: no Math.random). */
  'seed?': '0 <= number.integer <= 4294967295',
  /** The level's target: what it counts (points, clears, moves) is the game's call. */
  'goal?': '1 <= number.integer <= 1000000',
  /** Colour the goal counts: clear `goal` tiles of it to win. */
  'goalColor?': "'red' | 'blue' | 'green' | 'yellow' | 'purple'",
  /** Moves the player has for the level. */
  'moves?': '1 <= number.integer <= 999',
});

export type LevelEntry = typeof LevelsDef.infer;

/** A level has no meaningful default: the manager starts a new entry empty. */
export const defaultData: LevelEntry | null = null;
