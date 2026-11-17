/** Code-native geometric title art fed into Wolf's background, logo and button modules. */
// catalog: considered dynamic-background, sprite-logo-title, sprite-button;
// user chose final geometric art, and these catalog modules animate/render its textures.
import { DESIGN_CANVAS } from '@wolfgames/components/core';
import { type Application, Graphics, Text, type Texture } from 'pixi.js';
import type { GameTheme } from '~/game/brand';

export interface TitleArt {
  background: Texture;
  logo: Texture;
  play: Texture;
  destroy(): void;
}

export function createTitleArt(app: Application, theme: GameTheme): TitleArt {
  const { width, height } = DESIGN_CANVAS;
  const bg = new Graphics()
    .rect(0, 0, width, height)
    .fill(theme.ground)
    .circle(width / 2, height / 2 + 8, 155)
    .stroke({ color: theme.pieces[1], width: 3, alpha: 0.65 })
    .circle(width / 2, height / 2 + 8, 105)
    .stroke({ color: theme.pieces[1], width: 3, alpha: 0.45 })
    .circle(width / 2, height / 2 + 8, 40)
    .fill(theme.surface)
    .circle(width / 2, height / 2 + 8, 12)
    .fill(theme.pieces[1]);
  for (let i = 0; i < 18; i++) {
    const x = 20 + ((i * 97) % 350);
    const y = 32 + ((i * 137) % 780);
    bg.circle(x, y, i % 3 === 0 ? 2 : 1).fill({
      color: theme.text,
      alpha: 0.35,
    });
  }
  const background = app.renderer.generateTexture(bg);
  bg.destroy();

  const wordmark = new Text({
    text: 'ORBIT\nDASH',
    style: {
      fill: theme.text,
      fontFamily: theme.fonts.display,
      fontSize: 80,
      fontWeight: '900',
      align: 'center',
      lineHeight: 76,
      letterSpacing: 4,
    },
  });
  const logo = app.renderer.generateTexture(wordmark);
  wordmark.destroy();

  const button = new Graphics()
    .circle(75, 75, 71)
    .fill(theme.accent)
    .circle(75, 75, 65)
    .stroke({ color: theme.accentInk, width: 3, alpha: 0.4 })
    .moveTo(61, 43)
    .lineTo(61, 107)
    .lineTo(111, 75)
    .closePath()
    .fill(theme.accentInk);
  const play = app.renderer.generateTexture(button);
  button.destroy();
  return {
    background,
    logo,
    play,
    destroy() {
      background.destroy(true);
      logo.destroy(true);
      play.destroy(true);
    },
  };
}
