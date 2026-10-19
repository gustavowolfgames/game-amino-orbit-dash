import type { Application } from 'pixi.js';

declare global {
  var __PIXI_APP__: Application | undefined;
}

/** VITE_APP_ENV slugs (as read by parseEnvironment) where the hook is on. */
const NON_PRODUCTION_ENVS = new Set(['local', 'dev', 'qa', 'staging']);

/**
 * On under the Vite dev server, and in builds whose VITE_APP_ENV is a known
 * non-production slug. Fails closed: parseEnvironment() maps a missing or
 * misspelled value to Local, so match the raw value instead.
 */
const ENABLED =
  import.meta.env.DEV ||
  NON_PRODUCTION_ENVS.has(
    String(import.meta.env.VITE_APP_ENV ?? '').toLowerCase(),
  );

/**
 * Expose the live Pixi app as `globalThis.__PIXI_APP__` so the PixiJS DevTools
 * extension (and browser test tooling) can find the scene graph. Call after
 * `await app.init()` so tools never see an app without a renderer. Each screen
 * owns its own Application, so the most recently exposed one wins.
 *
 * Returns a release fn for the screen's destroy path; it only clears the
 * global if this app still holds it.
 */
export function exposePixiApp(app: Application): () => void {
  if (!ENABLED) return () => {};
  globalThis.__PIXI_APP__ = app;
  return () => {
    if (globalThis.__PIXI_APP__ === app) globalThis.__PIXI_APP__ = undefined;
  };
}
