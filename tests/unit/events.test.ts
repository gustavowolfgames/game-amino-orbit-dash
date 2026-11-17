/**
 * The sim's event queue (src/game/mygame/sim/events.ts): systems and
 * transactions emit, the controller drains once a frame. Events pile up across
 * fixed steps until drained, stay in order, and the queue is bounded.
 */

import { describe, expect, it } from 'vitest';
import {
  drainEvents,
  emit,
  MAX_EVENTS,
  NO_EVENTS,
} from '~/game/mygame/sim/events';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { stepWorld } from '~/game/mygame/sim/schedule';

const DT = 1000 / 60;

describe('event queue', () => {
  it('starts empty, and an empty drain neither writes nor allocates', () => {
    const db = createGameWorld();
    expect(db.resources.events).toEqual([]);
    expect(drainEvents(db)).toBe(NO_EVENTS);
  });

  it('keeps events from several steps in order until one drain takes them all', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 3 });
    db.transactions.tap({ x: 1, y: 2 });
    stepWorld(db, DT);
    db.transactions.tap({ x: 3, y: 4 });
    stepWorld(db, DT);
    db.transactions.tap({ x: 5, y: 6 });

    expect(drainEvents(db).map((e) => e.type)).toEqual([
      'switched',
      'switched',
      'switched',
    ]);
    expect(db.resources.events).toEqual([]);
    expect(drainEvents(db)).toEqual([]);
  });

  it('is bounded: past MAX_EVENTS the oldest go and are counted', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 }); // lane switches never score
    const extra = 5;
    for (let i = 0; i < MAX_EVENTS + extra; i++) {
      db.transactions.tap({ x: i, y: 0 });
    }
    const events = drainEvents(db);
    expect(events).toHaveLength(MAX_EVENTS);
    expect(events[0]).toMatchObject({ type: 'switched', lane: 0 });
    expect(db.resources.eventsDropped).toBe(extra);
  });

  it('a new run starts with no stale events', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 });
    db.transactions.tap({ x: 0, y: 0 });
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
});
