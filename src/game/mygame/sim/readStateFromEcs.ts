/**
 * readStateFromEcs — plain snapshots of the world for pure logic, systems, the
 * renderer, the agent surface, and tests.
 *
 * ECS is the source of truth; consumers read a plain object so they never touch
 * the database internals. The parameter is a structural `EcsStateSource`,
 * satisfied by both the live `Database` and a transaction `store`, so the same
 * readers work inside systems, tests, and the renderer. A game adds one reader
 * per archetype next to this one (`readPieces(db)` returning `{ entity, ... }[]`).
 */

import type { GamePhase } from './plugin';

/** Whole-run snapshot. */
export interface GameSnapshot {
  level: number;
  goal: number;
  score: number;
  phase: GamePhase;
  elapsedMs: number;
}

/**
 * Minimal read surface a snapshot needs. The @adobe/data `Database` and
 * transaction `store` both satisfy it structurally.
 */
export interface EcsStateSource {
  readonly resources: {
    readonly level: number;
    readonly goal: number;
    readonly score: number;
    readonly phase: GamePhase;
    readonly elapsedMs: number;
  };
}

/** Rebuild a full snapshot from the current ECS state. */
export function readStateFromEcs(source: EcsStateSource): GameSnapshot {
  const { level, goal, score, phase, elapsedMs } = source.resources;
  return { level, goal, score, phase, elapsedMs };
}
