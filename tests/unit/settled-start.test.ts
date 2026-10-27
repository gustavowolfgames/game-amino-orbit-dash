/**
 * The end card's Next and an agent's `start` wait for a loading Vault edition
 * (src/game/mygame/screens/settledStart.ts). A run started while they wait wins: the waiting
 * start must not reset it when the load settles.
 */
import { describe, expect, it } from 'vitest';
import { createSettledStart } from '~/game/mygame/screens/settledStart';

function setup() {
  let settle = () => {};
  const settled = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const state = { runs: 0, alive: true };
  const startNext = createSettledStart({
    settled: () => settled,
    runsStarted: () => state.runs,
    alive: () => state.alive,
    start: () => state.runs++,
  });
  return { state, startNext, settle };
}

describe('createSettledStart', () => {
  it('starts the run once the content has settled', async () => {
    const { state, startNext, settle } = setup();
    const call = startNext();
    await Promise.resolve();
    expect(state.runs).toBe(0); // still loading
    settle();
    await call;
    expect(state.runs).toBe(1);
  });

  it('a restart while it waits (the Inspector, an agent) wins: the wait does not reset it', async () => {
    const { state, startNext, settle } = setup();
    const call = startNext();
    state.runs++; // the Inspector's restart, during the load
    settle();
    await call;
    expect(state.runs).toBe(1);
  });

  it('Next and an agent start waiting together start one run', async () => {
    const { state, startNext, settle } = setup();
    const both = Promise.all([startNext(), startNext()]);
    settle();
    await both;
    expect(state.runs).toBe(1);
  });

  it('starts nothing once the controller is torn down', async () => {
    const { state, startNext, settle } = setup();
    const call = startNext();
    state.alive = false;
    settle();
    await call;
    expect(state.runs).toBe(0);
  });
});
