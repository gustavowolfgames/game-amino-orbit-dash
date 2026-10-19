---
name: pixi-gameplay
description: Draw Wolf gameplay with PixiJS 8. Use when building a game screen, sprite, canvas HUD, transition, or VFX, or when about to call Graphics, Sprite, Application, or a particle API.
---

# Pixi gameplay

This repo uses Pixi 8, at the version in `package.json`. Import from `pixi.js`. The README and `Graphics.d.ts` in that install are the API. Do not use Pixi 7 calls.

## Application

Construct with no arguments. Await `init`. Append `app.canvas`. Resizing goes through `trackHostBox` in Stage fit.

```ts
const app = new Application();
await app.init({
  background: '#0e1220',
  antialias: true,
  resolution: Math.min(window.devicePixelRatio, 2),
  autoDensity: true,
});
container.appendChild(app.canvas);
```

Do not pass options to `new Application`. Do not append `app.view`. The sample still passes `resizeTo: container`. `resizeTo` misses host-box changes that happen while the window holds still.

## Pictures and geometry

A character, card, button face, or effect texture comes from wolf-game-kit. Follow `.agents/recipes/assets.md`. Load its bundle through the coordinator, then make a sprite from the GPU loader.

```ts
await deps.coordinator.loadBundle('scene-level-1');
const sprite = deps.coordinator.getGpuLoader()?.createSprite('atlas-tiles', 'tile_red.png');
sprite?.anchor.set(0.5);
```

A track stroke or a hit area may be `Graphics`. Chain the shape, then fill or stroke.

```ts
new Graphics().circle(x, y, r).fill(0x05060c);
new Graphics().roundRect(x, y, w, h, radius).fill(0x8895c0).stroke({ width: 3, color: 0x1a2036 });
```

`beginFill`, `endFill`, `drawCircle`, and `lineStyle` are deprecated since 8.0.0 in `Graphics.d.ts`. Do not call them.

## Text and input

```ts
new Text({
  text: 'Score',
  style: { fill: '#e8ecf8', fontFamily: 'Arial, sans-serif', fontSize: 24 },
});
```

`eventMode` is a string.

- `none` skips the node.
- `passive` lets children receive events.
- `static` receives taps. The sample input plane uses this and listens for `pointermove` and `pointertap`.
- `dynamic` also receives mock pointer events from the ticker when the pointer is still, so a moving target can react. Use it only for that case.

## Time

Rules advance through `startFixedStepLoop` in `src/game/mygame/engine`. Follow `.agents/recipes/ecs.md`. Do not put rules in `app.ticker`.

A pop, a banner, or a move-in is `gsap` on the `Container`. Kill those tweens before destroy.

## Teardown

Kill tweens. Remove the display object. Destroy it. Then unload the bundle. Unload while a sprite still holds the texture throws on `alphaMode`. That order is in `src/game/mygame-contract.ts`.

`app.destroy(true, { children: true })` removes the canvas and the children. `Application.d.ts` also accepts `{ removeView: true }`. Do not pass `texture: true` for an atlas the asset coordinator still owns.

## VFX

Call `createParticleRuntime(app)` from `src/core/systems/vfx/particleRuntime.ts`. Feed it VFX json whose textures were published. Do not add a second particle engine. Do not edit that file. It lives in `src/core/`.

`ParticleContainer` in v8 needs `boundsArea` and `addParticle`. Particles are not scene-graph children. Use the runtime first.

## Stage fit

Lay the scene out in design px inside a `DesignLayer` from `@wolfgames/components/pixi`. It defaults to `DESIGN_CANVAS`, the canvas every Wolf screen uses. Wire resizes with `trackHostBox(app, hostElement, [layer])`, passing the element `init` receives, and call the returned stop function in `destroy`. Do not write `Math.min(w / DESIGN_W, h / DESIGN_H)`. Section 9.2a of `node_modules/@wolfgames/components/docs/standards/components.md` has the full API.

The template predates this. It fits its own `DESIGN_W` by `DESIGN_H` box from `src/game/mygame/config.ts` by hand in `src/game/mygame/screens/gameController.ts`. Do not copy that fit into new scene code. Read the canvas size from `DESIGN_CANVAS` in `@wolfgames/components/core` wherever the sim or the view needs it. Do not redeclare it.

## Performance

Aim for 60 fps on desktop and modern phones and hold at least 30 on older phones. In dev, read `app.ticker.FPS`. When frames drop, check filters and particle count first.

- Pack art into atlases. One sheet is one texture bind. Get frames with `deps.coordinator.getGpuLoader()?.createSprite(sheet, frame)` or `getTexture(sheet, frame)`.
- Pool anything spawned often. Reset and reuse it instead of destroying and creating it. Allocate nothing per frame: no `new Graphics()`, `new Text()`, or object literals inside a render or system loop.
- Each filter adds a render pass. A mask adds a stencil pass. Prefer a pre-baked texture, `tint`, or `alpha`. Put a filter on the smallest object that needs it, and set `filters` to `null` when done.
- Keep container nesting shallow. Set `maxParticles` low in each VFX config. The runtime default in `src/core/systems/vfx/types.ts` is high.
- A static subtree that is costly to draw, such as HUD chrome, can call `container.cacheAsTexture(true)`. Call `container.updateCacheTexture()` after a change. Call `cacheAsTexture(false)` once it changes every frame.
- A container with no interactive children gets `eventMode = 'none'` and `interactiveChildren = false`, so hit tests skip it.
- A number that animates uses `BitmapText`. `Text` rasterizes and uploads a texture on every change. Section 8 of `node_modules/@wolfgames/components/docs/standards/components.md` has the rest.

Culling needs the plugin, registered before `app.init`.

```ts
import { CullerPlugin, extensions, Rectangle } from 'pixi.js';
import { DESIGN_CANVAS } from '@wolfgames/components/core';

extensions.add(CullerPlugin);
// after init, on each object that can leave the screen
sprite.cullable = true;
// optional: with layer.cullable = true, test the layer against this rect instead of its bounds
layer.cullArea = new Rectangle(0, 0, DESIGN_CANVAS.width, DESIGN_CANVAS.height);
```

Unload a level's bundle through the coordinator before loading the next one. Textures are not garbage collected.

```ts
deps.coordinator.unloadBundle('scene-level-1');
await deps.coordinator.loadBundle('scene-level-2');
```

Do not call `Assets.unload` or `texture.destroy` on art the coordinator owns.

Pixi owns the canvas. Do not call `getContext('2d')`, do not set `canvas.style` sizes, and do not add a second canvas. Resize through `trackHostBox`, called after `await app.init`. For a snapshot, call `app.renderer.extract.canvas(container)` between frames. Do not call `toDataURL` during play.

To profile, open Chrome DevTools, then Performance, and record 5 to 10 seconds of play. Look for frames over 16 ms and a sawtooth in the memory track. In Memory, take a heap snapshot, restart the level, and take another. Growth means a sprite, tween, or listener leaked.

## Screens

Files in `src/game/screens` are Solid shells. `setupGame` mounts the Pixi canvas. `deps.goto` changes screens. Do not construct a second `Application` for results.

The file that owns `setupGame` follows `.agents/skills/game-controller/SKILL.md`.
