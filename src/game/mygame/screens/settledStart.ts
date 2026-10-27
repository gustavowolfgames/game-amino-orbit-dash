/**
 * settledStart — start the next run once any new content has loaded.
 *
 * The end card's primary action and an agent's `start` both wait for a Vault edition that is
 * still loading, so the run starts there. A run started while one waits (the Inspector's
 * restart, the other of the two) wins: the waiting start is dropped rather than resetting the
 * run that is now in play.
 */

export interface SettledStartOptions {
  /** Resolves once the latest content load has settled (`whenContentSettled`). */
  settled: () => Promise<void>;
  /** How many runs have started so far; the controller's `startRun` bumps it. */
  runsStarted: () => number;
  /** False once the controller is torn down. */
  alive: () => boolean;
  /** Start the run (the controller restyles, then calls `startRun`). */
  start: () => void;
}

export function createSettledStart(
  options: SettledStartOptions,
): () => Promise<void> {
  return async () => {
    const before = options.runsStarted();
    await options.settled();
    if (options.alive() && options.runsStarted() === before) options.start();
  };
}
