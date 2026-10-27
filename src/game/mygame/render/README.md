# render: draw what the world says

A view reads the world and draws it with Pixi. It holds no game state and makes
no game decisions: if a value matters to the game, it lives in `../sim`. The
controller creates each view, adds its container to the design-space root (a `DesignLayer` on
`DESIGN_CANVAS`, 390×844: place children in those px), and
calls `update(db, dtSec)` from its per-frame `render`.

Two inputs, two jobs:

- **State** (`db.resources`, entities): what is on screen right now. Read it
  every frame in `update`.
- **Events** (`../sim/events.ts`): what just happened (a hit, a clear, a lap).
  A one-shot effect hangs off the controller's cue table as a `run` hook
  (`../screens/README.md`), so the view never diffs counters to find out.

Check `@wolfgames/components` first (`.agents/recipes/components.md`): a HUD,
a button, a popup or a particle effect is usually a module to configure. The
controller's HUD is `hud-display`; this view uses `fly-text`:

```ts
// check: ScorePopups.ts
// catalog: fly-text for the "+1" popups
import { FlyText } from '@wolfgames/components/modules/primitives/fly-text';
import { Container } from 'pixi.js';
import { getTheme } from '~/game/brand';
import type { EventOfType } from '../sim/events';
import type { GameEvent } from '../sim/plugin';

/** A "+1" popup where each point was scored. */
export class ScorePopups {
  readonly container = new Container();
  private readonly live: FlyText[] = [];

  /** Cue hook: `scored: { sfx: 'sfx-pop', run: (e) => popups.add(e) }`. */
  add(e: EventOfType<GameEvent, 'scored'>): void {
    const popup = new FlyText({
      text: '+1',
      x: e.x,
      y: e.y,
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

The end of a run is already a view: `endScreen.ts` draws the win / lose card
(catalog `screen-results`) over the board, with its own flash and confetti when
the juice kit is off, and `../screens/endOfPlay.ts` decides when it shows. Change its text in `endCopy`,
its colours through the theme. Its stars and character are grey boxes until
you publish a `core-results` atlas with the frames in `RESULTS_FRAMES` and add
its bundle to `src/game/asset-manifest.ts`.

Game feel (sparks, pops, flashes, the win beat) goes through one kit of verbs,
`juice.ts`, triggered from the cue table's `run` hooks in `../screens/feedback.ts`.
Each verb wraps a catalog module and cites the Carina pattern it follows; the
numbers live in the `juice` section of `src/game/tuning/types.ts`
(`.agents/recipes/feel.md`).

For entities, keep a `Map<Entity, Sprite>`: each frame, create a sprite for a
new entity, move the ones that exist, and destroy the ones whose entity is
gone. Read entities with a plain reader next to the plugin (`readPieces(db)`,
`../sim/README.md`), and draw them from a `scene-*` atlas
(`.agents/recipes/assets.md`).

Colours and fonts come from `getTheme()`, so a partner brand recolours the game.
Animate with GSAP, kill tweens before `destroy`, create nothing per frame that
you could create once, and set `eventMode = 'none'` on views that take no input.
