/**
 * Start-screen skip: loading routes straight to the game when a skip source is active. DOM-free
 * so the precedence is unit-testable; `LoadingScreen` supplies the signals.
 *
 * Precedence (the first that holds wins, and is what `start_screen_skipped.skip_source` reports):
 *
 *   vault      `inVault()` — the Vault shows its own title surface around the game
 *   config     `gameConfig.skipStartScreen`
 *   dev_mode   Tweakpane `devMode.skipStartScreen`
 *   url_param  `?screen=game`
 *
 * Ported from game-amino-sort's `skipStartScreen.ts`; its `vault_override` and `preview` sources
 * belong to features this template does not ship (a DEV `?vault=` stand-in, Stack Builder preview).
 */

/** Why the start screen was skipped. */
export type SkipSource = 'vault' | 'config' | 'dev_mode' | 'url_param';

export interface SkipSignals {
  /** `inVault()`. */
  inVault: boolean;
  /** `gameConfig.skipStartScreen`. */
  configSkip: boolean;
  /** Tweakpane `devMode.skipStartScreen`. */
  devModeSkip: boolean;
  /** `window.location.search`; `?screen=game` skips. */
  search: string;
}

/** The first active source in precedence order, or null to show the start screen. */
export function resolveSkipSource(signals: SkipSignals): SkipSource | null {
  if (signals.inVault) return 'vault';
  if (signals.configSkip) return 'config';
  if (signals.devModeSkip) return 'dev_mode';
  if (new URLSearchParams(signals.search).get('screen') === 'game')
    return 'url_param';
  return null;
}
