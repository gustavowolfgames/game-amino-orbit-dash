/**
 * agentPlugin — the game world plus an `AgenticService` (@adobe/data/service).
 *
 * Extends the base `gamePlugin` with a `services.agent` that exposes the game as
 * observable **states** and conditionally available **actions**. Any agent
 * runtime (MCP, an LLM loop, an in-app bot, a test harness) reads the states and
 * calls `db.services.agent.execute(action, input)` to drive the game headlessly.
 *
 * A game replaces the role text and adds its own states (the board, the pieces)
 * and actions (move, rotate, send); `./README.md` shows one of each. `tap`
 * follows "input as intent": it queues a tap that a per-frame system drains on
 * the next `stepWorld`.
 *
 * Nullable states MUST use `Schema.Nullable(schema)`: a bare `nullable: true`
 * on a schema is silently ignored.
 */

import type { Schema } from '@adobe/data/schema';
import { AgenticService } from '@adobe/data/service';
import { Database, Observe } from '~/core/systems/ecs';
import { DEFAULT_SEED } from '../config';
import { type GameDatabase, gamePlugin } from '../sim/plugin';

const roleText =
  'You are playing a game built on this template. Read `phase`, `score` and `goal`. ' +
  'Call `tap` ({ x, y }) with a design-space point to act, and `start` to restart the level.';

const phaseSchema = {
  type: 'string',
  enum: ['idle', 'playing', 'won', 'lost'],
} as const satisfies Schema;

const tapParamSchema = {
  type: 'object',
  required: ['x', 'y'],
  properties: {
    x: { type: 'number', description: 'Design-space x of the tap.' },
    y: { type: 'number', description: 'Design-space y of the tap.' },
  },
} as const satisfies Schema;

export function createGameAgentService(db: GameDatabase): AgenticService {
  const phase = db.observe.resources.phase;
  const canTap = Observe.withMap(phase, (p) => p === 'playing');

  return AgenticService.create({
    interface: {
      role: {
        type: 'state',
        schema: { type: 'string' },
        description: 'Role and objective',
      },
      phase: {
        type: 'state',
        schema: phaseSchema,
        description: 'Current game phase',
      },
      score: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Points scored this run',
      },
      goal: {
        type: 'state',
        schema: { type: 'integer' },
        description: "The level's target (0 = none)",
      },
      tap: {
        type: 'action',
        description: 'Queue a tap at design-space (x, y)',
        parameters: [tapParamSchema],
      },
      start: {
        type: 'action',
        description: 'Restart the current level',
        parameters: [{ type: 'object', properties: {} }],
      },
    },
    implementation: {
      role: Observe.fromConstant(roleText),
      phase,
      score: db.observe.resources.score,
      goal: db.observe.resources.goal,
      tap: async (input: { x: number; y: number }) => {
        db.transactions.submitTap({ x: input.x, y: input.y });
      },
      start: async () => {
        const { level, packId, goal } = db.resources;
        db.transactions.startRun({ seed: DEFAULT_SEED, level, packId, goal });
      },
    },
    conditional: {
      // `tap` is only offered while a run is live: execute() returns an
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
