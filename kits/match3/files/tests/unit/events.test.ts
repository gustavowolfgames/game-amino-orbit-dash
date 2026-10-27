/**
 * The sim's event queue (src/game/mygame/sim/events.ts): transactions emit,
 * the controller drains once a frame. Events pile up across fixed steps until
 * drained, stay in order, and the queue is bounded.
 *
 * The match-3 kit's version of the template's test: the template drives the
 * queue with its example `tap` move, which the kit replaces with swaps
 * (`applySwap` → `commitMove`).
 */

import { describe, expect, it } from 'vitest';
import {
  drainEvents,
  emit,
  MAX_EVENTS,
  NO_EVENTS,
} from '~/game/mygame/sim/events';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import {
  type Board,
  COLOR_COUNT,
  indexOf,
} from '~/game/mygame/sim/rules/board';
import { stepWorld } from '~/game/mygame/sim/schedule';
import { applySwap } from '~/game/mygame/sim/turn';

const DT = 1000 / 60;

/** No matches anywhere: colour = (col + 2*row) % 5. */
function boardWith(edits: Array<[number, number, number]>): Board {
  const b: Board = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) b.push((col + 2 * row) % COLOR_COUNT);
  for (const [c, r, color] of edits) b[indexOf(c, r)] = color;
  return b;
}
/** Swapping (2,6)↔(2,7) lines up three 4s on the bottom row. */
const ONE_CLEAR = boardWith([
  [0, 7, 4],
  [1, 7, 4],
  [2, 6, 4],
  [2, 7, 1],
]);

function world(board: Board, goal = 99, moves = 20) {
  const db = createGameWorld();
  db.transactions.startRun({ seed: 1, goal, goalColor: 4, moves });
  db.transactions.setBoard({ board });
  return db;
}

describe('event queue', () => {
  it('starts empty, and an empty drain neither writes nor allocates', () => {
    const db = createGameWorld();
    expect(db.resources.events).toEqual([]);
    expect(drainEvents(db)).toBe(NO_EVENTS);
  });

  it('keeps events from several steps in order until one drain takes them all', () => {
    const db = world(ONE_CLEAR, 3);
    applySwap(db, { col: 0, row: 0 }, { col: 1, row: 0 }); // no line
    stepWorld(db, DT);
    applySwap(db, { col: 2, row: 6 }, { col: 2, row: 7 }); // clears three 4s: the goal

    const events = drainEvents(db);
    expect(events[0]).toEqual({
      type: 'rejected',
      a: { col: 0, row: 0 },
      b: { col: 1, row: 0 },
    });
    expect(events[1]).toMatchObject({ type: 'scored', chain: 1, points: 90 });
    expect(events.at(-1)).toEqual({ type: 'phase', phase: 'won' });
    expect(db.resources.events).toEqual([]);
    expect(drainEvents(db)).toEqual([]);
  });

  it('reports each cascade step with its chain and the running score', () => {
    // Step 1 clears column 0 rows 5–7; the 3 that falls to (0,7) clears row 7 again.
    const db = world(
      boardWith([
        [0, 6, 4],
        [0, 7, 4],
        [1, 5, 4],
        [1, 7, 3],
        [2, 7, 3],
      ]),
    );
    applySwap(db, { col: 0, row: 5 }, { col: 1, row: 5 });
    const scored = drainEvents(db).filter((e) => e.type === 'scored');
    expect(scored.length).toBeGreaterThanOrEqual(2);
    expect(scored[0]).toMatchObject({ chain: 1, x: 0, y: 6, score: 90 });
    expect(scored[1]).toMatchObject({ chain: 2 });
    expect(scored.at(-1)?.score).toBe(db.resources.score);
  });

  it('is bounded: past MAX_EVENTS the oldest go and are counted', () => {
    const db = world(boardWith([]));
    const extra = 5;
    for (let i = 0; i < MAX_EVENTS + extra; i++) {
      applySwap(db, { col: 0, row: 0 }, { col: 1, row: 0 }); // rejected, no move spent
    }
    const events = drainEvents(db);
    expect(events).toHaveLength(MAX_EVENTS);
    expect(events.every((e) => e.type === 'rejected')).toBe(true);
    expect(db.resources.eventsDropped).toBe(extra);
  });

  it('a new run starts with no stale events', () => {
    const db = world(ONE_CLEAR);
    applySwap(db, { col: 2, row: 6 }, { col: 2, row: 7 });
    db.transactions.startRun({ seed: 2 });
    expect(drainEvents(db)).toEqual([]);
    expect(db.resources.eventsDropped).toBe(0);
  });

  it('emit works on any store with the two resources (generic over the event union)', () => {
    type Ev = { type: 'a'; n: number } | { type: 'b' };
    const store = {
      resources: { events: [] as readonly Ev[], eventsDropped: 0 },
    };
    emit(store, { type: 'a', n: 1 });
    emit(store, { type: 'b' });
    expect(store.resources.events).toEqual([
      { type: 'a', n: 1 },
      { type: 'b' },
    ]);
  });

  it('setPhase reports a change once, and not a repeat', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 });
    db.transactions.setPhase('lost');
    db.transactions.setPhase('lost');
    expect(drainEvents(db)).toEqual([{ type: 'phase', phase: 'lost' }]);
  });

  it('running out of moves reports the loss', () => {
    const db = world(ONE_CLEAR, 99, 1);
    applySwap(db, { col: 2, row: 6 }, { col: 2, row: 7 });
    expect(drainEvents(db).at(-1)).toEqual({ type: 'phase', phase: 'lost' });
  });
});
