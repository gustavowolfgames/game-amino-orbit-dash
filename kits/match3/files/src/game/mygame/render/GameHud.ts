/**
 * GameHud — moves left, score and the goal's progress, read from ECS each frame.
 *
 * Laid out in design px on DESIGN_CANVAS (390×844), top left.
 *
 * Two `hud-display` rows (level · moves · score, then the goal) and a
 * `fly-text` banner for "Level complete" between levels. Holds no state of
 * its own beyond the live banners.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
// catalog: hud-display for the stat rows; fly-text for the level banner.
import { FlyText } from '@wolfgames/components/modules/primitives/fly-text';
import { HudDisplay } from '@wolfgames/components/modules/primitives/hud-display';
import { Container } from 'pixi.js';
import type { GameTheme } from '~/game/brand';
import { COLOR_NAMES } from '../sim/rules/board';
import { TILE_COLORS } from './BoardView';

interface HudSource {
  readonly resources: {
    readonly level: number;
    readonly score: number;
    readonly bankedScore: number;
    readonly movesLeft: number;
    readonly goal: number;
    readonly goalColor: number;
    readonly goalProgress: number;
  };
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export class GameHud {
  readonly container = new Container();
  private readonly stats: HudDisplay;
  private goalRow: HudDisplay | null = null;
  private goalColor = -1;
  private readonly banners: FlyText[] = [];

  constructor(
    private readonly theme: GameTheme,
    /** Levels in the active pack, read each frame: a pack can arrive mid-session. */
    private readonly levelCount: () => number,
  ) {
    this.container.eventMode = 'none';
    this.stats = new HudDisplay({
      entries: [
        { key: 'level', label: 'LEVEL ', value: '' },
        { key: 'moves', label: 'MOVES ', value: 0 },
        { key: 'score', label: 'SCORE ', value: 0 },
      ],
      direction: 'horizontal',
      fill: theme.text,
      fontFamily: theme.fonts.numeric,
      stroke: '', // no outline: the theme colour reads on the theme ground
    });
    // hud-display spaces its entries for its default 20px text; scale the whole
    // group (text and spacing together) to read at design size on a phone.
    this.stats.scale.set(0.76);
    this.stats.position.set(13, 16);
    this.container.addChild(this.stats);
  }

  update(db: HudSource, dtSec: number): void {
    const r = db.resources;
    this.stats.setValues({
      level: `${r.level + 1}/${this.levelCount()}`,
      moves: r.movesLeft,
      score: r.bankedScore + r.score,
    });
    if (r.goalColor !== this.goalColor) this.buildGoalRow(r.goalColor);
    this.goalRow?.setValue('goal', `${r.goalProgress}/${r.goal}`);
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].update(dtSec);
      if (this.banners[i].destroyed) this.banners.splice(i, 1);
    }
  }

  /** A big centred banner that fades out ("Level 2 complete!"). */
  announce(text: string, y: number): void {
    const b = new FlyText({
      text,
      x: DESIGN_CANVAS.width / 2,
      y,
      velocityY: -10,
      lifetime: 1.4,
      fontSize: 34,
      fontFamily: this.theme.fonts.display,
      fill: '#ffffff',
      stroke: '#1b1e2e',
      strokeWidth: 5,
      startScale: 1,
      endScale: 1.15,
    });
    this.container.addChild(b);
    this.banners.push(b);
  }

  destroy(): void {
    for (const b of this.banners) b.destroy();
    this.container.destroy({ children: true });
  }

  /** The goal row's label names (and is tinted) the goal colour. */
  private buildGoalRow(color: number): void {
    this.goalRow?.destroy();
    this.goalColor = color;
    const name = COLOR_NAMES[color] ?? '';
    this.goalRow = new HudDisplay({
      entries: [
        {
          key: 'goal',
          label: `CLEAR ${name.toUpperCase()} `,
          value: '',
          fill: hex(TILE_COLORS[color] ?? 0xffffff),
        },
      ],
      direction: 'horizontal',
      fontFamily: this.theme.fonts.numeric,
      stroke: '#1b1e2e',
      strokeWidth: 4,
    });
    this.goalRow.scale.set(0.95);
    this.goalRow.position.set(13, 46);
    this.container.addChild(this.goalRow);
  }
}
