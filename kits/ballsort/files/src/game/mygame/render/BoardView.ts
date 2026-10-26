/**
 * BoardView — draws the tubes and balls the world holds, and animates moves.
 *
 * Reads Ball and Tube entities each frame. A ball whose tube, slot or lift
 * changed since the last frame tweens there (lift → across → down); `busy` is
 * true while any tween runs, and the controller ignores input until it clears.
 * A new `runId` (start, restart) rebuilds every view and places balls at rest.
 * The keyboard cursor (`cursor`) is a marker under its tube.
 */

// catalog: considered tile-grid — none fit: tubes are stacks of balls that tween one
// at a time, and the task asks for placeholder Pixi Graphics (circles, rounded rects).
import gsap from 'gsap';
import { Container, Graphics } from 'pixi.js';
import type { Entity } from '~/core/systems/ecs';
import type { GameDatabase } from '../sim/plugin';
import { readBalls, readDoneTubes } from '../sim/readBoard';
import {
  BALL_RADIUS,
  ballPosition,
  liftPosition,
  TUBE_W,
  type TubeRect,
  tubeRects,
} from '../sim/rules/layout';

/** Placeholder ball colours, one per colour index. */
const BALL_COLORS = [
  0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c,
];
const TUBE_FILL = 0xffffff;
const TUBE_STROKE = 0x34495e;
const DONE_STROKE = 0x27ae60;
const CURSOR_COLOR = 0xfed800;
/** Seconds per leg of a move (lift, across, drop). */
const LEG = 0.12;

interface BallSprite {
  g: Graphics;
  /** Where the ball was last sent: tube, slot, and whether it is lifted. */
  tube: number;
  slot: number;
  lifted: boolean;
  /** The move in flight, if any. */
  tl?: gsap.core.Timeline;
}

export class BoardView {
  readonly container = new Container();
  private readonly tubeLayer = new Container();
  private readonly ballLayer = new Container();
  private tubes: Graphics[] = [];
  private rects: TubeRect[] = [];
  private doneShown: boolean[] = [];
  private readonly balls = new Map<Entity, BallSprite>();
  private readonly cursor = new Graphics();
  private cursorShown = -1;
  private runId = -1;

  constructor() {
    this.container.eventMode = 'none';
    // A rounded bar under the tube the keyboard points at.
    this.cursor.roundRect(-TUBE_W / 2, 0, TUBE_W, 6, 3).fill(CURSOR_COLOR);
    this.cursor.visible = false;
    this.container.addChild(this.tubeLayer, this.ballLayer, this.cursor);
  }

  /** True while a ball is moving. */
  get busy(): boolean {
    for (const b of this.balls.values()) if (b.tl) return true;
    return false;
  }

  update(db: GameDatabase): void {
    const { runId, tubeCount, heldTube, cursor } = db.resources;
    if (runId !== this.runId) this.rebuild(runId, tubeCount);
    if (cursor !== this.cursorShown) this.placeCursor(cursor);

    const done = readDoneTubes(db);
    done.forEach((d, i) => {
      if (d !== this.doneShown[i]) this.drawTube(i, d);
    });

    const balls = readBalls(db);
    const heights: number[] = [];
    for (const b of balls)
      heights[b.tube] = Math.max(heights[b.tube] ?? 0, b.slot + 1);
    for (const b of balls) {
      const lifted = b.tube === heldTube && b.slot === heights[b.tube] - 1;
      const view = this.balls.get(b.entity);
      if (!view) {
        const g = new Graphics()
          .circle(0, 0, BALL_RADIUS)
          .fill(BALL_COLORS[b.color % BALL_COLORS.length])
          .stroke({ width: 2, color: 0x000000, alpha: 0.25 });
        this.ballLayer.addChild(g);
        const sprite = { g, tube: b.tube, slot: b.slot, lifted };
        this.balls.set(b.entity, sprite);
        const p = this.target(sprite);
        g.position.set(p.x, p.y);
      } else if (
        view.tube !== b.tube ||
        view.slot !== b.slot ||
        view.lifted !== lifted
      ) {
        this.animate(view, b.tube, b.slot, lifted);
      }
    }
  }

  destroy(): void {
    for (const b of this.balls.values()) {
      b.tl?.kill();
      gsap.killTweensOf(b.g.position);
    }
    this.balls.clear();
    this.container.destroy({ children: true });
  }

  private target(b: { tube: number; slot: number; lifted: boolean }) {
    const rect = this.rects[b.tube];
    return b.lifted ? liftPosition(rect) : ballPosition(rect, b.slot);
  }

  private animate(
    view: BallSprite,
    tube: number,
    slot: number,
    lifted: boolean,
  ): void {
    const legs: { x: number; y: number }[] = [];
    if (view.tube !== tube) {
      // Leave the old tube over its top, cross over, then settle.
      if (!view.lifted) legs.push(liftPosition(this.rects[view.tube]));
      legs.push(liftPosition(this.rects[tube]));
    }
    view.tube = tube;
    view.slot = slot;
    view.lifted = lifted;
    const end = this.target(view);
    const last = legs[legs.length - 1];
    if (!last || last.x !== end.x || last.y !== end.y) legs.push(end);

    view.tl?.kill();
    const tl = gsap.timeline({
      onComplete: () => {
        view.tl = undefined;
      },
    });
    view.tl = tl;
    for (const p of legs)
      tl.to(view.g.position, {
        x: p.x,
        y: p.y,
        duration: LEG,
        ease: 'sine.out',
      });
  }

  private rebuild(runId: number, tubeCount: number): void {
    this.runId = runId;
    for (const b of this.balls.values()) {
      b.tl?.kill();
      b.g.destroy();
    }
    this.balls.clear();
    for (const t of this.tubes) t.destroy();
    this.rects = tubeRects(tubeCount);
    this.tubes = this.rects.map(() => {
      const g = new Graphics();
      this.tubeLayer.addChild(g);
      return g;
    });
    this.doneShown = [];
    for (let i = 0; i < this.rects.length; i++) this.drawTube(i, false);
    this.cursorShown = -2; // re-place the cursor against the new rects
  }

  private placeCursor(tube: number): void {
    this.cursorShown = tube;
    const r = this.rects[tube];
    this.cursor.visible = !!r;
    if (r) this.cursor.position.set(r.x + r.w / 2, r.y + r.h + 8);
  }

  private drawTube(i: number, done: boolean): void {
    const r = this.rects[i];
    this.doneShown[i] = done;
    this.tubes[i]
      .clear()
      .roundRect(r.x, r.y, r.w, r.h, r.w / 2)
      .fill({ color: done ? DONE_STROKE : TUBE_FILL, alpha: done ? 0.3 : 0.35 })
      .stroke({ width: 3, color: done ? DONE_STROKE : TUBE_STROKE });
  }
}
