import { describe, expect, it } from 'vitest';
import { createGameAgentWorld } from '~/game/mygame/agent/agentPlugin';
import { drainEvents } from '~/game/mygame/sim/events';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { stepWorld } from '~/game/mygame/sim/schedule';
import { SYSTEM_ORDER } from '~/game/mygame/sim/systems';

const DT = 1000 / 60;
const laneOf = (db: ReturnType<typeof createGameWorld>) => {
  const entity = [...db.select(['runner'])][0];
  return db.read(entity, ['lane'])?.lane;
};

describe('Orbit Dash simulation', () => {
  it('builds five gates and one runner from a seed, then resets cleanly', () => {
    const db = createGameWorld();
    db.transactions.startRun({
      seed: 1337,
      goal: 8,
      level: 1,
      packId: 'default',
    });
    expect([...db.select(['runner'])]).toHaveLength(1);
    expect([...db.select(['gate'])]).toHaveLength(5);
    expect(db.resources).toMatchObject({
      phase: 'playing',
      score: 0,
      shields: 3,
      remainingMs: 45_000,
      goal: 8,
    });
    db.transactions.tap({ x: 100, y: 100 });
    stepWorld(db, DT);
    db.transactions.startRun({
      seed: 1337,
      goal: 8,
      level: 1,
      packId: 'default',
    });
    expect(laneOf(db)).toBe(0);
    expect(db.resources.runId).toBe(2);
    expect(db.resources.events).toEqual([]);
    expect([...db.select(['runner'])]).toHaveLength(1);
    expect([...db.select(['gate'])]).toHaveLength(5);
  });

  it('switches lane on input without awarding points', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 8 });
    db.transactions.tap({ x: 20, y: 20 });
    expect(laneOf(db)).toBe(1);
    expect(db.resources.score).toBe(0);
    expect(drainEvents(db).map((e) => e.type)).toEqual(['switched']);
  });

  it('collects the first energy gate and wins at its goal', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 1 });
    expect(SYSTEM_ORDER).toHaveLength(1);
    for (let i = 0; i < 60; i++) stepWorld(db, DT);
    expect(db.resources).toMatchObject({ score: 1, phase: 'won', shields: 3 });
    expect(drainEvents(db).map((e) => e.type)).toEqual(['scored', 'phase']);
  });

  it('takes damage when the runner crosses a hazard lane', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 8 });
    db.transactions.tap({ x: 0, y: 0 });
    for (let i = 0; i < 60; i++) stepWorld(db, DT);
    expect(db.resources).toMatchObject({
      score: 0,
      shields: 2,
      phase: 'playing',
    });
    expect(drainEvents(db).map((e) => e.type)).toEqual(['switched', 'hit']);
  });

  it('replays identically for the same seed and inputs', () => {
    const a = createGameWorld();
    const b = createGameWorld();
    for (const db of [a, b]) {
      db.transactions.startRun({ seed: 42, goal: 8 });
      for (let i = 0; i < 220; i++) {
        if (i === 70 || i === 140) db.transactions.tap({ x: 0, y: 0 });
        stepWorld(db, DT);
      }
    }
    expect(b.resources).toEqual(a.resources);
    const gates = (db: typeof a) =>
      [...db.select(['gate'])].map((e) => db.read(e, ['lane', 'nextPass']));
    expect(gates(b)).toEqual(gates(a));
  });
});

describe('agent surface', () => {
  it('exposes the orbit state and switches lane through the same action', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, goal: 8, level: 1, packId: 'p' });
    const states = await new Promise<Record<string, { value: unknown }>>(
      (resolve) => {
        const off = db.services.agent.states((s) => {
          resolve(s);
          queueMicrotask(() => off());
        });
      },
    );
    expect(Object.keys(states).sort()).toEqual([
      'goal',
      'phase',
      'remainingMs',
      'role',
      'score',
      'shields',
    ]);
    await db.services.agent.execute('tap', { x: 0, y: 0 });
    expect(laneOf(db)).toBe(1);
    expect(db.resources.score).toBe(0);
    db.transactions.setPhase('lost');
    await db.services.agent.execute('start', {});
    expect(db.resources).toMatchObject({
      phase: 'playing',
      score: 0,
      shields: 3,
    });
  });
});
