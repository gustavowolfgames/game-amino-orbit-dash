/**
 * Headless tests for the core world (src/game/mygame/sim/*): the run lifecycle,
 * the determinism seam and the agent surface, for ball sort. No engine, no
 * screen: start a run, call transactions, pump exact fixed frames, assert the
 * ECS state. The rules and moves are in tests/unit/ballSort.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { createGameAgentWorld } from '~/game/mygame/agent/agentPlugin';
import { drainEvents } from '~/game/mygame/sim/events';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { readBoard } from '~/game/mygame/sim/readBoard';
import { generateBoard } from '~/game/mygame/sim/rules/ballSort';
import { stepWorld } from '~/game/mygame/sim/schedule';
import { SYSTEM_ORDER } from '~/game/mygame/sim/systems';

const DT = 1000 / 60; // one 60fps frame, in ms

describe('startRun', () => {
  it('enters play on the given level with a clean slate and the given seed', () => {
    const db = createGameWorld();
    db.transactions.startRun({
      seed: 1337,
      colors: 4,
      par: 12,
      level: 2,
      packId: 'p',
    });
    expect(db.resources).toMatchObject({
      level: 2,
      packId: 'p',
      phase: 'playing',
      elapsedMs: 0,
      rng: 1337,
      seed: 1337,
      par: 12,
      moves: 0,
      heldTube: -1,
      cursor: -1,
    });
    expect(readBoard(db)).toEqual(generateBoard(1337, 4));
  });

  it('resets what the previous run left behind', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, colors: 4 });
    db.transactions.tapTube({ tube: 0 });
    stepWorld(db, DT);
    db.transactions.setPhase('lost');
    db.transactions.startRun({ seed: 2, colors: 4 });
    expect(db.resources).toMatchObject({
      phase: 'playing',
      elapsedMs: 0,
      heldTube: -1,
      moves: 0,
    });
    expect(db.resources.events).toEqual([]);
  });
});

describe('stepWorld', () => {
  it('ball sort is turn-based: no systems, moves resolve in transactions', () => {
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

describe('agent surface', () => {
  it('exposes the role, the board and the move counters', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, colors: 4 });
    const states = await new Promise<Record<string, { value: unknown }>>(
      (resolve) => {
        const off = db.services.agent.states((s) => {
          resolve(s);
          queueMicrotask(() => off());
        });
      },
    );
    expect(Object.keys(states).sort()).toEqual([
      'board',
      'heldTube',
      'moves',
      'phase',
      'role',
      'stuck',
      'undosLeft',
    ]);
    expect(states.board.value).toEqual(generateBoard(1, 4));
    expect(states.phase.value).toBe('playing');
  });

  it('plays a tube tap and an undo, refuses outside a run, and restarts the level', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, colors: 4, level: 1, packId: 'p' });
    await db.services.agent.execute('tapTube', { tube: 0 });
    expect(db.resources.heldTube).toBe(0);
    await db.services.agent.execute('tapTube', { tube: 4 }); // an empty tube
    expect(db.resources.moves).toBe(1);
    await db.services.agent.execute('undo', {});
    expect(db.resources.moves).toBe(0);
    await db.services.agent.execute('tapTube', { tube: 0 });
    await db.services.agent.execute('start', {});
    expect(db.resources).toMatchObject({
      level: 1,
      packId: 'p',
      phase: 'playing',
      heldTube: -1,
      undosLeft: 3,
    });
    expect(drainEvents(db).at(-1)).toEqual({ type: 'restarted', level: 1 });
    db.transactions.setPhase('lost');
    const refused = await db.services.agent.execute('tapTube', { tube: 0 });
    expect(refused).toBeTruthy(); // an ActionError: not offered outside a run
    expect(db.resources.heldTube).toBe(-1);
  });
});
