# render: draw what the world says

A view reads the world and draws it with Pixi. It holds no game state and makes
no game decisions: if a value matters to the game, it lives in `../sim`. The
controller creates each view, adds its container to the design-space root (a `DesignLayer` on
`DESIGN_CANVAS`, 390×844: place children in those px), and
calls `update(db)` from its per-frame `render`.

Ball sort ships two views:

- `BoardView.ts`: the tubes, the balls and the keyboard cursor. It reads the
  Ball and Tube entities every frame (`readBalls`, `readDoneTubes` in
  `../sim/readBoard.ts`); a ball whose tube, slot or lift changed tweens there
  (lift → across → down), and `busy` is true while one moves. Tube positions
  come from `../sim/rules/layout.ts`, the same rectangles the tap hit-tests.
- `Controls.ts`: the HUD (`hud-display`: LEVEL / MOVES / UNDOS), the Undo and
  Restart buttons (`sprite-button`) and the "No moves left" Retry
  (`announcement-overlay`). Buttons call back into the controller, which runs
  the transaction.

Two inputs, two jobs:

- **State** (`db.resources`, entities): what is on screen right now. Read it
  every frame in `update`.
- **Events** (`../sim/events.ts`): what just happened (a move, a sorted tube).
  A one-shot effect hangs off the controller's cue table as a `run` hook
  (`../screens/README.md`), so the view never diffs counters to find out.

Check `@wolfgames/components` first (`.agents/recipes/components.md`): a HUD,
a button, a popup or a particle effect is usually a module to configure. A
"Sorted!" popup over each finished tube, with `fly-text`:

```ts
// check: SortedPopups.ts
// catalog: fly-text for the "Sorted!" popups
import { FlyText } from '@wolfgames/components/modules/primitives/fly-text';
import { Container } from 'pixi.js';
import { getTheme } from '~/game/brand';
import type { EventOfType } from '../sim/events';
import type { GameEvent } from '../sim/plugin';
import { tubeRects } from '../sim/rules/layout';

/** A "Sorted!" popup above each tube that fills with one colour. */
export class SortedPopups {
  readonly container = new Container();
  private readonly live: FlyText[] = [];

  /** Cue hook: `tubeDone: { sfx: 'sfx-clear', run: (e) => popups.add(e, tubeCount) }`. */
  add(e: EventOfType<GameEvent, 'tubeDone'>, tubeCount: number): void {
    const r = tubeRects(tubeCount)[e.tube];
    if (!r) return;
    const popup = new FlyText({
      text: 'Sorted!',
      x: r.x + r.w / 2,
      y: r.y - 20,
      fontSize: 16,
      fill: getTheme().accent,
    });
    this.container.addChild(popup);
    this.live.push(popup);
  }

  update(dtSec: number): void {
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

For entities, keep a `Map<Entity, Sprite>` (as `BoardView` does with its
balls): each frame, create a sprite for a new entity, move the ones that exist,
and destroy the ones whose entity is gone. Read entities with a plain reader
next to the plugin (`../sim/readBoard.ts`), and draw them from a `scene-*`
atlas (`.agents/recipes/assets.md`) once the game has art; the kit draws
placeholder Graphics.

Colours and fonts come from `getTheme()`, so a partner brand recolours the game.
Animate with GSAP, kill tweens before `destroy`, create nothing per frame that
you could create once, and set `eventMode = 'none'` on views that take no input.
