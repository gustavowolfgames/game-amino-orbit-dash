/**
 * hud — the level / score HUD, in the theme in force.
 *
 * The controller builds it with the scene and rebuilds it when a Vault edition brings
 * another brand, then feeds it values once a frame (`setValues`). The juice kit pops it
 * (a scale tween on this container), so `destroy` kills its tweens first.
 *
 * It keeps out of the app's chrome (src/game/safeZones.ts): its row shares the gear's band at
 * the top, so a row that grows (a long level label, a big score, an entry a game adds) shrinks
 * to end short of the gear instead of running under it.
 */

// catalog: hud-display for the level/score HUD
import { HudDisplay } from '@wolfgames/components/modules/primitives/hud-display';
import { Container, type DestroyOptions } from 'pixi.js';
import type { GameTheme } from '~/game/brand';
import { SAFE_ZONES } from '~/game/safeZones';
import { killTree } from './tweens';

/** HUD placement in design px on DESIGN_CANVAS (390×844). hud-display spaces
 *  its entries for its default 20px text, so the whole group is scaled. */
export const HUD = { x: 13, y: 16, scale: 0.76 } as const;

/** Space kept between the HUD's right edge and the gear (design px). */
const GEAR_GAP = 8;

/** The right edge the HUD's row may reach: just short of the gear. */
export const HUD_MAX_RIGHT = SAFE_ZONES.gear.x - GEAR_GAP;

/** The scale for a row `naturalWidth` px wide at scale 1: `HUD.scale`, or less to end at
 *  `HUD_MAX_RIGHT`. */
export function hudScaleFor(naturalWidth: number): number {
  if (!(naturalWidth > 0)) return HUD.scale;
  return Math.min(HUD.scale, (HUD_MAX_RIGHT - HUD.x) / naturalWidth);
}

export interface HudValues {
  level: string;
  score: number;
  shields: number;
  seconds: number;
}

export class Hud extends Container {
  private readonly display: HudDisplay;
  /** The values last drawn: the row is only re-measured when they change. */
  private drawn = '';

  constructor(theme: GameTheme) {
    super();
    this.display = new HudDisplay({
      entries: [
        { key: 'level', label: 'LEVEL ', value: '' },
        { key: 'score', label: 'ORB ', value: 0 },
        { key: 'shields', label: 'SHIELD ', value: 3 },
        { key: 'seconds', label: 'TIME ', value: 45 },
      ],
      direction: 'vertical',
      fill: theme.text,
      fontFamily: theme.fonts.numeric,
      stroke: '', // no outline: the theme colour reads on the theme ground
    });
    this.display.scale.set(HUD.scale);
    this.addChild(this.display);
    this.position.set(HUD.x, HUD.y);
    this.eventMode = 'none';
  }

  setValues(values: HudValues): void {
    const key = `${values.level}|${values.score}|${values.shields}|${values.seconds}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.display.setValue('level', values.level);
    this.display.setValue('score', values.score);
    this.display.setValue('shields', values.shields);
    this.display.setValue('seconds', values.seconds);
    const natural = this.display.width / this.display.scale.x;
    this.display.scale.set(hudScaleFor(natural));
  }

  override destroy(options: DestroyOptions = { children: true }): void {
    killTree(this);
    super.destroy(options);
  }
}

export function createHud(theme: GameTheme): Hud {
  return new Hud(theme);
}
