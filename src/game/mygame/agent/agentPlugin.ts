/**
 * agentPlugin — this game, as states an agent reads and actions it calls.
 *
 * The per-game part is only the declaration in `createGameAgentService`: the
 * role text, the states (what a player sees) and the actions (what a player
 * can do). `./createAgentService.ts` turns it into an `AgenticService`, and the
 * plugin below registers it as `db.services.agent` on top of the game world.
 * Actions call the same transactions the player's input does, so an agent
 * plays by the same rules. `./README.md` shows how to add one of each.
 *
 * `start` restarts by transaction in a headless world (tests, a CLI). The running
 * game's world (`../world.ts`) offers it only while the game screen has installed
 * its own restart (`setLiveStart`), so an agent's restart takes the same level
 * flow as the player's: seed, saved progress, analytics.
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

type Start = () => void | Promise<void>;

/** Each world's `start` setter, filled in when its agent service is built. */
const liveStarts = new WeakMap<GameDatabase, (start: Start | null) => void>();

/**
 * Replace what the agent's `start` does on this world; `null` withdraws `start`.
 * The game controller installs its `startRun` while the game screen is up.
 */
export function setLiveStart(db: GameDatabase, start: Start | null): void {
  liveStarts.get(db)?.(start);
}

export function createGameAgentService(db: GameDatabase): AgenticService {
  const r = db.observe.resources;
  // Headless default: replay the current level.
  let start: Start | null = () => {
    const { level, packId, goal } = db.resources;
    db.transactions.startRun({ seed: DEFAULT_SEED, level, packId, goal });
  };
  const [canStart, setCanStart] = Observe.createState(true);
  liveStarts.set(db, (next) => {
    start = next;
    setCanStart(next !== null);
  });
  return createAgentService({
    role:
      'You are playing Orbit Dash. The pulse moves clockwise; each gate has a safe energy lane and a hazard lane. ' +
      'Call `tap` ({ x, y }) to switch between inner and outer lanes, collect energy to reach `goal`, and keep shields above zero. Use `start` for the next run.',
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
      shields: {
        schema: { type: 'integer' },
        description: 'Shields remaining (zero ends the run)',
        value: r.shields,
      },
      remainingMs: {
        schema: { type: 'number' },
        description: 'Milliseconds left in the run',
        value: r.remainingMs,
      },
    },
    actions: {
      tap: {
        description: 'Switch the pulse to the other orbit lane',
        input: pointSchema,
        when: Observe.withMap(r.phase, (p) => p === 'playing'),
        run: (p) => db.transactions.tap(p),
      },
      start: {
        description:
          'Start the next run: the next level after a win, else this level again',
        when: canStart,
        run: () => start?.(),
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
