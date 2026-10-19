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
import { type GameDatabase, gamePlugin } from '../sim/plugin';
import { readBoard } from '../sim/readStateFromEcs';
import { applySwap } from '../sim/turn';

const roleText =
  'You are playing match-3 on an 8×8 board. `board` is 64 colour indices, row-major ' +
  '(0 red, 1 blue, 2 green, 3 yellow, 4 purple). Clear `goal` tiles of `goalColor` ' +
  'within `movesLeft`. Call `swap` ({ a: {col,row}, b: {col,row} }) on two neighbours; a ' +
  'swap that makes no line of 3 is reverted. `start` restarts the level.';

const cellSchema = {
  type: 'object',
  required: ['col', 'row'],
  properties: {
    col: { type: 'integer', minimum: 0, maximum: 7 },
    row: { type: 'integer', minimum: 0, maximum: 7 },
  },
} as const satisfies Schema;

const swapParamSchema = {
  type: 'object',
  required: ['a', 'b'],
  properties: { a: cellSchema, b: cellSchema },
} as const satisfies Schema;

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
      movesLeft: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Moves left this level',
      },
      goalColor: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Colour index the goal counts',
      },
      goalProgress: {
        type: 'state',
        schema: { type: 'integer' },
        description: 'Tiles of the goal colour cleared so far',
      },
      board: {
        type: 'state',
        schema: { type: 'array', items: { type: 'integer' } },
        description: '64 colour indices, row-major, row 0 at the top',
      },
      swap: {
        type: 'action',
        description: 'Swap two adjacent tiles (reverted if it makes no match)',
        parameters: [swapParamSchema],
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
      movesLeft: db.observe.resources.movesLeft,
      goalColor: db.observe.resources.goalColor,
      goalProgress: db.observe.resources.goalProgress,
      // rng advances on every committed move and every new board.
      board: Observe.withMap(db.observe.resources.rng, () => readBoard(db)),
      swap: async (input: {
        a: { col: number; row: number };
        b: { col: number; row: number };
      }) => {
        applySwap(db, input.a, input.b);
      },
      tap: async (input: { x: number; y: number }) => {
        db.transactions.submitTap({ x: input.x, y: input.y });
      },
      start: async () => {
        const { level, packId, goal, seed, goalColor, maxMoves } = db.resources;
        db.transactions.startRun({
          seed,
          level,
          packId,
          goal,
          goalColor,
          moves: maxMoves,
        });
      },
    },
    conditional: {
      // `tap` is only offered while a run is live: execute() returns an
      // ActionError outside of that.
      tap: canTap,
      swap: canTap,
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
