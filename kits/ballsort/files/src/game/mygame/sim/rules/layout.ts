/**
 * layout — where each tube sits in the design box.
 *
 * Pure, so the tap system (hit testing) and the renderer (drawing) agree on the
 * same rectangles. Up to six tubes share one row; more split into two rows.
 */

import { DESIGN_W } from '../../config';
import { TUBE_CAPACITY } from './ballSort';

export const BALL_RADIUS = 34;
/** Vertical distance between stacked balls. */
export const BALL_STEP = 76;
export const TUBE_W = 96;
export const TUBE_H = TUBE_CAPACITY * BALL_STEP + 28;
/** How far above its tube a lifted ball floats. */
export const LIFT_Y = 64;

const BOARD_TOP = 330;
const ROW_GAP = 150;

export interface TubeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Top-left corner and size of each tube, in tube order. */
export function tubeRects(count: number): TubeRect[] {
  const perRow = count <= 6 ? count : Math.ceil(count / 2);
  const rects: TubeRect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = i - row * perRow;
    const spacing = Math.min(150, (DESIGN_W - 40) / inRow);
    const x0 = DESIGN_W / 2 - (spacing * (inRow - 1)) / 2;
    rects.push({
      x: x0 + col * spacing - TUBE_W / 2,
      y: BOARD_TOP + row * (TUBE_H + ROW_GAP),
      w: TUBE_W,
      h: TUBE_H,
    });
  }
  return rects;
}

/** Centre of the ball at `slot` in a tube (slot 0 at the bottom). */
export function ballPosition(rect: TubeRect, slot: number) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h - 14 - BALL_STEP / 2 - slot * BALL_STEP,
  };
}

/** Where a lifted ball floats above its tube. */
export function liftPosition(rect: TubeRect) {
  return { x: rect.x + rect.w / 2, y: rect.y - LIFT_Y };
}

/** The tube under a design-space point (with a generous margin), or -1. */
export function tubeAt(x: number, y: number, count: number): number {
  const pad = 20;
  return tubeRects(count).findIndex(
    (r) =>
      x >= r.x - pad &&
      x <= r.x + r.w + pad &&
      y >= r.y - LIFT_Y - BALL_RADIUS &&
      y <= r.y + r.h + pad,
  );
}
