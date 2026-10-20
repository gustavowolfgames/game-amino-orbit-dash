/**
 * Headless tests for the core world (src/game/mygame/sim/*): the run lifecycle,
 * the determinism seam and input as intent. No engine, no screen: start a run,
 * queue taps, pump exact fixed frames, assert the ECS state. A game adds tests of
 * its own transactions and systems in the same shape.
 */

import { describe, expect, it } from 'vitest';
import { createGameAgentWorld } from '~/game/mygame/agent/agentPlugin';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { readStateFromEcs } from '~/game/mygame/sim/readStateFromEcs';
import { stepWorld } from '~/game/mygame/sim/schedule';
import { SYSTEM_ORDER } from '~/game/mygame/sim/systems';
import { systemInput } from '~/game/mygame/sim/systems/systemInput';

const DT = 1000 / 60; // one 60fps frame, in ms

describe('startRun', () => {
  it('enters play on the given level with a clean slate and the given seed', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1337, goal: 20, level: 2, packId: 'p' });
    expect(readStateFromEcs(db)).toEqual({
      level: 2,
      goal: 20,
      score: 0,
      phase: 'playing',
      elapsedMs: 0,
    });
    expect(db.resources.packId).toBe('p');
    expect(db.resources.rng).toBe(1337);
    expect(db.resources.pendingTaps).toEqual([]);
  });

  it('resets what the previous run left behind', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 });
    db.transactions.submitTap({ x: 1, y: 1 });
    stepWorld(db, DT);
    db.transactions.setPhase('lost');
    db.transactions.startRun({ seed: 2 });
    expect(readStateFromEcs(db)).toMatchObject({
      phase: 'playing',
      elapsedMs: 0,
      goal: 0,
    });
    expect(db.resources.pendingTaps).toEqual([]);
  });
});

describe('stepWorld', () => {
  it('runs the input system first', () => {
    expect(SYSTEM_ORDER).toEqual([systemInput]);
  });

  it('injects each fixed step as frameDeltaMs and accumulates elapsedMs', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 });
    for (let i = 0; i < 3; i++) stepWorld(db, DT);
    expect(db.resources.frameDeltaMs).toBe(DT);
    expect(db.resources.elapsedMs).toBeCloseTo(3 * DT);
  });
});

describe('input as intent', () => {
  it('queues every tap in order until a system drains them', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1 });
    db.transactions.submitTap({ x: 10, y: 20 });
    db.transactions.submitTap({ x: 30, y: 40 });
    expect(db.resources.pendingTaps).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    db.transactions.clearTaps();
    expect(db.resources.pendingTaps).toEqual([]);
  });
});

describe('agent surface', () => {
  it('plays a tube tap and an undo through the agent actions', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, colors: 4 });
    await db.services.agent.execute('tapTube', { tube: 0 });
    expect(db.resources.heldTube).toBe(0);
    await db.services.agent.execute('tapTube', { tube: 4 }); // an empty tube
    expect(db.resources.moves).toBe(1);
    await db.services.agent.execute('undo', {});
    expect(db.resources.moves).toBe(0);
  });

  it('queues a tap while playing and restarts the current level', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, goal: 5, level: 1, packId: 'p' });
    await db.services.agent.execute('tap', { x: 3, y: 4 });
    expect(db.resources.pendingTaps).toEqual([{ x: 3, y: 4 }]);
    db.transactions.setPhase('lost');
    await db.services.agent.execute('start', {});
    expect(readStateFromEcs(db)).toMatchObject({
      level: 1,
      goal: 5,
      phase: 'playing',
    });
    expect(db.resources.packId).toBe('p');
  });
});
