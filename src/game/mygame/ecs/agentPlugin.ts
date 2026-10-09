/**
 * agentPlugin — the game world plus an `AgenticService` (@adobe/data/service).
 *
 * Extends the base `gamePlugin` with a `services.agent` that exposes the demo as
 * observable **states** (score, phase, orbiters remaining, the ring) and
 * conditionally available **actions** (tap, start). Any agent runtime (MCP, an
 * LLM loop, an in-app bot, a test harness) can read the states and call
 * `db.services.agent.execute(action, input)` to drive the game headlessly.
 *
 * `tap` follows the game's "input as intent" rule: it queues a tap via
 * `submitTap`, which the per-frame `systemInput` drains on the next `stepWorld`.
 * A headless driver taps, then pumps fixed steps to resolve it — exactly what the
 * live loop does.
 *
 * Nullable states MUST use `Schema.Nullable(schema)` — a bare `nullable: true`
 * on a schema is silently ignored.
 */

import { Schema } from '@adobe/data/schema';
import { AgenticService } from '@adobe/data/service';
import { Database, Observe } from '~/core/systems/ecs';
import { ORBITER_COUNT } from '../demo/config';
import { type GameDatabase, gamePlugin } from './gamePlugin';
import { readOrbiters } from './readStateFromEcs';

const roleText =
  'You are playing a minimal ECS demo. Collectible orbs circle the centre of a ' +
  'design box; drifting movers bounce off the walls. Call `tap` ({ x, y }) — a ' +
  'design-space point — to collect the nearest orb within reach (and spawn a ' +
  'mover). Collect every orb to win. Read `orbiters` for each orb (color, x, y).';

// ── Schemas (JSON Schema, kept loose so agents see structure without rigidity) ──

const phaseSchema = {
  type: 'string',
  enum: ['idle', 'playing', 'won'],
} as const satisfies Schema;

const orbiterSchema = {
  type: 'object',
  required: ['color', 'x', 'y'],
  properties: {
    color: { type: 'integer' },
    x: { type: 'number' },
    y: { type: 'number' },
  },
} as const satisfies Schema;

const ringSchema = {
  type: 'array',
  items: orbiterSchema,
} as const satisfies Schema;

const tapParamSchema = {
  type: 'object',
  required: ['x', 'y'],
  properties: {
    x: { type: 'number', description: 'Design-space x of the tap.' },
    y: { type: 'number', description: 'Design-space y of the tap.' },
  },
} as const satisfies Schema;

const startParamSchema = {
  type: 'object',
  properties: {
    orbiterCount: { type: 'integer', minimum: 1, description: 'How many orbs to ring the centre.' },
  },
} as const satisfies Schema;

/** A compact, agent-friendly view of the ring (no ECS internals). */
function ringSummary(db: GameDatabase) {
  return readOrbiters(db).map((o) => ({ color: o.color, x: o.position[0], y: o.position[1] }));
}

export function createGameAgentService(db: GameDatabase): AgenticService {
  const phase = db.observe.resources.phase;

  // Recompute the ring view whenever a turn-relevant resource changes. These
  // resources are stateful (emit current value on subscribe) and every collect
  // touches at least one of them.
  const tick = Observe.fromProperties({
    score: db.observe.resources.score,
    remaining: db.observe.resources.remaining,
    phase: db.observe.resources.phase,
  });
  const orbiters = Observe.withMap(tick, () => ringSummary(db));

  const canTap = Observe.withMap(phase, (p) => p === 'playing');

  return AgenticService.create({
    interface: {
      role: { type: 'state', schema: { type: 'string' }, description: 'Role and objective' },
      phase: { type: 'state', schema: phaseSchema, description: 'Current game phase' },
      score: { type: 'state', schema: { type: 'integer' }, description: 'Points scored this run' },
      remaining: { type: 'state', schema: { type: 'integer' }, description: 'Orbs left to collect' },
      orbiters: { type: 'state', schema: ringSchema, description: 'Every orb in the ring' },
      tap: {
        type: 'action',
        description: 'Queue a tap at design-space (x, y) — collects the nearest orb within reach',
        parameters: [tapParamSchema],
      },
      start: {
        type: 'action',
        description: 'Restart the run with a fresh ring of orbiters',
        parameters: [startParamSchema],
      },
    },
    implementation: {
      role: Observe.fromConstant(roleText),
      phase,
      score: db.observe.resources.score,
      remaining: db.observe.resources.remaining,
      orbiters,
      tap: async (input: { x: number; y: number }) => {
        db.transactions.submitTap({ x: input.x, y: input.y });
      },
      start: async (input: { orbiterCount?: number }) => {
        db.transactions.startDemo({
          orbiterCount: input.orbiterCount ?? ORBITER_COUNT,
          seed: (db.resources.level + 1) * 1013904223,
          level: db.resources.level,
          packId: db.resources.packId,
        });
      },
    },
    conditional: {
      // `tap` is only offered while a run is live — execute() returns an
      // ActionError outside of that.
      tap: canTap,
    },
  });
}

// ── Plugin (base + agent service) ───────────────────────────────────────────

export const gameAgentPlugin = Database.Plugin.create({
  extends: gamePlugin,
  services: {
    agent: (db): AgenticService => createGameAgentService(db as GameDatabase),
  },
});

export type GameAgentPlugin = typeof gameAgentPlugin;
export type GameAgentDatabase = Database.Plugin.ToDatabase<GameAgentPlugin>;

/** Create a game ECS world *with* the agent service registered. */
export function createGameAgentWorld(): GameAgentDatabase {
  return Database.create(gameAgentPlugin) as GameAgentDatabase;
}
