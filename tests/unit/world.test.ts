/**
 * The app-scoped world (src/game/mygame/world.ts) is the one the running game
 * plays in. It carries the agent service, so a bot or MCP client can drive the
 * live game by the same transactions as the player.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setLiveStart } from '~/game/mygame/agent/agentPlugin';
import { disposeGameWorld, getGameWorld } from '~/game/mygame/world';

afterEach(() => disposeGameWorld());

describe('getGameWorld', () => {
  it('is one world until disposed', () => {
    const a = getGameWorld();
    expect(getGameWorld()).toBe(a);
    disposeGameWorld();
    expect(getGameWorld()).not.toBe(a);
  });

  it('has the agent service; `start` runs the game screen restart, only while one is installed', async () => {
    const db = getGameWorld();
    expect(db.services.agent).toBeDefined();
    const refused = await db.services.agent.execute('start', {});
    expect(refused).toBeTruthy(); // no game screen: an ActionError, nothing started
    expect(db.resources.phase).toBe('idle');

    const starts: number[] = [];
    setLiveStart(db, () => starts.push(1)); // what the controller does on init
    await db.services.agent.execute('start', {});
    expect(starts).toEqual([1]);

    setLiveStart(db, null); // the controller's destroy
    expect(await db.services.agent.execute('start', {})).toBeTruthy();
    expect(starts).toEqual([1]);
  });

  it('`start` completes only after an async restart does (a new Vault edition loading)', async () => {
    const db = getGameWorld();
    let settle = () => {};
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const starts: string[] = [];
    setLiveStart(db, async () => {
      await settled; // the controller awaits whenContentSettled()
      starts.push('run');
    });

    let done = false;
    const call = db.services.agent.execute('start', {}).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false); // still waiting on the content
    expect(starts).toEqual([]);

    settle();
    await call;
    expect(starts).toEqual(['run']);
  });
});
