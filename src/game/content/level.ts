/**
 * What one level IS for this game — the only file a fork rewrites when its level shape changes.
 *
 * The `level` schema stores levels opaquely (`schemas/level/schema.ts`); this parser is where the
 * game says what it can actually play. A pack level that fails it is dropped (with a warning),
 * and a pack left with no playable level is refused — a bad entry costs a level, never the boot.
 *
 * The demo's level is a ring of collectible orbiters: how many, how fast, how wide, and the
 * seed for the movers a tap spawns. Everything else (design box, orb size, scoring) stays in
 * `mygame/demo/config.ts` because it is mechanics, not content.
 */

import { type } from 'arktype';
import defaultPackJson from '../../../schemas/pack/examples/default.json';
import { type PackData, PackDef } from '../../../schemas/pack/schema';
import { DEMO_SEED, ORBIT_RADIUS, ORBIT_SPEED } from '../mygame/demo/config';

export const LevelConfigDef = type({
  /** Orbiters ringing the centre; collect them all to clear the level. */
  orbiterCount: '1 <= number.integer <= 24',
  /** Seed for the movers a tap spawns (deterministic sim: no Math.random). */
  'seed?': '0 <= number.integer <= 4294967295',
  /** Ring angular speed, radians/sec. Negative spins the other way. */
  'orbitSpeed?': '-3 <= number <= 3',
  /** Ring radius in design px (the design box is 820 wide). */
  'orbitRadius?': '120 <= number <= 380',
});

export type LevelConfig = typeof LevelConfigDef.infer;

/** A level with every optional field filled — what the game actually starts. */
export type ResolvedLevel = Required<LevelConfig>;

/** What an absent optional field means — the demo's own mechanics defaults. */
export const LEVEL_DEFAULTS: Omit<ResolvedLevel, 'orbiterCount'> = {
  seed: DEMO_SEED,
  orbitSpeed: ORBIT_SPEED,
  orbitRadius: ORBIT_RADIUS,
};

/** Parse one opaque pack level. Null when this game cannot play it. */
export function parseLevel(raw: unknown): ResolvedLevel | null {
  const out = LevelConfigDef(raw);
  if (out instanceof type.errors) return null;
  return { ...LEVEL_DEFAULTS, ...out };
}

/**
 * The pack every build ships with: what plays when nothing is published, the network is down,
 * or a published pack is refused. The same file a content person publishes as the `default`
 * pack (`schemas/pack/examples/default.json`), so "bundled" and "published" cannot drift.
 */
export const BUNDLED_PACK: PackData = (() => {
  const out = PackDef(defaultPackJson);
  if (out instanceof type.errors) {
    throw new Error(`schemas/pack/examples/default.json is not a pack: ${out.summary}`);
  }
  if (out.levels.length === 0 || out.levels.some((l) => parseLevel(l) === null)) {
    throw new Error('schemas/pack/examples/default.json must hold at least one playable level');
  }
  return out;
})();

/** Default Content Pack key: what a plain URL asks the CDN for. */
export const DEFAULT_PACK_KEY = BUNDLED_PACK.id;
