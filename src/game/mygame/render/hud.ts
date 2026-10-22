/**
 * hud — the level / score HUD, in the theme in force.
 *
 * The controller builds it with the scene and rebuilds it when a Vault edition brings
 * another brand, then feeds it values once a frame (`setValues`).
 */

// catalog: hud-display for the level/score HUD
import { HudDisplay } from '@wolfgames/components/modules/primitives/hud-display';
import type { GameTheme } from '~/game/brand';

/** HUD placement in design px on DESIGN_CANVAS (390×844). hud-display spaces
 *  its entries for its default 20px text, so the whole group is scaled. */
const HUD = { x: 13, y: 16, scale: 0.76 };

export function createHud(theme: GameTheme): HudDisplay {
  const hud = new HudDisplay({
    entries: [
      { key: 'level', label: 'LEVEL ', value: '' },
      { key: 'score', label: 'SCORE ', value: 0 },
    ],
    direction: 'horizontal',
    fill: theme.text,
    fontFamily: theme.fonts.numeric,
    stroke: '', // no outline: the theme colour reads on the theme ground
  });
  hud.scale.set(HUD.scale);
  hud.position.set(HUD.x, HUD.y);
  hud.eventMode = 'none';
  return hud;
}
