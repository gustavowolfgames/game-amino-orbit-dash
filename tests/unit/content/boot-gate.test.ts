/**
 * The first-context gate (`loadBootContent` in src/game/setup/content.ts): inside a Vault the
 * boot waits for the host's first context and loads that selection — never the bundled pack
 * first; on timeout it boots as before and logs once; outside a Vault it does not wait.
 */

import type { VaultGameContext } from '@wolfgames/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KitLike } from '~/game/content';

const seams = vi.hoisted(() => ({
  inVault: true,
  awaitFirstVaultContext: vi.fn(),
  loadActivePack: vi.fn(),
  loadBrand: vi.fn(),
}));

vi.mock('~/integrations/vault', () => ({
  inVault: () => seams.inVault,
  awaitFirstVaultContext: seams.awaitFirstVaultContext,
}));

vi.mock('~/game/content', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/game/content')>()),
  loadActivePack: seams.loadActivePack,
}));

vi.mock('~/game/brand', () => ({ loadBrand: seams.loadBrand }));

const kit = {} as KitLike;

const contextFor = (content: VaultGameContext['content']): VaultGameContext =>
  ({
    gameSessionId: 's',
    host: { partnerId: 'p', vaultId: 'v' },
    content,
  }) as VaultGameContext;

async function load() {
  vi.resetModules();
  return import('~/game/setup/content');
}

beforeEach(() => {
  seams.inVault = true;
  seams.awaitFirstVaultContext.mockReset();
  seams.loadActivePack.mockReset().mockResolvedValue(null);
  seams.loadBrand.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadBootContent', () => {
  it('in a Vault, waits for the first context and loads its selection', async () => {
    seams.awaitFirstVaultContext.mockResolvedValue(
      contextFor({ type: 'content', contentId: 'ed-1' }),
    );
    const m = await load();
    await m.loadBootContent(kit);
    expect(seams.awaitFirstVaultContext).toHaveBeenCalledWith(
      m.VAULT_CONTEXT_WAIT_MS,
    );
    expect(seams.loadActivePack).toHaveBeenCalledTimes(1);
    expect(seams.loadActivePack).toHaveBeenCalledWith(kit, 'ed-1', 'ed-1');
    expect(seams.loadBrand).toHaveBeenCalledWith(kit, 'ed-1');
    expect(m.getBootSelection()).toBe('ed-1');
  });

  it('the unlocked_editions signal boots the default pack, not a pack of that name', async () => {
    seams.awaitFirstVaultContext.mockResolvedValue(
      contextFor({ type: 'content', contentId: 'unlocked_editions' }),
    );
    const m = await load();
    await m.loadBootContent(kit);
    expect(seams.loadActivePack).toHaveBeenCalledWith(kit, 'default', null);
    expect(m.getBootSelection()).toBeNull();
  });

  it('does not fetch any pack before the first context arrives', async () => {
    let deliver!: (context: VaultGameContext | null) => void;
    seams.awaitFirstVaultContext.mockReturnValue(
      new Promise((resolve) => (deliver = resolve)),
    );
    const m = await load();
    const boot = m.loadBootContent(kit);
    await Promise.resolve();
    expect(seams.loadActivePack).not.toHaveBeenCalled();
    deliver(contextFor({ type: 'content', contentId: 'ed-2' }));
    await boot;
    expect(seams.loadActivePack).toHaveBeenCalledWith(kit, 'ed-2', 'ed-2');
  });

  it('a `default` context boots the default pack', async () => {
    seams.awaitFirstVaultContext.mockResolvedValue(
      contextFor({ type: 'default' }),
    );
    const m = await load();
    await m.loadBootContent(kit);
    expect(seams.loadActivePack).toHaveBeenCalledWith(kit, 'default', null);
    expect(m.getBootSelection()).toBeNull();
  });

  it('on timeout, falls back to the default pack and logs once', async () => {
    seams.awaitFirstVaultContext.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = await load();
    await m.loadBootContent(kit);
    await m.loadBootContent(kit);
    expect(seams.loadActivePack).toHaveBeenCalledWith(kit, 'default', null);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(m.getBootSelection()).toBeNull();
  });

  it('outside a Vault, does not wait for a context', async () => {
    seams.inVault = false;
    const m = await load();
    await m.loadBootContent(kit);
    expect(seams.awaitFirstVaultContext).not.toHaveBeenCalled();
    expect(seams.loadActivePack).toHaveBeenCalledWith(kit, 'default', null);
  });
});
