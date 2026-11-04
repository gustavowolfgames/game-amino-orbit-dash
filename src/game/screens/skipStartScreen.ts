/**
 * Start-screen skip: loading routes straight to the game when a skip source is active. DOM-free
 * so the precedence is unit-testable; `LoadingScreen` supplies the signals.
 *
 * Precedence (the first that holds wins, and is what `start_screen_skipped.skip_source` reports):
 *
 *   vault      `inVault()` — the Vault shows its own title surface around the game
 *   config     `gameConfig.skipStartScreen`
 *   dev_mode   Tweakpane `devMode.skipStartScreen`
 *   url_param  `?screen=game`, or `?screen=results` in a dev/QA build (src/game/setup/devLinks.ts:
 *              the game screen opens with its end card up)
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
  /** `devLinksOn()`: `?screen=results` skips too. */
  devLinks?: boolean;
}

/** The first active source in precedence order, or null to show the start screen. */
export function resolveSkipSource(signals: SkipSignals): SkipSource | null {
  if (signals.inVault) return 'vault';
  if (signals.configSkip) return 'config';
  if (signals.devModeSkip) return 'dev_mode';
  const screen = new URLSearchParams(signals.search).get('screen');
  if (screen === 'game' || (screen === 'results' && signals.devLinks))
    return 'url_param';
  return null;
}

/**
 * Whether the loader plays the WolfGames intro. The developer shortcuts (`?screen=`, the
 * Tweakpane toggle) go straight to the game as soon as it has loaded; players get the intro,
 * revealing into the title or, with the title skipped (the Vault, a game's config), the game.
 */
export function playsIntro(source: SkipSource | null): boolean {
  return source !== 'url_param' && source !== 'dev_mode';
}
