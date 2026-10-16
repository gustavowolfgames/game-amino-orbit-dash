/**
 * readStateFromEcs — plain snapshots of the demo world for pure logic,
 * systems, the renderer, and tests.
 *
 * ECS is the source of truth; consumers read a plain object so they never touch
 * the database internals. The parameter is a structural `EcsStateSource`,
 * satisfied by both the live `Database` and a transaction `store`, so the same
 * readers work inside systems, tests, and the renderer.
 */

import type { Entity } from '~/core/systems/ecs';
import type { GamePhase } from './gamePlugin';

/** One collectible orbiter. */
export interface OrbiterState {
  entity: Entity;
  angle: number;
  color: number;
  position: [number, number];
}

/** One drifting mover. */
export interface MoverState {
  entity: Entity;
  color: number;
  position: [number, number];
  velocity: [number, number];
}

/** Whole-world snapshot. */
export interface GameSnapshot {
  level: number;
  score: number;
  phase: GamePhase;
  remaining: number;
  orbiters: OrbiterState[];
  movers: MoverState[];
}

/**
 * Minimal read surface a snapshot needs. The @adobe/data `Database` and
 * transaction `store` both satisfy it structurally. `select` is intentionally
 * widened so this adapter stays decoupled from the exact database generics.
 */
export interface EcsStateSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select(include: readonly any[]): readonly Entity[];
  read(entity: Entity): unknown;
  readonly resources: {
    readonly level: number;
    readonly score: number;
    readonly phase: GamePhase;
    readonly remaining: number;
  };
}

/** Every collectible orbiter currently in the ring. */
export function readOrbiters(source: EcsStateSource): OrbiterState[] {
  const orbiters: OrbiterState[] = [];
  for (const entity of source.select(['angle'])) {
    const o = source.read(entity) as {
      angle: number;
      color: number;
      position: [number, number];
    } | null;
    if (!o) continue;
    orbiters.push({
      entity,
      angle: o.angle,
      color: o.color,
      position: [o.position[0], o.position[1]],
    });
  }
  return orbiters;
}

/** Every mover currently drifting. */
export function readMovers(source: EcsStateSource): MoverState[] {
  const movers: MoverState[] = [];
  for (const entity of source.select(['velocity'])) {
    const m = source.read(entity) as {
      color: number;
      position: [number, number];
      velocity: [number, number];
    } | null;
    if (!m) continue;
    movers.push({
      entity,
      color: m.color,
      position: [m.position[0], m.position[1]],
      velocity: [m.velocity[0], m.velocity[1]],
    });
  }
  return movers;
}

/** Rebuild a full snapshot from the current ECS state. */
export function readStateFromEcs(source: EcsStateSource): GameSnapshot {
  return {
    level: source.resources.level,
    score: source.resources.score,
    phase: source.resources.phase,
    remaining: source.resources.remaining,
    orbiters: readOrbiters(source),
    movers: readMovers(source),
  };
}
