/**
 * readBoard — plain reads of the ball sort world, for the rules, the views, the
 * agent surface and tests.
 *
 * ECS is the source of truth; these turn the Ball and Tube entities into plain
 * values so the pure rules (`./rules/ballSort.ts`) never touch ECS. Each takes a
 * structural `BoardSource`, which both the live database and a transaction
 * `store` satisfy, so the same reader works inside transactions and outside.
 */

import type { Entity } from '~/core/systems/ecs';
import type { GameStore } from './plugin';

/** A store or database: enough to read the balls and tubes. */
export interface BoardSource {
  select: GameStore['select'];
  read: GameStore['read'];
  readonly resources: { readonly tubeCount: number };
}

/** The board as plain arrays (bottom ball first), read from the Ball entities. */
export function readBoard(source: BoardSource): number[][] {
  const board: number[][] = Array.from(
    { length: source.resources.tubeCount },
    () => [],
  );
  for (const e of source.select(['ball', 'tube', 'slot', 'color'])) {
    const b = source.read(e, ['tube', 'slot', 'color']);
    if (b?.tube !== undefined && b.slot !== undefined && b.color !== undefined)
      board[b.tube][b.slot] = b.color;
  }
  return board;
}

/** One ball, as the renderer and tests see it. */
export interface BallView {
  entity: Entity;
  tube: number;
  slot: number;
  color: number;
}

/** Every Ball entity. */
export function readBalls(source: BoardSource): BallView[] {
  const out: BallView[] = [];
  for (const entity of source.select(['ball', 'tube', 'slot', 'color'])) {
    const b = source.read(entity, ['tube', 'slot', 'color']);
    if (b?.tube === undefined || b.slot === undefined || b.color === undefined)
      continue;
    out.push({ entity, tube: b.tube, slot: b.slot, color: b.color });
  }
  return out;
}

/** Done flag per tube index (Tube entities). */
export function readDoneTubes(source: BoardSource): boolean[] {
  const done: boolean[] = [];
  for (const e of source.select(['tubeIndex', 'done'])) {
    const t = source.read(e, ['tubeIndex', 'done']);
    if (t?.tubeIndex !== undefined) done[t.tubeIndex] = !!t.done;
  }
  return done;
}
