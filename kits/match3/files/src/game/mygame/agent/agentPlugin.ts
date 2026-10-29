/**
 * agentPlugin — this game, as states an agent reads and actions it calls.
 *
 * The per-game part is only the declaration in `createGameAgentService`: the
 * role text, the states (what a player sees) and the actions (what a player
 * can do). `./createAgentService.ts` turns it into an `AgenticService`, and the
 * plugin below registers it as `db.services.agent` on top of the game world.
 * `swap` calls the same turn function the player's drag does (`applySwap`),
 * so an agent plays by the same rules. `./README.md` shows how to add one of each.
 *
 * `start` restarts the level on the same board in a headless world (tests, a CLI).
 * The running game's world (`../world.ts`) offers it only while the game screen has
 * installed its own restart (`setLiveStart`), so an agent's restart takes the same
 * level flow as the player's: seed, saved progress, analytics.
 */

import type { Schema } from '@adobe/data/schema';
import type { AgenticService } from '@adobe/data/service';
import { Database, Observe } from '~/core/systems/ecs';
import { type GameDatabase, gamePlugin } from '../sim/plugin';
import { BOARD_SIZE } from '../sim/rules/board';
import { readBoard } from '../sim/tiles';
import { applySwap } from '../sim/turn';
import { createAgentService } from './createAgentService';

const phaseSchema = {
  type: 'string',
  enum: ['idle', 'playing', 'won', 'lost'],
} as const satisfies Schema;

const cellSchema = {
  type: 'object',
  required: ['col', 'row'],
  properties: {
    col: { type: 'integer', minimum: 0, maximum: BOARD_SIZE - 1 },
    row: { type: 'integer', minimum: 0, maximum: BOARD_SIZE - 1 },
  },
} as const satisfies Schema;

const swapSchema = {
  type: 'object',
  required: ['a', 'b'],
  properties: { a: cellSchema, b: cellSchema },
} as const satisfies Schema;

const boardSchema = {
  type: 'array',
  items: { type: 'integer' },
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
  // Headless default: restart the current level on the same board.
  let start: Start | null = () => {
    const { level, packId, goal, seed, goalColor, maxMoves } = db.resources;
    db.transactions.startRun({
      seed,
      level,
      packId,
      goal,
      goalColor,
      moves: maxMoves,
    });
  };
  const [canStart, setCanStart] = Observe.createState(true);
  liveStarts.set(db, (next) => {
    start = next;
    setCanStart(next !== null);
  });
  return createAgentService({
    role:
      'You are playing match-3 on an 8×8 board. `board` is 64 colour indices, row-major ' +
      '(0 red, 1 blue, 2 green, 3 yellow, 4 purple). Clear `goal` tiles of `goalColor` ' +
      'within `movesLeft`. Call `swap` ({ a: {col,row}, b: {col,row} }) on two neighbours; a ' +
      'swap that makes no line of 3 is reverted. `start` restarts the level.',
    states: {
      phase: {
        schema: phaseSchema,
        description: 'Current game phase',
        value: r.phase,
      },
      score: {
        schema: { type: 'integer' },
        description: 'Points scored this level',
        value: r.score,
      },
      goal: {
        schema: { type: 'integer' },
        description: 'Tiles of the goal colour to clear',
        value: r.goal,
      },
      goalColor: {
        schema: { type: 'integer' },
        description: 'Colour index the goal counts',
        value: r.goalColor,
      },
      goalProgress: {
        schema: { type: 'integer' },
        description: 'Tiles of the goal colour cleared so far',
        value: r.goalProgress,
      },
      movesLeft: {
        schema: { type: 'integer' },
        description: 'Moves left this level',
        value: r.movesLeft,
      },
      board: {
        schema: boardSchema,
        description: '64 colour indices, row-major, row 0 at the top',
        // Every board write bumps boardVersion.
        value: Observe.withMap(r.boardVersion, () => readBoard(db)),
      },
    },
    actions: {
      swap: {
        description: 'Swap two adjacent tiles (reverted if it makes no match)',
        input: swapSchema,
        when: Observe.withMap(r.phase, (p) => p === 'playing'),
        run: ({ a, b }) => {
          applySwap(db, a, b);
        },
      },
      start: {
        description:
          'Restart the current level (in the running game, the next level after a win)',
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
