/**
 * Safe zones (src/game/safeZones.ts): the gear and the WolfGames logo, in design px, and the
 * HUD (src/game/mygame/render/hud.ts) keeping clear of them.
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { describe, expect, it } from 'vitest';
import { HUD, HUD_MAX_RIGHT, hudScaleFor } from '~/game/mygame/render/hud';
import {
  clearOfSafeZones,
  GEAR_SIZE,
  overlaps,
  SAFE_ZONES,
} from '~/game/safeZones';
// The built defaults file alone (not an exported path): the module's index pulls in its Solid
// renderer, which Node cannot load.
import { SETTINGS_MENU_DOM_DEFAULTS } from '../../../node_modules/@wolfgames/components/dist/modules/prefabs/settings-menu-dom/defaults.js';

/** hud-display's default text size: the row's height at scale 1. */
const ROW_HEIGHT = 20;
const hudRow = (naturalWidth: number) => {
  const scale = hudScaleFor(naturalWidth);
  return {
    x: HUD.x,
    y: HUD.y,
    width: naturalWidth * scale,
    height: ROW_HEIGHT * scale,
  };
};

describe('SAFE_ZONES', () => {
  it('the gear is the catalog button (icon plus padding) in the top-right corner', () => {
    const { gearIconSize, gearPadding } = SETTINGS_MENU_DOM_DEFAULTS;
    expect(GEAR_SIZE).toBe(gearIconSize + 2 * gearPadding);
    const { gear } = SAFE_ZONES;
    expect(gear.x + gear.width).toBe(DESIGN_CANVAS.width - 8);
    expect(gear.y).toBe(8);
  });

  it('the logo is centred at the bottom of the canvas', () => {
    const { logo } = SAFE_ZONES;
    expect(logo.x + logo.width / 2).toBe(DESIGN_CANVAS.width / 2);
    expect(logo.y + logo.height).toBe(DESIGN_CANVAS.height - 32);
  });

  it('overlaps: touching edges do not count', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlaps(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
    expect(overlaps(a, { x: 9, y: 9, width: 5, height: 5 })).toBe(true);
  });
});

describe('the HUD keeps clear of the safe zones', () => {
  it('a short row draws at its own scale', () => {
    expect(hudScaleFor(200)).toBe(HUD.scale);
    expect(clearOfSafeZones(hudRow(200))).toBe(true);
  });

  it('a row long enough to reach the gear shrinks to end before it', () => {
    for (const width of [450, 600, 1200]) {
      const row = hudRow(width);
      expect(row.x + row.width).toBeCloseTo(HUD_MAX_RIGHT);
      expect(clearOfSafeZones(row)).toBe(true);
    }
  });

  it('at its own scale, the same long row would have run under the gear', () => {
    const width = 450;
    const unfitted = {
      x: HUD.x,
      y: HUD.y,
      width: width * HUD.scale,
      height: ROW_HEIGHT * HUD.scale,
    };
    expect(overlaps(unfitted, SAFE_ZONES.gear)).toBe(true);
  });
});
