/**
 * swap — drag, tap-tap or keys on the board become a swap.
 *
 * Pointer: press a tile and drag toward a neighbour, or tap a tile then tap a
 * neighbour. Keyboard (intents from `useGameKeyboard`, through the controller's
 * `input`): arrows move a cursor; Space / Enter picks the tile under it; an
 * arrow with a tile picked swaps it that way; Space / Enter again drops it.
 *
 * Nothing here decides whether the swap is legal: `onSwap(a, b)` hands the two
 * cells to the turn function (`../sim/turn.ts`). Pointer events are read on the
 * Pixi stage; no DOM listeners. `accepting` turns input off while the board
 * settles, the run is over, or the settings menu / pause owns the screen.
 */

import type { Application, FederatedPointerEvent } from 'pixi.js';
import type { GameIntent } from '~/game/mygame-contract';
import type { BoardView } from '../render/BoardView';
import { CELL_SIZE } from '../render/BoardView';
import { areAdjacent, BOARD_SIZE, type Cell } from '../sim/rules/board';

/** Drag distance (design px) that commits a swap. */
const DRAG_THRESHOLD = CELL_SIZE * 0.35;

const STEP: Record<
  Extract<GameIntent, { type: 'move' }>['dir'],
  [number, number]
> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

const onBoard = (c: Cell) =>
  c.col >= 0 && c.col < BOARD_SIZE && c.row >= 0 && c.row < BOARD_SIZE;

export interface SwapInput {
  /** A keyboard intent (the controller's `input`). */
  key: (intent: GameIntent) => void;
  /** Stop listening. */
  unbind: () => void;
}

export function bindSwapInput(
  app: Application,
  board: BoardView,
  onSwap: (a: Cell, b: Cell) => void,
  accepting: () => boolean,
): SwapInput {
  const stage = app.stage;
  let selected: Cell | null = null;
  let drag: { cell: Cell; x: number; y: number } | null = null;
  /** Keyboard cursor; shown from the first key press. */
  let cursor: Cell = { col: 0, row: 0 };

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
    if (!onBoard(target)) {
      drag = null;
      return;
    }
    commit(drag.cell, target);
  };

  const onUp = () => {
    drag = null; // the selection stays for a tap-tap swap
  };

  const key = (intent: GameIntent) => {
    if (!accepting()) return;
    if (intent.type === 'action') {
      select(selected ? null : cursor);
    } else if (intent.type === 'move') {
      const [dc, dr] = STEP[intent.dir];
      // A picked tile (by key or by tap) swaps that way; otherwise the cursor moves.
      const from = selected ?? cursor;
      const next = { col: from.col + dc, row: from.row + dr };
      if (!onBoard(next)) return;
      if (selected) commit(selected, next);
      cursor = next;
    }
    board.setCursor(cursor);
  };

  stage.eventMode = 'static';
  stage.hitArea = app.screen;
  stage.on('pointerdown', onDown);
  stage.on('globalpointermove', onMove);
  stage.on('pointerup', onUp);
  stage.on('pointerupoutside', onUp);
  return {
    key,
    unbind: () => {
      stage.off('pointerdown', onDown);
      stage.off('globalpointermove', onMove);
      stage.off('pointerup', onUp);
      stage.off('pointerupoutside', onUp);
    },
  };
}
