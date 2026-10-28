/**
 * devLinks — the URL shortcuts a developer or a QA tester types, off for players.
 *
 *   ?screen=results  loading → the game screen with the end card already up: a won level, the
 *                    run's own level, its goal as the score (`resultsPreview` in
 *                    src/game/mygame/screens/endOfPlay.ts). Records nothing.
 *   ?unlock=all      each save's `onUnlockAll` hook runs once at boot (./unlock.ts).
 *
 * `?screen=game` is not one of these: it predates them, playable units and the e2e suite use
 * it, and it shows nothing a player could not reach (src/game/screens/skipStartScreen.ts).
 *
 * On under the Vite dev server, and in builds whose VITE_APP_ENV is `local`, `dev` or `qa`.
 * Fails closed like src/core/dev/pixiDevtools.ts: a missing or misspelled env is off.
 * The URL is read here, in a DOM shell folder, so the controller never touches `window`.
 */

/** VITE_APP_ENV slugs where the shortcuts work (staging and production are player builds). */
const DEV_ENVS = new Set(['local', 'dev', 'qa']);

/** The two `import.meta.env` fields the gate reads. */
export interface DevEnv {
  DEV?: boolean;
  VITE_APP_ENV?: string;
}

/** Whether the dev/QA shortcuts work in this build. */
export function devLinksOn(env: DevEnv = import.meta.env): boolean {
  return (
    env.DEV === true ||
    DEV_ENVS.has(String(env.VITE_APP_ENV ?? '').toLowerCase())
  );
}

const currentSearch = () =>
  typeof window === 'undefined' ? '' : window.location.search;

/** `?screen=results`, in a build where the shortcuts work. */
export function opensResults(
  search: string = currentSearch(),
  on: boolean = devLinksOn(),
): boolean {
  return on && new URLSearchParams(search).get('screen') === 'results';
}

/** `?unlock=all`, in a build where the shortcuts work. */
export function asksUnlockAll(
  search: string = currentSearch(),
  on: boolean = devLinksOn(),
): boolean {
  return on && new URLSearchParams(search).get('unlock') === 'all';
}
