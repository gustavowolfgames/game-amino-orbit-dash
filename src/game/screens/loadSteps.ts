/**
 * loadSteps — how the loading screen treats a failed load (LoadingScreen.tsx).
 *
 *   optional   art the next screen can do without (splash, theme, audio): a failure is
 *              logged and loading carries on.
 *   required   what the next screen cannot start without (the renderer, its art, its code):
 *              retried a few times (a dropped request), then it throws, and the loader does
 *              not hand off. Handing off without it leaves a screen that cannot start.
 */

import gsap from 'gsap';

/** Attempts at a required step before the loader gives up on it. */
export const REQUIRED_TRIES = 3;
/** Seconds before retry n (n × this): 1 s, then 2 s. */
export const RETRY_DELAY_SEC = 1;

const wait = (sec: number) =>
  new Promise<void>((resolve) => {
    gsap.delayedCall(sec, resolve);
  });

/** Run a step the next screen can do without; log a failure and carry on. */
export async function optional(
  what: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.warn(`Loading ${what} failed; continuing without it:`, err);
  }
}

/** Run a step the next screen needs, retrying; throws once it has failed every attempt. */
export async function required<T>(
  what: string,
  run: () => Promise<T>,
  tries = REQUIRED_TRIES,
  delaySec = RETRY_DELAY_SEC,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt >= tries) throw err;
      console.warn(`Loading ${what} failed (try ${attempt}/${tries}):`, err);
      await wait(delaySec * attempt);
    }
  }
}
