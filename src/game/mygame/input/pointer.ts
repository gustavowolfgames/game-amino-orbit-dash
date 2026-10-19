/**
 * pointer — taps become intents in ECS (input as intent).
 *
 * A tap anywhere on the canvas, letterbox bars included, is converted to
 * design-space coordinates and queued with `submitTap`. Nothing here decides
 * what a tap does: a system drains `pendingTaps` on the next fixed step, so input
 * stays on the deterministic timeline and a headless test can queue the same
 * taps. Other inputs (swipe, drag, keys) follow the same shape; see `./README.md`.
 */

import type { Application, Container, FederatedPointerEvent } from 'pixi.js';
import type { GameDatabase } from '../sim/plugin';

/**
 * Listen for taps on the whole stage and queue them while a run is live.
 * `root` is the design-space container the taps are measured in; `accepting`
 * turns taps off while something else owns the screen (the settings menu).
 * Returns the unbind function.
 */
export function bindTapInput(
  app: Application,
  root: Container,
  db: GameDatabase,
  accepting: () => boolean = () => true,
): () => void {
  const stage = app.stage;
  // `pointerdown`, not `pointertap`: a tap with the slightest drag, or a fast
  // double tap, drops a `pointertap`.
  const onTap = (e: FederatedPointerEvent) => {
    if (db.resources.phase !== 'playing' || !accepting()) return;
    const p = root.toLocal(e.global);
    db.transactions.submitTap({ x: p.x, y: p.y });
  };
  stage.eventMode = 'static';
  stage.hitArea = app.screen;
  stage.on('pointerdown', onTap);
  return () => {
    stage.off('pointerdown', onTap);
  };
}
