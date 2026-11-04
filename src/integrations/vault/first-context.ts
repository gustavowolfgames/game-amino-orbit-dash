/**
 * The Vault's first `context`, heard before the runtime starts.
 *
 * `<VaultHostBridge>` holds `startVaultRuntime` (and with it `ready`) until the first
 * non-`loading` screen, but boot needs the selection *during* `loading` — otherwise a Vault
 * launch plays the bundled pack first and swaps later. This module listens passively
 * (`onHostMessage('context')`: no `ready`, nothing sent), so the
 * protocol order is untouched: the Vault still re-sends `context` on `ready`, and the
 * bridge's `onContext` still sees it.
 *
 * The Vault sends its first `context` on the iframe `load`, so the listener is armed when
 * this module is evaluated — it sits in the app's static import graph, ahead of `load`.
 *
 *   inVault()                        are we in a Vault (re-exported from the SDK)
 *   firstVaultContext()              the first context heard, or null (sync snapshot)
 *   awaitFirstVaultContext(ms)       that context, waiting at most `ms`; null on timeout
 *                                    and immediately outside a Vault
 *
 * Context is unauthenticated: select content with it, never gate entitlement on it.
 */
import {
  inVault,
  onHostMessage,
  type VaultGameContext,
} from '@wolfgames/client';

let first: VaultGameContext | null = null;
let armed = false;
const waiters = new Set<(context: VaultGameContext) => void>();

/**
 * Start listening for the first `context`. Idempotent; a no-op outside a Vault. Called on
 * module load, so a caller only needs it after a test reset.
 */
export function watchFirstVaultContext(): void {
  if (armed || !inVault()) return;
  armed = true;
  let off: (() => void) | null = null;
  off = onHostMessage('context', ({ context }) => {
    if (first !== null) return;
    first = context;
    off?.();
    for (const resolve of waiters) resolve(context);
    waiters.clear();
  });
}

/** The first Vault context heard this page, or null (not yet, or not in a Vault). */
export function firstVaultContext(): VaultGameContext | null {
  return first;
}

/**
 * The first Vault context, waiting at most `timeoutMs` for it. Resolves null at once outside
 * a Vault, and null on timeout (the caller falls back; a later context still reaches the
 * bridge's `onContext`). Never rejects.
 */
export function awaitFirstVaultContext(
  timeoutMs: number,
): Promise<VaultGameContext | null> {
  if (!inVault()) return Promise.resolve(null);
  watchFirstVaultContext();
  if (first !== null) return Promise.resolve(first);
  return new Promise((resolve) => {
    const onContext = (context: VaultGameContext) => {
      clearTimeout(timer);
      resolve(context);
    };
    const timer = setTimeout(() => {
      waiters.delete(onContext);
      resolve(null);
    }, timeoutMs);
    waiters.add(onContext);
  });
}

/** Test seam: forget the heard context and the listener. */
export function resetFirstVaultContextForTests(): void {
  first = null;
  armed = false;
  waiters.clear();
}

watchFirstVaultContext();
