/**
 * swap — drag or tap-tap on the board becomes a swap intent.
 *
 * Press a tile and drag toward a neighbour, or tap a tile then tap a neighbour.
 * Nothing here decides whether the swap is legal: `onSwap(a, b)` hands the two
 * cells to the turn function (`../sim/turn.ts`). Pointer events are read on
 * the Pixi stage; no DOM listeners. `accepting` turns input off while the board
 * settles, the run is over, or the settings menu / pause owns the screen.
 */

import type { Application, FederatedPointerEvent } from 'pixi.js';
import type { BoardView } from '../render/BoardView';
import { CELL_SIZE } from '../render/BoardView';
import { areAdjacent, BOARD_SIZE, type Cell } from '../sim/rules/board';

/** Drag distance (design px) that commits a swap. */
const DRAG_THRESHOLD = CELL_SIZE * 0.35;

export function bindSwapInput(
  app: Application,
  board: BoardView,
  onSwap: (a: Cell, b: Cell) => void,
  accepting: () => boolean,
): () => void {
  const stage = app.stage;
  let selected: Cell | null = null;
  let drag: { cell: Cell; x: number; y: number } | null = null;

  const local = (e: FederatedPointerEvent) => board.container.toLocal(e.global);
  const select = (cell: Cell | null) => {
    selected = cell;
    board.setSelected(cell);
  };
  const commit = (a: Cell, b: Cell) => {
    select(null);
    drag = null;
    onSwap(a, b);
  };

  const onDown = (e: FederatedPointerEvent) => {
    if (!accepting()) return;
    const p = local(e);
    const cell = board.cellAt(p.x, p.y);
    if (!cell) return select(null);
    if (selected && areAdjacent(selected, cell)) return commit(selected, cell);
    select(cell);
    drag = { cell, x: p.x, y: p.y };
  };

  const onMove = (e: FederatedPointerEvent) => {
    if (!drag || !accepting()) return;
    const p = local(e);
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return;
    const { col, row } = drag.cell;
    const target =
      Math.abs(dx) > Math.abs(dy)
        ? { col: col + Math.sign(dx), row }
        : { col, row: row + Math.sign(dy) };
    if (
      target.col < 0 ||
      target.col >= BOARD_SIZE ||
      target.row < 0 ||
      target.row >= BOARD_SIZE
    ) {
      drag = null;
      return;
    }
    commit(drag.cell, target);
  };

  const onUp = () => {
    drag = null; // the selection stays for a tap-tap swap
  };

  stage.eventMode = 'static';
  stage.hitArea = app.screen;
  stage.on('pointerdown', onDown);
  stage.on('globalpointermove', onMove);
  stage.on('pointerup', onUp);
  stage.on('pointerupoutside', onUp);
  return () => {
    stage.off('pointerdown', onDown);
    stage.off('globalpointermove', onMove);
    stage.off('pointerup', onUp);
    stage.off('pointerupoutside', onUp);
  };
}
