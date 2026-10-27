/**
 * Headless tests for the core world (src/game/mygame/sim/*): the run lifecycle,
 * the determinism seam and the agent surface. No engine, no screen: start a
 * run, call transactions, pump exact fixed frames, assert the ECS state. The
 * match-3 rules themselves are in match3.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { createGameAgentWorld } from '~/game/mygame/agent/agentPlugin';
import { createGameWorld } from '~/game/mygame/sim/plugin';
import { stepWorld } from '~/game/mygame/sim/schedule';
import { SYSTEM_ORDER } from '~/game/mygame/sim/systems';
import { readBoard } from '~/game/mygame/sim/tiles';

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
      seed: 1337,
      movesLeft: 20,
    });
    // Building the starting board draws from the seeded rng.
    expect(db.resources.rng).not.toBe(1337);
  });

  it('resets what the previous run left behind', () => {
    const db = createGameWorld();
    db.transactions.startRun({ seed: 1, goal: 5 });
    db.transactions.addScore({ points: 90 });
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
  it('ships with no systems: match-3 resolves turns on input', () => {
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
  it('exposes the role, the run, the goal and the board', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 1, goal: 5, goalColor: 2, moves: 12 });
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
      'goal',
      'goalColor',
      'goalProgress',
      'movesLeft',
      'phase',
      'role',
      'score',
    ]);
    expect(states.goal.value).toBe(5);
    expect(states.goalColor.value).toBe(2);
    expect(states.movesLeft.value).toBe(12);
    expect(states.board.value).toEqual(readBoard(db));
  });

  it('swaps through the turn function, refuses outside a run, and restarts on the same board', async () => {
    const db = createGameAgentWorld();
    db.transactions.startRun({ seed: 3, goal: 99, goalColor: 1, moves: 20 });
    const start = readBoard(db);
    // Try neighbours until one makes a line (every starting board has a move).
    let moved = false;
    for (let i = 0; i < 64 && !moved; i++) {
      const a = { col: i % 8, row: Math.floor(i / 8) };
      for (const b of [
        { col: a.col + 1, row: a.row },
        { col: a.col, row: a.row + 1 },
      ]) {
        if (moved || b.col > 7 || b.row > 7) continue;
        await db.services.agent.execute('swap', { a, b });
        moved = db.resources.movesLeft === 19;
      }
    }
    expect(moved).toBe(true);
    expect(db.resources.score).toBeGreaterThanOrEqual(90);

    db.transactions.setPhase('lost');
    const refused = await db.services.agent.execute('swap', {
      a: { col: 0, row: 0 },
      b: { col: 1, row: 0 },
    });
    expect(refused).toBeTruthy(); // an ActionError: swap is not offered now
    expect(db.resources.movesLeft).toBe(19);

    await db.services.agent.execute('start', {});
    expect(readBoard(db)).toEqual(start);
    expect(db.resources).toMatchObject({ movesLeft: 20, phase: 'playing' });
  });
});
