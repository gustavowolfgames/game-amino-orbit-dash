/**
 * config — constants every part of the game agrees on.
 *
 * Pure module: no Pixi, no DOM. The sim and the renderer both read it, so they
 * agree on the coordinate space. Game rules and tuning go in `sim/rules/`;
 * per-level numbers come from the Content Pack (`src/game/content`).
 */

/** Fixed design box; the renderer scales this to fit ("contain"). Portrait,
 *  mobile-first — matches the placeholder background art aspect. */
export const DESIGN_W = 820;
export const DESIGN_H = 1480;

/** Seed for a level that names none (deterministic sim: no Math.random). */
export const DEFAULT_SEED = 0x9e3779b1;
