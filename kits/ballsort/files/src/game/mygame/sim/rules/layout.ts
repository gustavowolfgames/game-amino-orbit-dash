/**
 * layout — where each tube sits on the design canvas (DESIGN_CANVAS, 390×844).
 *
 * Pure, so the tap transaction (hit testing), the keyboard cursor and the
 * renderer (drawing) agree on the same rectangles. Up to six tubes share one
 * row; more split into two rows.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { TUBE_CAPACITY } from './ballSort';

export const BALL_RADIUS = 16;
/** Vertical distance between stacked balls. */
export const BALL_STEP = 36;
export const TUBE_W = 46;
export const TUBE_H = TUBE_CAPACITY * BALL_STEP + 14;
/** How far above its tube a lifted ball floats. */
export const LIFT_Y = 30;

const BOARD_TOP = 190;
const ROW_GAP = 80;
/** Widest centre-to-centre spacing between tubes in a row. */
const MAX_SPACING = 72;
/** Side margin the row keeps inside the canvas. */
const SIDE = 10;

export interface TubeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tubes per row for `count` tubes. */
export function tubesPerRow(count: number): number {
  return count <= 6 ? count : Math.ceil(count / 2);
}

/** Top-left corner and size of each tube, in tube order. */
export function tubeRects(count: number): TubeRect[] {
  const width = DESIGN_CANVAS.width;
  const perRow = tubesPerRow(count);
  const rects: TubeRect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = i - row * perRow;
    const spacing = Math.min(MAX_SPACING, (width - 2 * SIDE) / inRow);
    const x0 = width / 2 - (spacing * (inRow - 1)) / 2;
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
    y: rect.y + rect.h - 7 - BALL_STEP / 2 - slot * BALL_STEP,
  };
}

/** Where a lifted ball floats above its tube. */
export function liftPosition(rect: TubeRect) {
  return { x: rect.x + rect.w / 2, y: rect.y - LIFT_Y };
}

/** The tube under a design-space point (with a generous margin), or -1. */
export function tubeAt(x: number, y: number, count: number): number {
  const pad = 10;
  return tubeRects(count).findIndex(
    (r) =>
      x >= r.x - pad &&
      x <= r.x + r.w + pad &&
      y >= r.y - LIFT_Y - BALL_RADIUS &&
      y <= r.y + r.h + pad,
  );
}

/** The tube a keyboard step moves to from `tube`: left / right along the order, up / down a row. */
export function neighborTube(
  count: number,
  tube: number,
  dir: 'left' | 'right' | 'up' | 'down',
): number {
  if (count <= 0) return -1;
  const perRow = tubesPerRow(count);
  const step =
    dir === 'left' ? -1 : dir === 'right' ? 1 : dir === 'up' ? -perRow : perRow;
  return Math.max(0, Math.min(count - 1, tube + step));
}
