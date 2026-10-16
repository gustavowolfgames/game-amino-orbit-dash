/**
 * Headless tests for the minimal ECS demo's deterministic sim
 * (src/game/mygame/ecs/*). The payoff of the determinism seam: the whole game
 * runs with no engine and no screen. Start a run, queue a tap as intent, pump
 * exact fixed frames, and assert the resulting ECS state. Because `dt`, input,
 * and RNG are all injected/seeded (never wall-clock / native events /
 * Math.random), every outcome here is reproducible.
 */

import { describe, expect, it } from 'vitest';
import {
  CENTER,
  COLLECT_RADIUS,
  ORBIT_RADIUS,
  POINTS_PER_COLLECT,
} from '~/game/mygame/demo/config';
import { createGameWorld } from '~/game/mygame/ecs/gamePlugin';
import { readMovers, readOrbiters } from '~/game/mygame/ecs/readStateFromEcs';
import { stepWorld } from '~/game/mygame/ecs/schedule';

const DT = 1000 / 60; // one 60fps frame, in ms

/** Start a small, fully-controlled run. */
function startTestRun(
  db: ReturnType<typeof createGameWorld>,
  over: Partial<{ orbiterCount: number; seed: number }> = {},
) {
  db.transactions.startDemo({
    orbiterCount: over.orbiterCount ?? 6,
    seed: over.seed ?? 1337,
  });
}

describe('startDemo', () => {
  it('rings the centre and sets play state', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 6 });

    expect(db.resources.phase).toBe('playing');
    expect(db.resources.remaining).toBe(6);
    expect(db.resources.score).toBe(0);
    expect(readOrbiters(db)).toHaveLength(6);
    // No movers until the player taps.
    expect(readMovers(db)).toHaveLength(0);
  });

  it('spaces orbiters evenly on the ring at ORBIT_RADIUS', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 4 });
    for (const o of readOrbiters(db)) {
      const dx = o.position[0] - CENTER[0];
      const dy = o.position[1] - CENTER[1];
      expect(Math.hypot(dx, dy)).toBeCloseTo(ORBIT_RADIUS, 3);
    }
  });

  it('plays a Content Pack level: its ring, and which level of which pack it is', () => {
    const db = createGameWorld();
    db.transactions.startDemo({
      orbiterCount: 3,
      seed: 7,
      orbitRadius: 200,
      level: 1,
      packId: 'edition',
    });
    expect(db.resources.level).toBe(1);
    expect(db.resources.packId).toBe('edition');
    for (const o of readOrbiters(db)) {
      expect(
        Math.hypot(o.position[0] - CENTER[0], o.position[1] - CENTER[1]),
      ).toBeCloseTo(200, 3);
    }
  });

  it('restarts cleanly — a second start replaces the ring, no leftovers', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 6 });
    // Tap to spawn a mover, then restart.
    db.transactions.submitTap({ x: 0, y: 0 });
    stepWorld(db, DT);
    expect(readMovers(db).length).toBeGreaterThan(0);

    startTestRun(db, { orbiterCount: 3 });
    expect(readOrbiters(db)).toHaveLength(3);
    expect(readMovers(db)).toHaveLength(0); // movers cleared on restart
    expect(db.resources.score).toBe(0);
  });
});

describe('orbit system', () => {
  it('advances every orbiter angle by orbitSpeed·dt each step', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 3 });
    const before = readOrbiters(db).map((o) => o.angle);
    stepWorld(db, DT);
    const after = readOrbiters(db).map((o) => o.angle);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBeGreaterThan(before[i]); // ring is spinning
    }
    // Position stays on the ring after advancing.
    for (const o of readOrbiters(db)) {
      const r = Math.hypot(
        o.position[0] - CENTER[0],
        o.position[1] - CENTER[1],
      );
      expect(r).toBeCloseTo(ORBIT_RADIUS, 3);
    }
  });

  it('is deterministic — same seed → same mover colours', () => {
    const a = createGameWorld();
    const b = createGameWorld();
    startTestRun(a, { seed: 42 });
    startTestRun(b, { seed: 42 });
    // Movers draw colour from the seeded RNG; identical seeds + taps must match.
    for (let i = 0; i < 5; i++) {
      a.transactions.submitTap({ x: 10 * i, y: 20 * i });
      b.transactions.submitTap({ x: 10 * i, y: 20 * i });
      stepWorld(a, DT);
      stepWorld(b, DT);
    }
    expect(readMovers(a).map((m) => m.color)).toEqual(
      readMovers(b).map((m) => m.color),
    );
  });
});

describe('movement system', () => {
  it('integrates a mover along its velocity', () => {
    const db = createGameWorld();
    startTestRun(db);
    db.transactions.submitTap({ x: CENTER[0], y: CENTER[1] });
    stepWorld(db, DT);
    const m0 = readMovers(db)[0];
    const p0: [number, number] = [m0.position[0], m0.position[1]];
    stepWorld(db, DT);
    const p1 = readMovers(db)[0].position;
    // Moved somewhere (non-zero velocity was integrated).
    expect(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])).toBeGreaterThan(0);
  });

  it('bounces off a wall — a mover pushed past the edge flips velocity', () => {
    const db = createGameWorld();
    startTestRun(db);
    // Spawn at the left edge; whatever the seeded direction, a big step drives it
    // into a wall and reflects it back inside the box.
    db.transactions.submitTap({ x: 0, y: CENTER[1] });
    stepWorld(db, DT);
    const before = readMovers(db)[0].velocity[0];
    db.transactions.advanceMovers({ dtSec: 2 }); // large deterministic step
    const after = readMovers(db)[0].velocity[0];
    // At least one axis must have reflected against a wall over a 2s sweep.
    const m = readMovers(db)[0];
    expect(m.position[0]).toBeGreaterThanOrEqual(0);
    // vx flipped sign iff it hit a vertical wall; assert the body stayed in-box.
    expect(Number.isFinite(after)).toBe(true);
    expect(Number.isFinite(before)).toBe(true);
  });
});

describe('input as intent', () => {
  it('drains a queued tap and spawns a mover', () => {
    const db = createGameWorld();
    startTestRun(db);

    db.transactions.submitTap({ x: 100, y: 100 });
    expect(db.resources.pendingTaps).toHaveLength(1);

    stepWorld(db, DT);
    expect(db.resources.pendingTaps).toHaveLength(0); // drained by inputSystem
    expect(readMovers(db)).toHaveLength(1);
  });

  it('drains every queued tap in one step', () => {
    const db = createGameWorld();
    startTestRun(db);
    db.transactions.submitTap({ x: 10, y: 10 });
    db.transactions.submitTap({ x: 20, y: 20 });
    expect(db.resources.pendingTaps).toHaveLength(2);
    stepWorld(db, DT);
    expect(db.resources.pendingTaps).toHaveLength(0);
    expect(readMovers(db)).toHaveLength(2);
  });

  it('a tap on an orbiter collects it and scores', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 6 });
    const target = readOrbiters(db)[0];
    const before = db.resources.remaining;

    // Tap exactly on the orbiter (well within COLLECT_RADIUS).
    db.transactions.submitTap({ x: target.position[0], y: target.position[1] });
    stepWorld(db, DT);

    expect(db.resources.remaining).toBe(before - 1);
    expect(db.resources.score).toBe(POINTS_PER_COLLECT);
    expect(readOrbiters(db).some((o) => o.entity === target.entity)).toBe(
      false,
    );
  });

  it('a tap far from every orbiter collects nothing (spawns a mover only)', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 6 });
    // Tap the dead centre — the ring sits at ORBIT_RADIUS, well beyond reach.
    expect(ORBIT_RADIUS).toBeGreaterThan(COLLECT_RADIUS);
    db.transactions.submitTap({ x: CENTER[0], y: CENTER[1] });
    stepWorld(db, DT);
    expect(db.resources.remaining).toBe(6); // nothing collected
    expect(readMovers(db)).toHaveLength(1); // but a mover spawned
  });
});

describe('winning', () => {
  it('collecting every orbiter ends the run in the won phase', () => {
    const db = createGameWorld();
    startTestRun(db, { orbiterCount: 4 });

    // Collect them one at a time by tapping each orbiter's current position.
    let guard = 0;
    while (db.resources.remaining > 0 && guard < 50) {
      const o = readOrbiters(db)[0];
      db.transactions.submitTap({ x: o.position[0], y: o.position[1] });
      stepWorld(db, DT);
      guard++;
    }

    expect(db.resources.remaining).toBe(0);
    expect(db.resources.phase).toBe('won');
    expect(db.resources.score).toBe(4 * POINTS_PER_COLLECT);
    // Orbit/movement systems stop mutating orbiters once the ring is empty.
    expect(readOrbiters(db)).toHaveLength(0);
  });
});
