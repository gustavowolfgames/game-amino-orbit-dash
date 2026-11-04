/**
 * The dev/QA URL shortcuts (src/game/setup/devLinks.ts) and the `?unlock=all` hook registry
 * (src/game/setup/unlock.ts): on in dev and QA builds, off for players.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { asksUnlockAll, devLinksOn, opensResults } from '~/game/setup/devLinks';

describe('devLinksOn', () => {
  it('is on under the dev server and in local, dev and QA builds', () => {
    expect(devLinksOn({ DEV: true })).toBe(true);
    for (const env of ['local', 'dev', 'qa', 'QA'])
      expect(devLinksOn({ DEV: false, VITE_APP_ENV: env })).toBe(true);
  });

  it('is off in staging, production, and a missing or misspelled env', () => {
    for (const env of ['staging', 'production', 'prod', '', 'qaa', undefined])
      expect(devLinksOn({ DEV: false, VITE_APP_ENV: env })).toBe(false);
  });
});

describe('opensResults / asksUnlockAll', () => {
  it('read their own value, only when the shortcuts are on', () => {
    expect(opensResults('?screen=results', true)).toBe(true);
    expect(opensResults('?screen=results', false)).toBe(false);
    expect(opensResults('?screen=game', true)).toBe(false);
    expect(asksUnlockAll('?unlock=all&screen=game', true)).toBe(true);
    expect(asksUnlockAll('?unlock=all', false)).toBe(false);
    expect(asksUnlockAll('?unlock=1', true)).toBe(false);
  });
});

describe('onUnlockAll', () => {
  afterEach(() => vi.restoreAllMocks());

  it('runs every hook in order, replaces a re-registered name, and skips one that throws', async () => {
    vi.resetModules();
    const { onUnlockAll, unlockAll } = await import('~/game/setup/unlock');
    const calls: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    onUnlockAll('coins', () => calls.push('coins v1'));
    onUnlockAll('broken', () => {
      throw new Error('no');
    });
    onUnlockAll('colony', () => calls.push('colony'));
    onUnlockAll('coins', () => calls.push('coins v2')); // a hot reload
    expect(unlockAll()).toEqual(['coins', 'colony']);
    expect(calls).toEqual(['coins v2', 'colony']);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('a remover takes its own hook out, not a newer one under the same name', async () => {
    vi.resetModules();
    const { onUnlockAll, unlockAll } = await import('~/game/setup/unlock');
    const off = onUnlockAll('coins', () => {});
    off();
    expect(unlockAll()).toEqual([]);
    const stale = onUnlockAll('coins', () => {});
    onUnlockAll('coins', () => {});
    stale();
    expect(unlockAll()).toEqual(['coins']);
  });
});
