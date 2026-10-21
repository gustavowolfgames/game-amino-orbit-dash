/**
 * pointer — a tap on the canvas becomes a call into the world.
 *
 * A tap anywhere on the canvas, letterbox bars included, is converted to
 * design-space coordinates (DESIGN_CANVAS, 390×844) through the `DesignLayer`'s
 * own frame and handed to `onTap`. A tap in a letterbox band maps outside
 * 0..390 / 0..844; the sim decides what that means. Nothing here decides what a
 * tap does: the controller passes a transaction (the template's `tap`), or a
 * real-time game queues an intent that a system drains next step
 * (`./README.md`). Input never writes state directly.
 */

import type { DesignLayer } from '@wolfgames/components/pixi';
import type { Application, FederatedPointerEvent } from 'pixi.js';

/** A point in design space (the `root` layer's coordinates, DESIGN_CANVAS px). */
export interface DesignPoint {
  x: number;
  y: number;
}

/**
 * Listen for taps on the whole stage. `root` is the design layer the taps are
 * measured in; `accepting` turns taps off while something else owns
 * the screen (the settings menu, pause). Returns the unbind function.
 */
export function bindTapInput(
  app: Application,
  root: DesignLayer,
  onTap: (point: DesignPoint) => void,
  accepting: () => boolean = () => true,
): () => void {
  const stage = app.stage;
  // `pointerdown`, not `pointertap`: a tap with the slightest drag, or a fast
  // double tap, drops a `pointertap`.
  const handle = (e: FederatedPointerEvent) => {
    if (!accepting()) return;
    // The layer's frame, the same one trackHostBox applied to its transform.
    const p = root.toDesign(e.global.x, e.global.y);
    onTap({ x: p.x, y: p.y });
  };
  stage.eventMode = 'static';
  stage.hitArea = app.screen;
  stage.on('pointerdown', handle);
  return () => {
    stage.off('pointerdown', handle);
  };
}
