/**
 * How the loading screen treats a failed load (src/game/screens/loadSteps.ts): an optional
 * step carries on, a required one retries and then stops the handoff.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { optional, required } from '~/game/screens/loadSteps';

const failing = (times: number, value = 'ok') => {
  let calls = 0;
  const run = vi.fn(async () => {
    calls++;
    if (calls <= times) throw new Error(`fail ${calls}`);
    return value;
  });
  return run;
};

describe('loadSteps', () => {
  afterEach(() => vi.restoreAllMocks());

  it('an optional step that fails is logged, and loading carries on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(optional('the splash', failing(1))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('a required step that fails once is retried and succeeds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = failing(1, 'loaded');
    await expect(required('the game art', run, 3, 0)).resolves.toBe('loaded');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a required step that fails every try throws, so the loader does not hand off', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = failing(5);
    await expect(required('the renderer', run, 3, 0)).rejects.toThrow('fail 3');
    expect(run).toHaveBeenCalledTimes(3);
  });
});
