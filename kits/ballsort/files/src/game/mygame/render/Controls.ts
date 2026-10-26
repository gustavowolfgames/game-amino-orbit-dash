/**
 * Controls — the HUD, the Undo / Restart buttons and the "No moves left" overlay.
 *
 * Reads the world each frame and holds no game state. Buttons do not change the
 * world themselves: they call `onCommand`, which the controller turns into the
 * matching transaction (`undo`, `restartLevel`) while input is accepted.
 * Layout is design px on DESIGN_CANVAS (390×844).
 */

import { DESIGN_CANVAS } from '@wolfgames/components/core';
// catalog: hud-display for level / moves / undos; sprite-button for Undo, Restart and
// Retry (fed a rounded-rect texture: no UI atlas, placeholder geometry); announcement-
// overlay for "No moves left". Considered screen-hud (needs a mascot atlas) — skipped.
import { AnnouncementOverlay } from '@wolfgames/components/modules/prefabs/announcement-overlay';
import { HudDisplay } from '@wolfgames/components/modules/primitives/hud-display';
import { SpriteButton } from '@wolfgames/components/modules/primitives/sprite-button';
import { type Application, Container, Graphics, type Texture } from 'pixi.js';
import type { PixiLoader } from '~/core/systems/assets';
import { getTheme } from '~/game/brand';
import type { GameDatabase } from '../sim/plugin';

/** A button press the controller turns into a transaction. */
export type Command = 'undo' | 'restart';

const BUTTON_W = 120;
const BUTTON_H = 46;
const BUTTON_Y = DESIGN_CANVAS.height - 110;
/** HUD placement: hud-display spaces its entries for 20px text, so the group is scaled. */
const HUD = { x: 13, y: 16, scale: 0.76 };

/** A rounded-rect button face, drawn once and reused by every button. */
function buttonTexture(app: Application, color: number): Texture {
  const g = new Graphics()
    .roundRect(0, 0, BUTTON_W, BUTTON_H, 14)
    .fill(color)
    .stroke({ width: 2, color: 0x000000, alpha: 0.2 });
  const texture = app.renderer.generateTexture(g);
  g.destroy();
  return texture;
}

export class Controls {
  readonly container = new Container();
  private readonly hud: HudDisplay;
  private readonly undoBtn: SpriteButton;
  private readonly restartBtn: SpriteButton;
  private readonly overlay: AnnouncementOverlay;
  private readonly face: Texture;
  private overlayShown = false;
  private undoEnabled = true;

  constructor(
    app: Application,
    loader: PixiLoader,
    private readonly levelCount: () => number,
    onCommand: (command: Command) => void,
  ) {
    const theme = getTheme();
    this.hud = new HudDisplay({
      entries: [
        { key: 'level', label: 'LEVEL ', value: '' },
        { key: 'moves', label: 'MOVES ', value: 0 },
        { key: 'undos', label: 'UNDOS ', value: 0 },
      ],
      direction: 'horizontal',
      fill: theme.text,
      fontFamily: theme.fonts.numeric,
      stroke: '', // no outline: the theme colour reads on the theme ground
    });
    this.hud.scale.set(HUD.scale);
    this.hud.position.set(HUD.x, HUD.y);
    this.hud.eventMode = 'none';

    this.face = buttonTexture(app, 0xfed800);
    const labelStyle = { fontFamily: theme.fonts.numeric, fontSize: 18 };
    const button = (label: string, x: number, command: Command) => {
      const btn = new SpriteButton(loader, {
        texture: this.face,
        label,
        labelStyle,
        onClick: () => onCommand(command),
      });
      btn.position.set(x, BUTTON_Y);
      return btn;
    };
    this.undoBtn = button('Undo', DESIGN_CANVAS.width / 2 - 70, 'undo');
    this.restartBtn = button(
      'Restart',
      DESIGN_CANVAS.width / 2 + 70,
      'restart',
    );

    this.overlay = new AnnouncementOverlay(loader, {
      screenWidth: DESIGN_CANVAS.width,
      screenHeight: DESIGN_CANVAS.height,
      fontFamily: theme.fonts.numeric,
      button: {
        gpuLoader: loader,
        texture: this.face,
        label: 'Retry',
        labelStyle,
        onClick: () => onCommand('restart'),
      },
    });

    this.container.addChild(
      this.hud,
      this.undoBtn,
      this.restartBtn,
      this.overlay,
    );
  }

  update(db: GameDatabase): void {
    const r = db.resources;
    this.hud.setValues({
      level: `${r.level + 1}/${this.levelCount()}`,
      moves: r.moves,
      undos: r.undosLeft,
    });
    const canUndo = r.undosLeft > 0 && r.history.length > 0;
    if (canUndo !== this.undoEnabled) {
      this.undoEnabled = canUndo;
      this.undoBtn.setEnabled(canUndo);
    }
    if (r.stuck !== this.overlayShown) {
      this.overlayShown = r.stuck;
      if (r.stuck) this.overlay.show({ headline: 'No moves left' });
      else this.overlay.hide();
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.face.destroy(true);
  }
}
