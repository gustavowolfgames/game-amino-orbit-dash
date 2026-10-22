/**
 * config — constants every part of the game agrees on.
 *
 * Pure module: no Pixi, no DOM. Game rules and tuning go in `sim/rules/`;
 * per-level numbers come from the Content Pack (`src/game/content`).
 *
 * The coordinate space is `DESIGN_CANVAS` (390×844) from
 * `@wolfgames/components/core`, the canvas the title screen and the play screen
 * both lay out on. The sim and the views read it from there; do not redeclare it.
 */

/** Seed for a level that names none (deterministic sim: no Math.random). */
export const DEFAULT_SEED = 0x9e3779b1;

/**
 * How a run ends. `'pixi'`: a win / lose card drawn over the board, in the game's own
 * scene, with confetti on a win (`render/endScreen.ts`). `'dom'`: a hop to the separate
 * DOM results screen (`src/game/screens/ResultsScreen.tsx`). In a Vault, a finished
 * pack hands the player to the Vault's own end screen either way.
 */
export const END_SCREEN: 'pixi' | 'dom' = 'pixi';
