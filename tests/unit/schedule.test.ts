/**
 * Headless tests for the core world (src/game/mygame/sim/*): the run lifecycle,
 * the determinism seam, the example `tap` move and the agent surface. No engine,
 * no screen: start a run, call transactions, pump exact fixed frames, assert the
 * ECS state. A game adds tests of its own transactions and systems in the same
 * shape.
 */

import { describe, expect, it } from 'vitest';
import { createGameAgentWorld } from '~/game/mygame/agent/agentPlugin';
import { drainEvents } from '~/game/mygame/sim/events';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { stepWorld } from '~/game/mygame/sim/schedule';
import { SYSTEM_ORDER } from '~/game/mygame/sim/systems';

const DT = 1000 / 60; // one 60fps frame, in ms

describe('startRun', () => {
  it('enters play on the given level with a clean slate and the given seed', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1337, goal: 20, level: 2, packId: 'p' });
    expect(db.resources).toMatchObject({
      level: 2,
      goal: 20,
      score: 0,
      phase: 'playing',
      elapsedMs: 0,
      packId: 'p',
      rng: 1337,
    });
  });

  it('resets what the previous run left behind', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 5 });
    db.transactions.tap({ x: 1, y: 1 });
    stepWorld(db, DT);
    db.transactions.setPhase('lost');
    db.transactions.startRun({ seed: 2 });
    expect(db.resources).toMatchObject({
      phase: 'playing',
      score: 0,
      elapsedMs: 0,
      goal: 0,
    });
    expect(db.resources.events).toEqual([]);
  });
});

describe('stepWorld', () => {
  it('ships with no systems: a game adds its own', () => {
    expect(SYSTEM_ORDER).toEqual([]);
  });

  it('injects each fixed step as frameDeltaMs and accumulates elapsedMs', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 });
    for (let i = 0; i < 3; i++) stepWorld(db, DT);
    expect(db.resources.frameDeltaMs).toBe(DT);
    expect(db.resources.elapsedMs).toBeCloseTo(3 * DT);
  });
});

describe('the example tap move', () => {
  it('scores a point per tap and wins at the goal', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 2 });
    db.transactions.tap({ x: 10, y: 20 });
    expect(db.resources).toMatchObject({ score: 1, phase: 'playing' });
    db.transactions.tap({ x: 30, y: 40 });
    expect(db.resources).toMatchObject({ score: 2, phase: 'won' });
    expect(drainEvents(db).map((e) => e.type)).toEqual([
      'scored',
      'scored',
      'phase',
    ]);
  });

  it('does nothing outside a live run', () => {
    const db = createGameWorld();
    db.transactions.tap({ x: 0, y: 0 }); // idle
    expect(db.resources.score).toBe(0);
    expect(drainEvents(db)).toEqual([]);
  });
});

describe('agent surface', () => {
  it('exposes role, phase, score and goal', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, goal: 5 });
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
      'role',
      'score',
    ]);
    expect(states.goal.value).toBe(5);
    expect(states.phase.value).toBe('playing');
  });

  it('taps while playing, refuses outside a run, and restarts the current level', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, goal: 5, level: 1, packId: 'p' });
    await db.services.agent.execute('tap', { x: 3, y: 4 });
    expect(db.resources.score).toBe(1);
    db.transactions.setPhase('lost');
    const refused = await db.services.agent.execute('tap', { x: 3, y: 4 });
    expect(refused).toBeTruthy(); // an ActionError: tap is not offered now
    expect(db.resources.score).toBe(1);
    await db.services.agent.execute('start', {});
    expect(db.resources).toMatchObject({
      level: 1,
      goal: 5,
      packId: 'p',
      phase: 'playing',
      score: 0,
    });
  });
});
