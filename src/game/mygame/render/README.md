# render: draw what the world says

A view reads the world and draws it with Pixi. It holds no game state and makes
no game decisions: if a value matters to the game, it lives in `../sim`. The
controller creates each view, adds its container to the design-space root, and
calls `update(db, dtSec)` from its per-frame `render`.

Check `@wolfgames/components` first (`.agents/recipes/components.md`): a HUD,
a button, a popup or a particle effect is usually a module to configure. The
controller's HUD is `hud-display`; this view uses `fly-text`:

```ts
// check: ScorePopups.ts
// catalog: fly-text for the "+points" popups
import { FlyText } from '@wolfgames/components/modules/primitives/fly-text';
import { Container } from 'pixi.js';
import { getTheme } from '~/game/brand';
import { DESIGN_W } from '../config';
import type { GameDatabase } from '../sim/plugin';

/** A "+points" popup each time the score goes up. */
export class ScorePopups {
  readonly container = new Container();
  private readonly live: FlyText[] = [];
  private lastScore = 0;

  update(db: GameDatabase, dtSec: number): void {
    const { score } = db.resources;
    if (score > this.lastScore) {
      const popup = new FlyText({
        text: `+${score - this.lastScore}`,
        x: DESIGN_W / 2,
        y: 200,
        fill: getTheme().accent,
      });
      this.container.addChild(popup);
      this.live.push(popup);
    }
    this.lastScore = score;
    for (let i = this.live.length - 1; i >= 0; i--) {
      this.live[i].update(dtSec);
      if (this.live[i].destroyed) this.live.splice(i, 1); // fly-text ends itself
    }
  }

  destroy(): void {
    for (const popup of this.live) popup.destroy();
    this.container.destroy({ children: true });
  }
}
```

For entities, keep a `Map<Entity, Sprite>`: each frame, create a sprite for a
new entity, move the ones that exist, and destroy the ones whose entity is
gone. Read entities through a reader in `../sim/readStateFromEcs.ts`, and draw
them from a `scene-*` atlas (`.agents/recipes/assets.md`).

Colours and fonts come from `getTheme()`, so a partner brand recolours the game.
Animate with GSAP, kill tweens before `destroy`, create nothing per frame that
you could create once, and set `eventMode = 'none'` on views that take no input.
