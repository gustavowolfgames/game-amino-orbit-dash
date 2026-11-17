/** Orbit Dash's deliberate geometric scene, projected from the ECS world. */
// catalog: considered sprite-character (requires an atlas), hotspot (static tap zone),
// cta-radar-ping (hint rings); user chose final geometric Pixi orbit/actors instead.
// hud-display handles the instructional label; the template juice kit handles VFX.
import { HudDisplay } from '@wolfgames/components/modules/primitives/hud-display';
import { Container, Graphics } from 'pixi.js';
import type { GameTheme } from '~/game/brand';
import type { GameDatabase } from '../sim/plugin';
import { CENTER_X, CENTER_Y, LANE_RADII, TAU } from '../sim/rules/orbit';
import { killTree } from './tweens';

interface GateView {
  safe: Graphics;
  hazard: Graphics;
}

export interface Arena {
  layer: Container;
  player: Container;
  update(db: GameDatabase): void;
  destroy(): void;
}

function makeGate(theme: GameTheme): GateView {
  const energy = theme.pieces[2] ?? theme.pieces[0];
  const danger = theme.pieces[3] ?? theme.pieces[1] ?? theme.pieces[0];
  const safe = new Graphics()
    .circle(0, 0, 16)
    .fill({ color: energy, alpha: 0.18 })
    .circle(0, 0, 10)
    .fill(energy)
    .circle(0, 0, 4)
    .fill(theme.text);
  const hazard = new Graphics()
    .roundRect(-10, -10, 20, 20, 4)
    .fill(danger)
    .roundRect(-4, -4, 8, 8, 2)
    .fill(theme.ground);
  hazard.rotation = Math.PI / 4;
  return { safe, hazard };
}

export function createArena(theme: GameTheme): Arena {
  const glow = theme.pieces[1] ?? theme.pieces[0];
  const layer = new Container();
  layer.eventMode = 'none';
  layer.interactiveChildren = false;
  const track = new Graphics()
    .circle(CENTER_X, CENTER_Y, LANE_RADII[0])
    .stroke({ color: theme.muted, width: 4, alpha: 0.8 })
    .circle(CENTER_X, CENTER_Y, LANE_RADII[1])
    .stroke({ color: theme.muted, width: 4, alpha: 0.8 })
    .circle(CENTER_X, CENTER_Y, 48)
    .fill(theme.surface)
    .circle(CENTER_X, CENTER_Y, 35)
    .stroke({ color: glow, width: 2, alpha: 0.65 })
    .circle(CENTER_X, CENTER_Y, 12)
    .fill(glow);
  layer.addChild(track);
  const gates = new Container();
  layer.addChild(gates);
  const player = new Container();
  player.addChild(
    new Graphics().circle(0, 0, 22).fill({ color: glow, alpha: 0.2 }),
    new Graphics()
      .roundRect(-11, -15, 22, 30, 9)
      .fill(theme.text)
      .stroke({ color: glow, width: 3 }),
    new Graphics().circle(0, -3, 4).fill(theme.surface),
  );
  layer.addChild(player);

  const hint = new HudDisplay({
    entries: [
      { key: 'hint', label: 'TAP / SPACE  •  SWITCH LANES', value: '' },
    ],
    direction: 'horizontal',
    fill: theme.text,
    fontFamily: theme.fonts.body,
  });
  hint.position.set(43, 666);
  hint.scale.set(0.78);
  layer.addChild(hint);

  let runId = -1;
  const views = new Map<number, GateView>();
  const place = (g: Graphics, angle: number, lane: number) => {
    const r = LANE_RADII[lane === 0 ? 0 : 1];
    g.position.set(
      CENTER_X + Math.cos(angle) * r,
      CENTER_Y + Math.sin(angle) * r,
    );
  };
  return {
    layer,
    player,
    update(db) {
      if (db.resources.runId !== runId) {
        runId = db.resources.runId;
        for (const pair of views.values()) {
          pair.safe.destroy();
          pair.hazard.destroy();
        }
        views.clear();
        for (const e of db.select(['gate'])) {
          const pair = makeGate(theme);
          views.set(e, pair);
          gates.addChild(pair.safe, pair.hazard);
        }
      }
      let runnerAngle = 0;
      for (const e of db.select(['runner'])) {
        const p = db.read(e, ['angle', 'lane']);
        if (typeof p?.angle !== 'number' || typeof p.lane !== 'number')
          continue;
        runnerAngle = p.angle;
        const r = LANE_RADII[p.lane === 0 ? 0 : 1];
        player.position.set(
          CENTER_X + Math.cos(p.angle) * r,
          CENTER_Y + Math.sin(p.angle) * r,
        );
        player.rotation = p.angle + Math.PI / 2;
      }
      for (const e of db.select(['gate'])) {
        const data = db.read(e, ['angle', 'lane', 'nextPass']);
        const view = views.get(e);
        if (
          typeof data?.angle !== 'number' ||
          typeof data.lane !== 'number' ||
          typeof data.nextPass !== 'number' ||
          !view
        )
          continue;
        place(view.safe, data.angle, data.lane);
        place(view.hazard, data.angle, 1 - data.lane);
        // A gate vanishes just after crossing, then fades back for the next lap.
        const distance = data.angle + data.nextPass * TAU - runnerAngle;
        const alpha = Math.max(0, Math.min(1, (5.9 - distance) / 0.5));
        view.safe.alpha = alpha;
        view.hazard.alpha = alpha;
      }
    },
    destroy() {
      killTree(layer);
      layer.destroy({ children: true });
      views.clear();
    },
  };
}
