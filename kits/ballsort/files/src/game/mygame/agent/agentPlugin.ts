/**
 * agentPlugin — ball sort, as states an agent reads and actions it calls.
 *
 * The per-game part is only the declaration in `createGameAgentService`: the
 * role text, the states (what a player sees) and the actions (what a player
 * can do). `./createAgentService.ts` turns it into an `AgenticService`, and the
 * plugin below registers it as `db.services.agent` on top of the game world.
 * Actions call the same transactions the player's input does, so an agent
 * plays by the same rules. `./README.md` shows how to add one of each.
 *
 * `start` replays the level from its first board in a headless world (tests, a CLI).
 * The running game's world (`../world.ts`) offers it only while the game screen has
 * installed its own restart (`setLiveStart`), so an agent's restart takes the same
 * level flow as the player's: seed, saved progress, analytics.
 */

import type { Schema } from '@adobe/data/schema';
import type { AgenticService } from '@adobe/data/service';
import { Database, Observe } from '~/core/systems/ecs';
import { type GameDatabase, gamePlugin } from '../sim/plugin';
import { readBoard } from '../sim/readBoard';
import { createAgentService } from './createAgentService';

const phaseSchema = {
  type: 'string',
  enum: ['idle', 'playing', 'won', 'lost'],
} as const satisfies Schema;

const boardSchema = {
  type: 'array',
  items: { type: 'array', items: { type: 'integer' } },
} as const satisfies Schema;

const tubeSchema = {
  type: 'object',
  required: ['tube'],
  properties: {
    tube: { type: 'integer', description: 'Tube index, 0-based.' },
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
  // Headless default: the current level from its first board, from any phase.
  let start: Start | null = () => db.transactions.replayLevel();
  const [canStart, setCanStart] = Observe.createState(true);
  liveStarts.set(db, (next) => {
    start = next;
    setCanStart(next !== null);
  });
  const playing = Observe.withMap(r.phase, (p) => p === 'playing');
  return createAgentService({
    role:
      'You are playing ball sort. `board` lists each tube bottom ball first (colour indices). ' +
      "Call `tapTube` ({ tube }) to lift a tube's top ball, then again on another tube to drop it " +
      '(legal onto an empty tube or the same colour with room). Sort every colour into its own tube. ' +
      '`undo` takes back a move (3 per level); `start` (re)starts the level: call it first when `phase` is `idle`, and to replay after `won` or when `stuck`.',
    states: {
      phase: {
        schema: phaseSchema,
        description: 'Current game phase',
        value: r.phase,
      },
      board: {
        schema: boardSchema,
        description: 'Tubes, bottom ball first',
        // `history` changes on every move, undo and rebuild: re-read the board then.
        value: Observe.withMap(r.history, () => readBoard(db)),
      },
      heldTube: {
        schema: { type: 'integer' },
        description: 'Tube whose top ball is lifted, or -1',
        value: r.heldTube,
      },
      moves: {
        schema: { type: 'integer' },
        description: 'Moves this level',
        value: r.moves,
      },
      undosLeft: {
        schema: { type: 'integer' },
        description: 'Undos left this level',
        value: r.undosLeft,
      },
      stuck: {
        schema: { type: 'boolean' },
        description: 'No legal move left: call start to retry',
        value: r.stuck,
      },
    },
    actions: {
      tapTube: {
        description:
          'Tap a tube: lift its top ball, or drop the lifted ball there',
        input: tubeSchema,
        when: playing,
        run: (p) => db.transactions.tapTube(p),
      },
      undo: {
        description: 'Take back the last move',
        when: playing,
        run: () => db.transactions.undo(),
      },
      // Offered in every phase (a fresh world is `idle` and a solved one `won`), while
      // there is a start: the running game withdraws it off the game screen.
      start: {
        description:
          'Start the current level from its first board (from any phase: also the retry when stuck; in the running game, the next level after a win)',
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
