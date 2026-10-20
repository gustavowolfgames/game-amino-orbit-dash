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
import { type GameDatabase, gamePlugin, readBoard } from '../sim/plugin';

const roleText =
  'You are playing ball sort. `board` lists each tube bottom ball first (colour indices). ' +
  "Call `tapTube` ({ tube }) to lift a tube's top ball, then again on another tube to drop it " +
  '(legal onto an empty tube or the same colour with room). Sort every colour into its own tube. ' +
  '`undo` takes back a move (3 per level); `start` restarts the level.';

const phaseSchema = {
  type: 'string',
  enum: ['idle', 'playing', 'won', 'lost'],
} as const satisfies Schema;

const tubeParamSchema = {
  type: 'object',
  required: ['tube'],
  properties: {
    tube: { type: 'integer', description: 'Tube index, 0-based.' },
  },
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
      moves: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Moves this level',
      },
      undosLeft: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Undos left this level',
      },
      heldTube: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Tube whose top ball is lifted, or -1',
      },
      stuck: {
        type: 'state',
        schema: { type: 'boolean' },
        description: 'No legal move left: call start to retry',
      },
      board: {
        type: 'state',
        schema: {
          type: 'array',
          items: { type: 'array', items: { type: 'integer' } },
        },
        description: 'Tubes, bottom ball first',
      },
      tapTube: {
        type: 'action',
        description:
          'Tap a tube: lift its top ball, or drop the lifted ball there',
        parameters: [tubeParamSchema],
      },
      undo: {
        type: 'action',
        description: 'Take back the last move',
        parameters: [{ type: 'object', properties: {} }],
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
      moves: db.observe.resources.moves,
      undosLeft: db.observe.resources.undosLeft,
      heldTube: db.observe.resources.heldTube,
      stuck: db.observe.resources.stuck,
      board: Observe.withMap(db.observe.resources.history, () => readBoard(db)),
      tapTube: async (input: { tube: number }) => {
        db.transactions.tapTube({ tube: input.tube });
      },
      undo: async () => {
        db.transactions.undo();
      },
      tap: async (input: { x: number; y: number }) => {
        db.transactions.submitTap({ x: input.x, y: input.y });
      },
      start: async () => {
        db.transactions.restartLevel();
      },
    },
    conditional: {
      // `tap` is only offered while a run is live: execute() returns an
      // ActionError outside of that.
      tap: canTap,
      tapTube: canTap,
      undo: canTap,
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
