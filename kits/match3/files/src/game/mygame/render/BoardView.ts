/**
 * BoardView — draws the 8×8 board from ECS and animates each move.
 *
 * Holds no game state. At rest it mirrors the Tile entities; `play(ruling)`
 * animates a `SwapRuling` from the turn function (`../sim/turn.ts`): the swap
 * (or the swap back), then for each cascade step the clear, the fall and the
 * refill from the top. While a move plays, `busy` is true and input is ignored.
 * When it ends the view re-syncs from ECS, so the world always wins.
 */

// catalog: tile-grid for the board backdrop (its cells are fixed in place, so the
// moving tiles are Graphics on top: placeholder geometry, per the task);
// fly-text for the "+points" / chain popups.
import { FlyText } from '@wolfgames/components/modules/primitives/fly-text';
import { TileGrid } from '@wolfgames/components/modules/primitives/tile-grid';
import gsap from 'gsap';
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { getTheme } from '~/game/brand';
import { readTiles, type TileSource } from '../sim/readStateFromEcs';
import {
  BOARD_SIZE,
  type Cell,
  indexOf,
  type SwapRuling,
} from '../sim/rules/board';

/** Tile fill per colour index (`COLOR_NAMES`: red, blue, green, yellow, purple). */
export const TILE_COLORS = [0xe5484d, 0x3e8ef7, 0x30b65a, 0xf5c518, 0x9b5de5];

export const CELL_SIZE = 88;
const CELL_GAP = 6;
/** Tile size inside its cell. */
const TILE_SIZE = 78;

const SWAP_S = 0.16;
const CLEAR_S = 0.18;
const FALL_BASE_S = 0.16;
const FALL_PER_ROW_S = 0.04;

interface BoardSource extends TileSource {
  readonly resources: { readonly runId: number };
}

export class BoardView {
  readonly container = new Container();
  private readonly grid: TileGrid;
  private readonly tiles = new Container();
  private readonly fx = new Container();
  private readonly selection = new Graphics();
  private readonly contexts: GraphicsContext[];
  /** Tile view per cell index (row-major), mirroring the settled board. */
  private views: (Graphics | null)[] = [];
  private readonly popups: FlyText[] = [];
  private timeline: gsap.core.Timeline | null = null;
  private runId = -1;

  constructor() {
    this.grid = new TileGrid({
      cols: BOARD_SIZE,
      rows: BOARD_SIZE,
      cellSize: CELL_SIZE,
      cellGap: CELL_GAP,
      cellRadius: 14,
      defaultColor: 0x2a2f45,
    });
    this.grid.eventMode = 'none';
    this.container.addChild(this.grid);

    // Tiles spawn above the board and fall in: clip them to the grid.
    const mask = new Graphics()
      .rect(0, 0, this.grid.gridWidth, this.grid.gridHeight)
      .fill(0xffffff);
    this.container.addChild(mask);
    this.tiles.mask = mask;
    this.tiles.eventMode = 'none';
    this.container.addChild(this.tiles);

    this.selection
      .roundRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, 16)
      .stroke({ width: 6, color: 0xffffff });
    this.selection.visible = false;
    this.selection.eventMode = 'none';
    this.container.addChild(this.selection);
    this.fx.eventMode = 'none';
    this.container.addChild(this.fx);

    this.contexts = TILE_COLORS.map((color) => {
      const h = TILE_SIZE / 2;
      return new GraphicsContext()
        .roundRect(-h, -h, TILE_SIZE, TILE_SIZE, 16)
        .fill(color)
        .roundRect(-h + 8, -h + 6, TILE_SIZE - 16, TILE_SIZE * 0.32, 10)
        .fill({ color: 0xffffff, alpha: 0.22 });
    });
  }

  get width(): number {
    return this.grid.gridWidth;
  }

  get height(): number {
    return this.grid.gridHeight;
  }

  /** True while a move is animating: input is ignored. */
  get busy(): boolean {
    return this.timeline !== null;
  }

  /** Board cell under a point in this view's local space, or null. */
  cellAt(x: number, y: number): Cell | null {
    const origin = this.grid.getCellCenter(0, 0);
    const step = CELL_SIZE + CELL_GAP;
    const col = Math.round((x - origin.x) / step);
    const row = Math.round((y - origin.y) / step);
    if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE)
      return null;
    return { col, row };
  }

  setSelected(cell: Cell | null): void {
    this.selection.visible = cell !== null;
    if (!cell) return;
    const p = this.grid.getCellCenter(cell.col, cell.row);
    this.selection.position.set(p.x, p.y);
  }

  /** Per frame: rebuild on a new run, advance popups. */
  update(db: BoardSource, dtSec: number): void {
    if (db.resources.runId !== this.runId && !this.busy) {
      this.runId = db.resources.runId;
      this.setSelected(null);
      this.rebuild(db);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].update(dtSec);
      if (this.popups[i].destroyed) this.popups.splice(i, 1);
    }
  }

  /** Animate a move, then re-sync from `db` once it settles. */
  play(ruling: SwapRuling, db: BoardSource): void {
    this.timeline?.progress(1); // never two at once
    this.setSelected(null);
    const tl = gsap.timeline({
      onComplete: () => {
        this.timeline = null;
        this.rebuild(db);
      },
    });
    this.timeline = tl;

    const ia = indexOf(ruling.a.col, ruling.a.row);
    const ib = indexOf(ruling.b.col, ruling.b.row);
    const va = this.views[ia];
    const vb = this.views[ib];
    const pa = this.center(ruling.a);
    const pb = this.center(ruling.b);
    if (va)
      tl.to(va.position, { ...pb, duration: SWAP_S, ease: 'sine.inOut' }, 0);
    if (vb)
      tl.to(vb.position, { ...pa, duration: SWAP_S, ease: 'sine.inOut' }, 0);
    if (!ruling.valid) {
      // No line made: swap back.
      if (va)
        tl.to(va.position, { ...pa, duration: SWAP_S, ease: 'sine.inOut' });
      if (vb)
        tl.to(
          vb.position,
          { ...pb, duration: SWAP_S, ease: 'sine.inOut' },
          '<',
        );
      return;
    }
    this.views[ia] = vb;
    this.views[ib] = va;

    for (const step of ruling.steps) {
      // Clear.
      const label = `clear${step.chain}`;
      tl.addLabel(label);
      const gone = step.cleared.map((c) => this.views[indexOf(c.col, c.row)]);
      for (const v of gone) {
        if (!v) continue;
        tl.to(
          v.scale,
          { x: 0, y: 0, duration: CLEAR_S, ease: 'back.in(2)' },
          label,
        );
        tl.to(v, { alpha: 0, duration: CLEAR_S }, label);
      }
      for (const c of step.cleared) this.views[indexOf(c.col, c.row)] = null;
      const mid = this.centroid(step.cleared);
      tl.call(
        () => {
          for (const v of gone) v?.destroy();
          this.popup(
            step.chain > 1
              ? `+${step.points}  ×${step.chain}`
              : `+${step.points}`,
            mid,
          );
        },
        [],
        `${label}+=${CLEAR_S}`,
      );

      // Fall (falls are listed bottom-first per column, so moves never collide).
      const fallAt = `${label}+=${CLEAR_S}`;
      for (const f of step.falls) {
        const from = indexOf(f.col, f.fromRow);
        const v = this.views[from];
        this.views[from] = null;
        this.views[indexOf(f.col, f.toRow)] = v;
        if (v)
          this.fallTween(tl, v, f.col, f.toRow, f.toRow - f.fromRow, fallAt);
      }
      // Refill from above the board.
      for (const s of step.spawns) {
        const v = this.makeTile(s.color, { col: s.col, row: s.fromRow });
        this.views[indexOf(s.col, s.toRow)] = v;
        this.fallTween(tl, v, s.col, s.toRow, s.toRow - s.fromRow, fallAt);
      }
    }
    if (ruling.reshuffled) {
      tl.to(this.tiles, { alpha: 0, duration: 0.2 });
      tl.call(() => this.rebuild(db));
      tl.to(this.tiles, { alpha: 1, duration: 0.2 });
    }
  }

  destroy(): void {
    this.timeline?.kill();
    this.timeline = null;
    gsap.killTweensOf(this.tiles);
    for (const v of this.views)
      if (v) gsap.killTweensOf([v, v.position, v.scale]);
    for (const p of this.popups) p.destroy();
    this.container.destroy({ children: true });
    for (const c of this.contexts) c.destroy();
  }

  // ── internals ────────────────────────────────────────────────────────────

  private center(cell: Cell): { x: number; y: number } {
    const step = CELL_SIZE + CELL_GAP;
    const origin = this.grid.getCellCenter(0, 0);
    return { x: origin.x + cell.col * step, y: origin.y + cell.row * step };
  }

  private centroid(cells: Cell[]): { x: number; y: number } {
    const ps = cells.map((c) => this.center(c));
    return {
      x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
      y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
    };
  }

  private makeTile(color: number, at: Cell): Graphics {
    const g = new Graphics(this.contexts[color]);
    const p = this.center(at);
    g.position.set(p.x, p.y);
    this.tiles.addChild(g);
    return g;
  }

  private fallTween(
    tl: gsap.core.Timeline,
    v: Graphics,
    col: number,
    toRow: number,
    rows: number,
    at: string,
  ): void {
    tl.to(
      v.position,
      {
        ...this.center({ col, row: toRow }),
        duration: FALL_BASE_S + FALL_PER_ROW_S * rows,
        ease: 'power2.in',
      },
      at,
    );
  }

  private popup(text: string, at: { x: number; y: number }): void {
    const theme = getTheme();
    const p = new FlyText({
      text,
      x: at.x,
      y: at.y,
      fontSize: 44,
      fontFamily: theme.fonts.numeric,
      fill: '#ffffff',
      stroke: '#1b1e2e',
      strokeWidth: 6,
    });
    this.fx.addChild(p);
    this.popups.push(p);
  }

  /** Throw away every tile view and redraw the board from the Tile entities. */
  private rebuild(db: BoardSource): void {
    for (const v of this.views)
      if (v) gsap.killTweensOf([v, v.position, v.scale]);
    for (const c of this.tiles.removeChildren()) c.destroy();
    this.views = new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    for (const t of readTiles(db)) {
      this.views[indexOf(t.col, t.row)] = this.makeTile(t.color, t);
    }
  }
}
