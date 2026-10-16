/**
 * The first-context listener (src/integrations/vault/first-context.ts): it hears the Vault's
 * first `context` passively, resolves a waiting boot with it, gives up (null) after the budget,
 * and never waits — or subscribes — outside a Vault.
 */

import type { VaultGameContext } from '@wolfgames/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  inVault: false,
  handler: null as ((payload: { context: VaultGameContext }) => void) | null,
  onHostMessage: vi.fn(),
  off: vi.fn(),
}));

vi.mock('@wolfgames/client', () => ({
  inVault: () => host.inVault,
  onHostMessage: host.onHostMessage,
}));

const context = (contentId: string): VaultGameContext =>
  ({
    gameSessionId: 's',
    host: { partnerId: 'p', vaultId: 'v' },
    content: { type: 'content', contentId },
  }) as VaultGameContext;

/** A fresh module, as on a page load (the listener arms on import). */
async function load() {
  vi.resetModules();
  return import('~/integrations/vault/first-context');
}

beforeEach(() => {
  host.inVault = true;
  host.handler = null;
  host.onHostMessage
    .mockReset()
    .mockImplementation((_type: string, handler: typeof host.handler) => {
      host.handler = handler;
      return host.off;
    });
  host.off.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('first Vault context', () => {
  it('listens for `context` on import, inside a Vault', async () => {
    await load();
    expect(host.onHostMessage).toHaveBeenCalledTimes(1);
    expect(host.onHostMessage).toHaveBeenCalledWith(
      'context',
      expect.any(Function),
    );
  });

  it('resolves a waiting boot with the first context, and keeps it', async () => {
    const m = await load();
    const waiting = m.awaitFirstVaultContext(3000);
    host.handler?.({ context: context('ed-1') });
    await expect(waiting).resolves.toEqual(context('ed-1'));
    expect(m.firstVaultContext()).toEqual(context('ed-1'));
    expect(host.off).toHaveBeenCalled();
    // Later contexts are the bridge's business, not the first.
    host.handler?.({ context: context('ed-2') });
    expect(m.firstVaultContext()).toEqual(context('ed-1'));
  });

  it('resolves at once with a context heard before the wait', async () => {
    const m = await load();
    host.handler?.({ context: context('early') });
    await expect(m.awaitFirstVaultContext(3000)).resolves.toEqual(
      context('early'),
    );
  });

  it('times out to null when the host stays silent', async () => {
    vi.useFakeTimers();
    const m = await load();
    const waiting = m.awaitFirstVaultContext(3000);
    vi.advanceTimersByTime(2999);
    let settled = false;
    void waiting.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    vi.advanceTimersByTime(1);
    await expect(waiting).resolves.toBeNull();
  });

  it('does not wait or subscribe outside a Vault', async () => {
    host.inVault = false;
    vi.useFakeTimers();
    const m = await load();
    await expect(m.awaitFirstVaultContext(3000)).resolves.toBeNull();
    expect(host.onHostMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(m.firstVaultContext()).toBeNull();
  });
});
