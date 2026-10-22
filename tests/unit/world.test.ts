/**
 * The app-scoped world (src/game/mygame/world.ts) is the one the running game
 * plays in. It carries the agent service, so a bot or MCP client can drive the
 * live game by the same transactions as the player.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { disposeGameWorld, getGameWorld } from '~/game/mygame/world';

afterEach(() => disposeGameWorld());

describe('getGameWorld', () => {
  it('is one world until disposed', () => {
    const a = getGameWorld();
    expect(getGameWorld()).toBe(a);
    disposeGameWorld();
    expect(getGameWorld()).not.toBe(a);
  });

  it('has the agent service, and its actions play the live world', async () => {
    const db = getGameWorld();
    expect(db.services.agent).toBeDefined();
    await db.services.agent.execute('start', {});
    expect(db.resources.phase).toBe('playing');
  });
});
