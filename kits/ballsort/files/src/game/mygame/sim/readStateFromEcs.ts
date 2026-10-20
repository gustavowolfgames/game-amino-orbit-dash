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

import type { Entity } from '~/core/systems/ecs';
import type { GameDatabase, GamePhase } from './plugin';

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

/** One ball, as the renderer and tests see it. */
export interface BallView {
  entity: Entity;
  tube: number;
  slot: number;
  color: number;
}

/** Every Ball entity. */
export function readBalls(db: GameDatabase): BallView[] {
  const out: BallView[] = [];
  for (const entity of db.select(['ball', 'tube', 'slot', 'color'])) {
    const b = db.read(entity, ['tube', 'slot', 'color']);
    if (b?.tube === undefined || b.slot === undefined || b.color === undefined)
      continue;
    out.push({ entity, tube: b.tube, slot: b.slot, color: b.color });
  }
  return out;
}

/** Done flag per tube index (Tube entities). */
export function readDoneTubes(db: GameDatabase): boolean[] {
  const done: boolean[] = [];
  for (const e of db.select(['tubeIndex', 'done'])) {
    const t = db.read(e, ['tubeIndex', 'done']);
    if (t?.tubeIndex !== undefined) done[t.tubeIndex] = !!t.done;
  }
  return done;
}
