/**
 * createAgentService — a game's states and actions as an `AgenticService`
 * (@adobe/data/service), from one short declaration.
 *
 * Game-agnostic: `./agentPlugin.ts` declares what this game shows and lets an
 * agent do, and this builds the service. Any agent runtime (MCP, an LLM loop,
 * a bot, a test) reads `states` and calls `execute(action, input)`.
 *
 *   createAgentService({
 *     role: 'You are playing …',
 *     states: {
 *       score: { schema: { type: 'integer' }, description: 'Points', value: db.observe.resources.score },
 *     },
 *     actions: {
 *       tap: { description: 'Tap at (x, y)', input: pointSchema, when: canTap, run: (p) => db.transactions.tap(p) },
 *       start: { description: 'Restart the level', run: () => restart() },
 *     },
 *   });
 *
 * - `role` becomes a constant `role` state (the agent's brief).
 * - A state's `value` is an Observe whose type matches its `schema`. A state
 *   that can be empty uses `Schema.Nullable(schema)`: a bare `nullable: true`
 *   is silently ignored.
 * - An action takes at most one input object (`input` schema). With no `input`,
 *   it takes `{}`. `when` offers it only while the Observe is true; outside
 *   that, `execute` returns an ActionError.
 */

import type { Schema } from '@adobe/data/schema';
import { AgenticService } from '@adobe/data/service';
import { Observe } from '~/core/systems/ecs';

/** A value the agent can read. */
export interface AgentState<S extends Schema> {
  schema: S;
  description: string;
  value: Observe<Schema.ToType<S>>;
}

/** Something the agent can do. `run`'s argument is `input` decoded. */
export interface AgentAction<P> {
  description: string;
  input?: P;
  /** Offer the action only while this is true. */
  when?: Observe<boolean>;
  run: P extends Schema
    ? (input: Schema.ToType<P>) => void | Promise<void>
    : () => void | Promise<void>;
}

export interface AgentSpec<
  S extends Record<string, Schema>,
  P extends Record<string, unknown>,
> {
  /** What the game is and how to win, in a few sentences. */
  role: string;
  states: { [K in keyof S]: AgentState<S[K]> };
  actions: { [K in keyof P]: AgentAction<P[K]> };
}

/** The input schema of an action that takes none. */
const NO_INPUT = { type: 'object', properties: {} } as const satisfies Schema;

type CreateConfig = Parameters<typeof AgenticService.create>[0];

export function createAgentService<
  const S extends Record<string, Schema>,
  const P extends Record<string, unknown>,
>(spec: AgentSpec<S, P>): AgenticService {
  const declarations: CreateConfig['interface'] = {
    role: {
      type: 'state',
      schema: { type: 'string' },
      description: 'Role and objective',
    },
  };
  const implementation: Record<string, unknown> = {
    role: Observe.fromConstant(spec.role),
  };
  const conditional: Record<string, Observe<boolean>> = {};

  for (const [key, state] of Object.entries<AgentState<Schema>>(
    spec.states as Record<string, AgentState<Schema>>,
  )) {
    declarations[key] = {
      type: 'state',
      schema: state.schema,
      description: state.description,
    };
    implementation[key] = state.value;
  }

  for (const [key, action] of Object.entries<AgentAction<unknown>>(
    spec.actions as Record<string, AgentAction<unknown>>,
  )) {
    declarations[key] = {
      type: 'action',
      description: action.description,
      parameters: [(action.input as Schema | undefined) ?? NO_INPUT],
    };
    const run = action.run as (input: unknown) => void | Promise<void>;
    implementation[key] = async (input: unknown) => {
      await run(input);
    };
    if (action.when) conditional[key] = action.when;
  }

  return AgenticService.create({
    interface: declarations,
    implementation: implementation as CreateConfig['implementation'],
    conditional,
  });
}
