/**
 * config — shared, framework-free constants for the minimal ECS demo.
 *
 * Pure module: no Pixi, no DOM. Imported by the ECS sim (deterministic rules)
 * AND by the Pixi renderer, so both agree on the design box, orb geometry, and
 * interaction distances. The sim only ever deals in a colour *index*; the actual
 * colours come from the brand theme.
 *
 * This is the template's swap-me surface for MECHANICS: a new game replaces these
 * constants (and the systems/transactions that read them) with its own rules.
 * CONTENT — how many orbiters, how fast, how wide — comes per level from the
 * Content Pack (src/game/content/level.ts); the values here are its defaults.
 */

/** Fixed design box; the renderer scales this to fit ("contain"). Portrait,
 *  mobile-first — matches the placeholder background art aspect. */
export const DESIGN_W = 820;
export const DESIGN_H = 1480;

/** Design-box centre — the orbiter ring spins around this point. */
export const CENTER: readonly [number, number] = [DESIGN_W / 2, DESIGN_H / 2];

/** Orb geometry (design px). Orbiters and movers share this radius. */
export const ORB_RADIUS = 34;

/** Default orbiters per level (a pack level's `orbiterCount` overrides it). */
export const ORBITER_COUNT = 6;

/** Default ring radius around CENTER, design px (a pack level may override it). */
export const ORBIT_RADIUS = 300;

/** Default ring angular speed, radians/sec (a pack level may override it). */
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
 * How many colour slots the sim deals in. The sim stores a colour *index* on each orb; the
 * renderer maps it onto the brand theme's piece colours (`getTheme().pieces`, src/game/brand),
 * so a partner sheet recolours every orb without the sim knowing.
 */
export const PALETTE_SIZE = 5;

/** Default mover seed (deterministic sim: no Math.random / Date.now). A level may override it. */
export const DEMO_SEED = 0x9e3779b1;
