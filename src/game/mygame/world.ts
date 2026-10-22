/**
 * world — the app-scoped ECS world (Phase 2: hoist the world to app scope).
 *
 * The ECS database is the single source of truth for game state. It must
 * outlive any one screen: the game screen writes the final score, then unmounts,
 * and the results screen reads that score straight from ECS. A per-screen world
 * (created in the controller, destroyed on unmount) can't do that — which is why
 * the old signals "clipboard" existed. Holding the world here removes the need
 * for a second copy.
 *
 * This module owns the world's lifetime and the Inspector binding
 * (`setActiveDb`). Controllers and screens read the world; they do not create or
 * destroy it. Headless tests still call `createGameWorld()` directly for an
 * isolated world — this holder is for the running app.
 *
 * The running world carries the agent service (`./agent/agentPlugin.ts`), so a
 * bot or MCP client can read states and call actions on the live game with
 * `getGameWorld().services.agent.execute(action, input)`.
 */

import { setActiveDb } from '~/core/systems/ecs';
import { createGameAgentWorld, type GameAgentDatabase } from './agent/agentPlugin';

let world: GameAgentDatabase | null = null;

/** The app-scoped world, created (and bound to the Inspector) on first use. */
export function getGameWorld(): GameAgentDatabase {
  if (!world) {
    world = createGameAgentWorld();
    setActiveDb(world); // dev Inspector (backtick) shows this world
  }
  return world;
}

/** Release the world — full app teardown only, not per-screen unmount. */
export function disposeGameWorld(): void {
  setActiveDb(null);
  world = null;
}
