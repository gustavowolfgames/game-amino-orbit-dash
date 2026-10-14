/**
 * agentPlugin — this game, as states an agent reads and actions it calls.
 *
 * The per-game part is only the declaration in `createGameAgentService`: the
 * role text, the states (what a player sees) and the actions (what a player
 * can do). `./createAgentService.ts` turns it into an `AgenticService`, and the
 * plugin below registers it as `db.services.agent` on top of the game world.
 * Actions call the same transactions the player's input does, so an agent
 * plays by the same rules. `./README.md` shows how to add one of each.
 */

import type { Schema } from '@adobe/data/schema';
import type { AgenticService } from '@adobe/data/service';
import { Database, Observe } from '~/core/systems/ecs';
import { DEFAULT_SEED } from '../config';
import { type GameDatabase, gamePlugin } from '../sim/plugin';
import { createAgentService } from './createAgentService';

const phaseSchema = {
  type: 'string',
  enum: ['idle', 'playing', 'won', 'lost'],
} as const satisfies Schema;

const pointSchema = {
  type: 'object',
  required: ['x', 'y'],
  properties: {
    x: { type: 'number', description: 'Design-space x of the tap.' },
    y: { type: 'number', description: 'Design-space y of the tap.' },
  },
} as const satisfies Schema;

export function createGameAgentService(db: GameDatabase): AgenticService {
  const r = db.observe.resources;
  return createAgentService({
    role:
      'You are playing a game built on this template. Read `phase`, `score` and `goal`. ' +
      'Call `tap` ({ x, y }) with a design-space point to score, and `start` to restart the level.',
    states: {
      phase: {
        schema: phaseSchema,
        description: 'Current game phase',
        value: r.phase,
      },
      score: {
        schema: { type: 'integer' },
        description: 'Points scored this run',
        value: r.score,
      },
      goal: {
        schema: { type: 'integer' },
        description: "The level's target (0 = none)",
        value: r.goal,
      },
    },
    actions: {
      tap: {
        description: 'Tap at design-space (x, y)',
        input: pointSchema,
        when: Observe.withMap(r.phase, (p) => p === 'playing'),
        run: (p) => db.transactions.tap(p),
      },
      start: {
        description: 'Restart the current level',
        run: () => {
          const { level, packId, goal } = db.resources;
          db.transactions.startRun({ seed: DEFAULT_SEED, level, packId, goal });
        },
      },
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
