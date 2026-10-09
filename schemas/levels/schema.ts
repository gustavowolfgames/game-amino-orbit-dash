import { type } from 'arktype';

/**
 * One level, as this game plays it — the schema a fork rewrites when its level shape changes.
 *
 * The demo's level is a ring of collectible orbiters: how many, how fast, how wide, and the
 * seed for the movers a tap spawns. Everything else (design box, orb size, scoring) stays in
 * `src/game/mygame/demo/config.ts` because it is mechanics, not content. What an absent
 * optional field means is the game's call (`src/game/content/level.ts`).
 *
 * Keyed `<block id>-<n>`; a `blocks` entry lists the keys in play order. Changing this shape
 * needs a version bump and a redeploy; changing an entry does not.
 */
export const LevelsDef = type({
  /** Orbiters ringing the centre; collect them all to clear the level. */
  orbiterCount: '1 <= number.integer <= 24',
  /** Seed for the movers a tap spawns (deterministic sim: no Math.random). */
  'seed?': '0 <= number.integer <= 4294967295',
  /** Ring angular speed, radians/sec. Negative spins the other way. */
  'orbitSpeed?': '-3 <= number <= 3',
  /** Ring radius in design px (the design box is 820 wide). */
  'orbitRadius?': '120 <= number <= 380',
});

export type LevelEntry = typeof LevelsDef.infer;

/** A level has no meaningful default: the manager starts a new entry empty. */
export const defaultData: LevelEntry | null = null;
