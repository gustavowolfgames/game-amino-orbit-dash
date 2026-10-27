/**
 * The sim's event queue (src/game/mygame/sim/events.ts): systems and
 * transactions emit, the controller drains once a frame. Events pile up across
 * fixed steps until drained, stay in order, and the queue is bounded.
 *
 * The ball sort kit's copy of the template test: the template's version drives
 * the queue with its example `tap` (a `scored` event per tap); ball sort has no
 * score, so the queue is driven by lifting and putting back a ball instead.
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

/** A run on a 4-colour board: tube 0 always holds balls. */
function playing() {
  const db = createGameWorld();
  db.transactions.startRun({ seed: 1, colors: 4 });
  return db;
}

describe('event queue', () => {
  it('starts empty, and an empty drain neither writes nor allocates', () => {
    const db = createGameWorld();
    expect(db.resources.events).toEqual([]);
    expect(drainEvents(db)).toBe(NO_EVENTS);
  });

  it('keeps events from several steps in order until one drain takes them all', () => {
    const db = playing();
    db.transactions.tapTube({ tube: 0 });
    stepWorld(db, DT);
    db.transactions.tapTube({ tube: 0 });
    stepWorld(db, DT);
    db.transactions.tapTube({ tube: 1 });

    expect(drainEvents(db)).toEqual([
      { type: 'lifted', tube: 0 },
      { type: 'putBack', tube: 0, illegal: false },
      { type: 'lifted', tube: 1 },
    ]);
    expect(db.resources.events).toEqual([]);
    expect(drainEvents(db)).toEqual([]);
  });

  it('is bounded: past MAX_EVENTS the oldest go and are counted', () => {
    const db = playing();
    const extra = 5;
    // Each tap on tube 0 lifts, then puts back: one event per tap.
    for (let i = 0; i < MAX_EVENTS + extra; i++) {
      db.transactions.tapTube({ tube: 0 });
    }
    const events = drainEvents(db);
    expect(events).toHaveLength(MAX_EVENTS);
    // `extra` (odd) events dropped: the oldest kept is a put-back.
    expect(events[0]).toEqual({ type: 'putBack', tube: 0, illegal: false });
    expect(db.resources.eventsDropped).toBe(extra);
  });

  it('a new run starts with no stale events', () => {
    const db = playing();
    db.transactions.tapTube({ tube: 0 });
    db.transactions.startRun({ seed: 2, colors: 4 });
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
    const db = playing();
    db.transactions.setPhase('lost');
    db.transactions.setPhase('lost');
    expect(drainEvents(db)).toEqual([{ type: 'phase', phase: 'lost' }]);
  });
});
