/**
 * rng — a tiny deterministic PRNG (numeric Linear Congruential Generator).
 *
 * The sim must never call `Math.random()` (guardrail: pure transactions/systems).
 * The generator state is a single number held in an ECS resource and advanced
 * by transactions, so a run replays exactly from its seed.
 */

/** Advance the LCG state (Numerical Recipes constants). Returns the new state. */
export function nextRng(state: number): number {
  // Keep it in unsigned 32-bit space so it stays deterministic across engines.
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

/** A float in [0, 1) derived from a state. */
export function rngFloat(state: number): number {
  return state / 0x100000000;
}
