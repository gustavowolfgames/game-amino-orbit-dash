/**
 * pointer — a tap on the canvas becomes a call into the world.
 *
 * A tap anywhere on the canvas, letterbox bars included, is converted to
 * design-space coordinates and handed to `onTap`. Nothing here decides what a
 * tap does: the controller passes a transaction (the template's `tap`), or a
 * real-time game queues an intent that a system drains next step
 * (`./README.md`). Input never writes state directly.
 */

import type { Application, Container, FederatedPointerEvent } from 'pixi.js';

/** A point in design space (the `root` container's coordinates). */
export interface DesignPoint {
  x: number;
  y: number;
}

/**
 * Listen for taps on the whole stage. `root` is the design-space container the
 * taps are measured in; `accepting` turns taps off while something else owns
 * the screen (the settings menu, pause). Returns the unbind function.
 */
export function bindTapInput(
  app: Application,
  root: Container,
  onTap: (point: DesignPoint) => void,
  accepting: () => boolean = () => true,
): () => void {
  const stage = app.stage;
  // `pointerdown`, not `pointertap`: a tap with the slightest drag, or a fast
  // double tap, drops a `pointertap`.
  const handle = (e: FederatedPointerEvent) => {
    if (!accepting()) return;
    const p = root.toLocal(e.global);
    onTap({ x: p.x, y: p.y });
  };
  stage.eventMode = 'static';
  stage.hitArea = app.screen;
  stage.on('pointerdown', handle);
  return () => {
    stage.off('pointerdown', handle);
  };
}
