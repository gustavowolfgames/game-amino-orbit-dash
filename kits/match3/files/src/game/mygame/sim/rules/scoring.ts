/**
 * scoring — points, chain multiplier and star thresholds. Pure.
 *
 * Numbers that change per level (moves, goal colour and count) live in the
 * level shape (`schemas/levels/schema.ts`); these never do.
 */

/** Points per tile cleared, before the chain multiplier. */
export const POINTS_PER_TILE = 30;

/** Total run score (all levels) needed for 1, 2 and 3 stars. */
export const STAR_THRESHOLDS = [1, 12000, 16000] as const;

/** Points for clearing `count` tiles on cascade step `chain` (1 = the swap's own clear). */
export function pointsFor(count: number, chain: number): number {
  return count * POINTS_PER_TILE * chain;
}

/** Stars (0–3) for a total score. */
export function starsFor(total: number): number {
  return STAR_THRESHOLDS.filter((t) => total >= t).length;
}
