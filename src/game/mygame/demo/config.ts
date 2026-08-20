/**
 * config — shared, framework-free constants for the minimal ECS demo.
 *
 * Pure module: no Pixi, no DOM. Imported by the ECS sim (deterministic rules)
 * AND by the Pixi renderer, so both agree on the design box, orb geometry, and
 * interaction distances. Colours are the ONLY render-facing values here — the
 * sim only ever deals in a colour *index* — kept in one place so an art pass can
 * map each index to a real sprite tint/alias.
 *
 * This is the template's swap-me surface: a new game replaces these constants
 * (and the systems/transactions that read them) with its own rules.
 */

/** Fixed design box; the renderer scales this to fit ("contain"). Portrait,
 *  mobile-first — matches the placeholder background art aspect. */
export const DESIGN_W = 820;
export const DESIGN_H = 1480;

/** Design-box centre — the orbiter ring spins around this point. */
export const CENTER: readonly [number, number] = [DESIGN_W / 2, DESIGN_H / 2];

/** Orb geometry (design px). Orbiters and movers share this radius. */
export const ORB_RADIUS = 34;

/** How many collectible orbiters ring the centre at level start. */
export const ORBITER_COUNT = 6;

/** Radius of the orbiter ring around CENTER (design px). */
export const ORBIT_RADIUS = 300;

/** Angular speed of the orbiter ring (radians / sec). */
export const ORBIT_SPEED = 0.6;

/** A tap within this of an orbiter's centre collects it (design px). */
export const COLLECT_RADIUS = ORB_RADIUS * 2.4;

/** Speed a tap-spawned mover flies off at (design px / sec). */
export const MOVER_SPEED = 380;

/**
 * Cap on live movers. Tapping spawns movers without bound otherwise; when the
 * cap is hit the oldest is recycled, so entity count stays bounded (guardrail:
 * no unbounded growth / per-frame allocation).
 */
export const MAX_MOVERS = 40;

/** Score awarded per collected orbiter. */
export const POINTS_PER_COLLECT = 100;

/**
 * Colour palette — index → placeholder tint applied to the neutral orb sprite.
 * The sim stores a colour *index* on each orb; the renderer tints `piece-orb`
 * by this. ART TODO: regenerate a neutral white orb so tints read cleanly, or
 * ship one sprite per index — see the asset-pipeline rule.
 */
export const COLORS: readonly number[] = [
  0x5aa9e6, // blue
  0x7fc8a9, // teal
  0xf6c453, // amber
  0xe86a92, // rose
  0xb08bd8, // violet
];

/** How many colours exist at most. */
export const MAX_COLORS = COLORS.length;
