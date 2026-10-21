# Guardrails

Things that will break your game. If best-practices tells you what to do, this tells you what **not** to do — and why.

---

## 1. No DOM in Game Code

The single most common mistake. Once `initGpu()` fires, **everything renders on the GPU canvas**. DOM elements float above the canvas, ignore the scene graph, break hit-testing, and can't participate in Pixi's batched rendering.

| Don't | Why it breaks | Do instead |
|---|---|---|
| `document.createElement('div')` | Floats above canvas, invisible to Pixi | `new Container()` or `new Graphics()` |
| `element.textContent = 'Score'` | Can't batch with GPU sprites | `new Text({ text: 'Score', style: {...} })` |
| CSS `transition` / `@keyframes` | Runs on CPU, janky on mobile, no scene graph sync | `gsap.to(sprite, { ... })` |
| `element.style.opacity` | Triggers reflow/repaint outside GPU pipeline | `sprite.alpha = 0.5` |
| `element.addEventListener('click')` | Bypasses Pixi event system entirely | `sprite.on('pointertap', fn)` |
| `element.style.transform` | CPU compositor, can't batch | `sprite.scale.set(1.2)` / `sprite.position.set(x, y)` |
| `element.style.backgroundColor` | Not on canvas | `graphics.fill({ color: 0xff0000 })` |
| `element.style.borderRadius` | CSS-only concept | `graphics.roundRect()` or `graphics.circle()` |

**The only exception:** Solid.js screen shells (`src/game/screens/*.tsx`) and the pre-GPU loading screen are DOM. Everything inside `src/game/mygame/` is GPU-only.

---

## 2. Kill Your Animations

Orphaned GSAP tweens are silent memory leaks. They hold references to destroyed sprites, fire callbacks on dead objects, and accumulate until the game stutters.

| Don't | Do instead |
|---|---|
| Let tweens outlive their targets | `gsap.killTweensOf(target)` before destroying the target |
| Forget cleanup in `destroy()` | Kill all active tweens, remove listeners, destroy children |
| Create tweens in a loop without killing old ones | Use `overwrite: 'auto'` or kill before re-tweening |
| Fire-and-forget particle animations | Destroy the particle sprite in `onComplete` |

**Destruction order matters:**
```typescript
// ✅ Correct order
gsap.killTweensOf(sprite);       // 1. Kill tweens first
sprite.parent?.removeChild(sprite); // 2. Remove from scene graph
sprite.destroy({ children: true }); // 3. Destroy the object

// ❌ Wrong — tween fires on destroyed sprite → runtime error
sprite.destroy();
// gsap tween still running → "Cannot read properties of null"
```

---

## 3. Never Use `requestAnimationFrame` for Game Animation

GSAP handles the animation loop. Rolling your own `rAF` loop creates timing conflicts, bypasses GSAP's cleanup, and won't pause when the game pauses.

```typescript
// ❌ Don't
function animate() {
  sprite.x += 1;
  requestAnimationFrame(animate);
}

// ✅ Do
gsap.to(sprite, { x: targetX, duration: 0.5, ease: 'power2.out' });
```

Same goes for `setInterval` and `setTimeout` for animation — use GSAP's `delayedCall()` or timeline delays.

---

## 4. Don't Break the Event Tree

Pixi's event system propagates through the scene graph. One wrong `eventMode` on a parent container silently kills input for every child beneath it.

| Don't | Why it breaks | Do instead |
|---|---|---|
| `parent.eventMode = 'none'` when children are interactive | Kills ALL input for the entire subtree | `parent.eventMode = 'passive'` |
| Forget to set `eventMode` on interactive sprites | Sprite won't receive pointer events | `sprite.eventMode = 'static'` |
| Use `'dynamic'` everywhere "just in case" | Unnecessary overhead — fires `pointermove` constantly | Use `'static'` unless you need move events while not pressed |

**Correct layer setup:**
```typescript
app.stage.eventMode = 'static';
bgLayer.eventMode = 'none';       // no interactive children — safe
gameLayer.eventMode = 'passive';   // HAS interactive children
uiLayer.eventMode = 'passive';     // HAS interactive children
button.eventMode = 'static';      // receives taps
```

---

## 5. Wrong Asset Bundle Prefix = Silent Failure

The bundle prefix determines which loader handles the asset. Using the wrong prefix doesn't throw an error — the asset just never appears.

| Don't | What happens | Do instead |
|---|---|---|
| `theme-gems` for game sprites | DOM loader picks it up — Pixi never sees it | `scene-gems` |
| `boot-*` for in-game assets | Only available during splash, unloaded after | `scene-*` or `core-*` |
| Underscores in bundle names | Fails validation silently | Lowercase + hyphens only: `[a-z][a-z0-9-]*` |

**Prefix → Loader mapping:**
- `scene-*`, `core-*`, `fx-*` → **GPU (Pixi)** — use for game visuals
- `audio-*` → **Howler** — use for sound
- `theme-*`, `boot-*` → **DOM only** — pre-GPU screens only

---

## 6. Don't Create Objects Per Frame

Allocating objects inside `tick()` or render loops causes GC pressure and frame drops, especially on mobile.

```typescript
// ❌ Don't — new object every frame
tick() {
  const pos = { x: this.sprite.x, y: this.sprite.y };
  const color = new Color(0xff0000);
  // ...
}

// ✅ Do — reuse pre-allocated objects
private pos = { x: 0, y: 0 };
tick() {
  this.pos.x = this.sprite.x;
  this.pos.y = this.sprite.y;
}
```

For frequently spawned objects (particles, projectiles, tiles), use **object pooling** — create a fixed pool, recycle on "death" instead of destroying and re-creating.

---

## 7. Don't Use Individual Images

Loading 30 separate PNGs means 30 draw calls, 30 texture binds, and 30 HTTP requests. Use **texture atlases** (spritesheets).

```typescript
// ❌ Don't — individual images
{ name: 'scene-gem-red', assets: [{ src: 'gem-red.png' }] }
{ name: 'scene-gem-blue', assets: [{ src: 'gem-blue.png' }] }

// ✅ Do — single atlas
{ name: 'scene-gems', assets: [{ alias: 'scene-gems', src: 'atlas-gems-mygame.json' }] }
const sprite = gpuLoader.createSprite('scene-gems', 'gem_red');
```

---

## 8. Don't Modify `src/core/`

`src/core/` is the scaffold framework managed upstream by `game-components`. Editing it means:
- Your changes get overwritten on the next scaffold update
- You can't merge upstream fixes
- Other games can't benefit from your improvement

If you need something core doesn't provide, that's a `game-components` PR — not a local hack.

---

## 9. Don't Pollute Game State

`step(state, action)` must be a **pure function** — deterministic, no side effects.

| Don't | Why it breaks | Do instead |
|---|---|---|
| `Math.random()` in step | Non-deterministic — breaks replay, testing | Seeded RNG from state |
| Import Pixi in state logic | Couples rendering to logic | Keep state and rendering separate |
| Read DOM or window in step | Side effect — breaks SSR/testing | Pass values in via action payload |
| `let gameState: GameState \| undefined` | Cascading "possibly undefined" everywhere | `let gameState: GameState = createInitialState()` |

---

## 10. Don't Use the Wrong Framework Primitives

This scaffold uses **SolidJS** (not React, not Preact). Using the wrong framework's patterns causes subtle bugs or build failures.

| Don't | Do instead |
|---|---|
| Import from `'react'` or `'preact'` | Import from `'solid-js'` and `'solid-js/web'` |
| Destructure props: `({ score })` | Access as `props.score` (SolidJS tracks property access) |
| Expect components to re-run | Only signal reads in tracking scopes (JSX, `createEffect`) are reactive |
| Use `useState` / `useEffect` | Use `createSignal()` / `createEffect()` |
| Use zustand for state | Use SolidJS signals for cross-screen state |

---

## 11. Don't Use npm/yarn/pnpm

The project uses **bun** exclusively. Mixing package managers creates duplicate lockfiles and dependency resolution conflicts.

| Don't | Do instead |
|---|---|
| `npm install`, `yarn add`, `pnpm add` | `bun add` / `bun install` |
| Commit `package-lock.json` | Only `bun.lock` should exist |
| `npx` | `bunx` |

---

## 12. Don't Navigate to `game_over`

There is no `game_over` screen. The valid screen IDs are: **loading**, **start**, **game**, **results**.

```typescript
// ❌ Don't — screen doesn't exist, fails silently
goto('game_over');

// ✅ Do
goto('results');
```

---

## 13. Don't Use Expensive Pixi Features Carelessly

Some Pixi features are GPU-heavy and will tank mobile performance:

| Feature | Cost | Alternative |
|---|---|---|
| `filters` (blur, glow, etc.) | Very expensive — extra render pass per filter | Pre-bake effects into sprites, or use `tint` + `alpha` |
| `mask` | Extra draw call + stencil buffer | Crop sprites in the atlas, or use `graphics.roundRect()` |
| Deep container nesting | Each level adds transform matrix multiplications | Flatten hierarchy where possible |
| Unbounded particle count | GC pressure + draw calls | Cap at 50–80 concurrent particles |

**Performance budget:**
- Desktop: 60 FPS (16.6ms per frame)
- Modern mobile: 60 FPS (16.6ms)
- Older phones: 30 FPS (33.3ms)

Use `app.ticker.FPS` to monitor. If you're dropping frames, check particle count and filter usage first.

---

## 14. Don't Forget to Unload Assets

Loading level 2's assets without unloading level 1's doubles GPU memory. Textures don't garbage-collect automatically.

```typescript
// ✅ Unload before loading next level
coordinator.unloadBundle('scene-level-1');
await coordinator.loadBundle('scene-level-2');
```

---

## 15. Don't Ship Stubs or Placeholders

Code that reaches the build must be **complete and functional**. Not "technically compiles."

These are not acceptable:
- `// TODO: implement later`
- Empty function bodies
- Colored rectangles standing in for sprites
- Generic variable names (`data`, `thing`, `item`)
- Trivial test data where real level design belongs

If it's not ready, it's not in the build.

---

## 16. One Renderer Per Game — Unless You Opt Into Layered Mode

By default, pick one renderer (Pixi, Phaser, or Three.js) and commit. Accidentally mixing renderers creates competing draw loops, duplicate canvas elements, and unsolvable z-ordering problems.

| Don't | Why it breaks | Do instead |
|---|---|---|
| Import Phaser alongside Pixi by accident | Two animation loops fighting for the same frame budget | Pick one — or opt into layered mode deliberately (below). |
| Create an ad-hoc second `<canvas>` for custom drawing | Two GPU contexts = doubled memory, no shared textures | Use Pixi's `Graphics` API for custom shapes |
| Switch renderers mid-project | All visual code becomes throwaway | Commit at project kickoff, document in `config.ts` |

The default renderer is declared in `src/core/config.ts` (`engine: 'pixi'`).

### Sanctioned exception — layered rendering (`gameMode: 'layered'`)

A game **may** deliberately opt into a second GPU context over a single
container — either a full stack of render layers (e.g. a Three.js 3D layer over
a Pixi 2D layer, or a Pixi layer over a DOM layer) or a bounded embedded 3D
widget (e.g. a dice roller inside an otherwise-2D game) — but only under these
invariants:

- **Compose layers, don't hand-roll stacked `<canvas>` elements.** Each context
  gets one absolutely-positioned container with explicit stacking order,
  pointer-events, and strict reverse-order teardown (including an async-init
  guard so a layer that is still mounting is still cleaned up). The reference
  helper for this is `composeLayers` — it is **not shipped in the template**;
  incubate it per-game under `src/game/<gamename>/` (per the `component-authoring`
  rule) and promote it to `@wolfgames/components` once it has held its shape
  across 2+ games. The canonical implementation and worked example live in the
  design doc (see below).
- **Every layer/widget projects the same ECS world.** ECS stays the single
  source of truth; a layer is a read-only projection, never a second game-state
  store. Two layers must never both write gameplay state. In particular, any
  presentation physics in a 3D layer (a dice tumble, cloth, debris) is
  choreographed to an outcome already decided in ECS via seeded RNG
  (guardrail #9) — never read the gameplay result back out of the sim. Only one
  *authoritative* physics engine per game.
- Each context runs its own draw loop and holds its own WebGL context; budget
  accordingly. The browser caps live WebGL contexts (~8–16 on desktop, fewer on
  mobile) — prefer in-canvas layering (Pixi containers, a Three.js viewport
  inside the existing canvas) and reach for a second real context only when the
  engines genuinely differ. Justify it, and hold the mobile FPS targets (60 fps
  on modern phones, 30 on older ones). Avoid on mobile-first titles.
- Only one layer owns pointer input for a given region (decorative upper layers
  set pointer-events to `none`). Don't stack two interactive layers.

See the layered-rendering design doc — [Layered rendering: bundle cost &
composeLayers vs. embedded canvas](https://app.notion.com/p/3d74a3377199811c9b5fc4098c187fe0?pvs=204)
— for the canonical `composeLayers` implementation, the worked layered/embedded
examples, the layer-authoring do/don't table, and the bundle-cost analysis. If
you are not explicitly building a layered game, guardrail #16's default still
applies: one renderer.

---

## 17. Don't Touch the Canvas Directly

The renderer owns the `<canvas>` element. Manipulating it via DOM APIs or raw Canvas 2D breaks the rendering pipeline.

| Don't | Why it breaks | Do instead |
|---|---|---|
| `canvas.getContext('2d')` | Conflicts with Pixi's WebGL/WebGPU context | Use `new Graphics()` for shapes |
| `ctx.fillRect()` / `ctx.drawImage()` | Bypasses Pixi's batching, won't composite correctly | Use `Sprite` or `Graphics` |
| `canvas.style.width = '...'` | Overrides Pixi's resolution scaling | Use `app.renderer.resize()` or `resizeTo` |
| `canvas.toDataURL()` during gameplay | Blocks the GPU pipeline, causes frame drops | Use `app.renderer.extract.canvas()` between frames |

Pixi negotiates the best available backend automatically: **WebGPU → WebGL 2 → WebGL 1 → Canvas 2D** fallback. Let it handle the graphics context.

---

## 18. Destroy in the Right Order

Destroying objects out of order causes "cannot read property of null" errors from orphaned references.

```typescript
// ✅ Correct destruction order
function destroyEntity(sprite: Container) {
  // 1. Kill animations (they hold refs to the sprite)
  gsap.killTweensOf(sprite);

  // 2. Remove event listeners
  sprite.removeAllListeners();

  // 3. Remove from scene graph
  sprite.parent?.removeChild(sprite);

  // 4. Destroy the object (and children)
  sprite.destroy({ children: true });
}

// ✅ Correct screen/level teardown
function teardownLevel(container: Container) {
  // 1. Kill ALL tweens on all children
  gsap.killTweensOf(container.children);

  // 2. Destroy the container tree
  container.destroy({ children: true });

  // 3. Unload textures for this level
  coordinator.unloadBundle('scene-level-1');
}
```

**Never** destroy a texture that's still referenced by a sprite. **Never** destroy a sprite that still has active tweens. The order matters.

---

## 19. No Gameplay State Outside ECS

Ad-hoc signals and closure variables for game state make the game invisible
to the Inspector, undriveable by bots/tests, and force a painful ECS retrofit
later. ECS is the **single source of truth** — there is no signals "clipboard."

| Don't | Do instead |
|---|---|
| `createSignal` for score/moves/phase | ECS resources; a DOM screen reads them directly or mirrors a resource observable into a signal for JSX |
| Mutating state from anywhere | Write only via `db.transactions.*` (composed in turn functions/systems) |
| A second write path (controller callbacks setting signals) | One path: game logic writes ECS; DOM reads ECS |
| Creating/disposing the world in a screen's init/destroy | The world is **app-scoped** (`world.ts` → `getGameWorld()`); it survives across screens, so the results screen reads the final score straight from ECS |

The world in `src/game/mygame/sim/` is pre-wired — extend it.
Guide: [state-architecture.md](../guides/state-architecture.md).

---

## 20. Match the Update Cadence to the Game

Per-frame is **supported, not mandatory.** Both cadences write the same ECS
through the same transactions — the mistake is using the wrong one, or mixing
raw timing primitives into the deterministic path.

| Don't | Why it breaks | Do instead |
|---|---|---|
| Put a turn-based game (tap / match / trivia / card) on a frame loop | Wastes battery, invites per-frame allocation, adds nondeterminism for no gain | Resolve the turn synchronously on input via `applyTap(db, {col,row})`; observers repaint. **No scheduler.** This is the template default. |
| Feed raw frame deltas to `stepWorld` | Continuous integration (velocity, orbit, physics) is only stable and replayable at a constant step | Accumulate real time and spend it in fixed steps via `startFixedStepLoop(engine, dt => stepWorld(db, dt))` (`engine/fixedStep.ts`) |
| `requestAnimationFrame` / `setInterval` to drive the sim | Bypasses the engine seam and GSAP pause; can't be stepped headlessly | Go through the `EngineHandle` seam (`createTickerEngine()`); no raw rAF in game code |
| Resolve a turn inside the pointer callback in a real-time game | Input lands off the deterministic timeline | Queue it as an intent (`db.transactions.submitSwipe(...)` → a `pendingSwipes` resource); the first system drains it next step |
| Let an external physics engine hold its own authoritative state | Two sources of truth drift | Bridge it as ONE per-frame system: push ECS→engine, step with the fixed `dt`, write bodies back into ECS |
| `Math.random()` / `Date.now()` inside a transaction, turn function, or system | Breaks replay and headless tests | `dt` and input arrive as injected resources (`frameDeltaMs`, an intent queue); seeds passed as args |

Decision rule: *does this state change when no event occurs?* **Yes** → per-frame
system. **No** → event → transaction. Real-time pieces (`schedule.ts`,
`systems/`, `engine/`, `fixedStep.ts`) ship ready to extend.
Guide: [state-architecture.md](../guides/state-architecture.md), deep reference
[`src/game/mygame/sim/README.md`](../../src/game/mygame/sim/README.md).

---

## 21. No Hand-Rolled Components Before a Catalog Check

Rebuilding what `@wolfgames/components` already ships wastes the session and
produces worse, untested duplicates of tuned, token-bound modules.

The catalog check is a required step, and it triggers on the ARTIFACT, not
the word "component": before creating or adding a HUD, button, menu, screen
(start / loading / results / settings / win / lose), background, dialogue
box, popup, progress bar, timer, overlay, character display, level/scene
picker, tutorial hint, effect layer, or any other visual or logic element,
check `node_modules/@wolfgames/components/src/modules/catalog.json` (fallback `INDEX.md`; ~80
modules). If a module is close, configure or wrap it in `src/game/`; don't
fork it.

The check leaves evidence: state which modules you considered and why none
fit before writing new code. A review that can't find that statement treats
the element as unchecked.
Guide: [shared-components.md](../guides/shared-components.md).

---

## 22. No Committed Game Media

Committing generated art/audio bloats the repo (a past game hit 106MB), skips
compression, and bypasses CDN caching — load times suffer on every player's
first visit.

| Don't | Why it breaks | Do instead |
|---|---|---|
| Ship PNGs/MP3s from `public/assets/` | Bundled into every build, no CDN cache, repo bloat | Generate via wolf-game-kit MCP → stage in `assets/src/` → `bun run assets:publish` |
| Hardcode `media.qa.wolf.games/...` URLs in `src/` | Env-locked (QA URLs in prod), bypasses the manifest/loader and preloading | Register in `asset-manifest.ts` with lockfile keys; CdnManifestProvider resolves hosts |
| Reference asset-gen result `cdnUrl`s at runtime | Opaque, unmanaged provenance URLs | Download, stage, publish through the pipeline |
| Draw "temporary" art or synthesize audio in code because asset gen isn't set up | Hides a setup problem behind placeholder quality that ships (see #15) | Tell the user what's missing (MCP config, and the key for the environment they are signed into — `PROD_ASSET_GEN_API_KEY` or `QA_ASSET_GEN_API_KEY`) and wait, or use the documented local fallback; placeholders only with their explicit OK, flagged for replacement |

Committed exceptions: fonts, favicon, tuning/VFX config JSON, the boot chrome
the template already ships (existing files only — adding a new "proxy"
file needs the same explicit approval as any placeholder), and size-budgeted
local-mode iteration assets, which move to `assets/src/` + CDN before release.
Full workflow and the local-fallback rules:
[asset-pipeline.md](../recipes/asset-pipeline.md).

---

## Quick "Am I About to Break Something?" Checklist

- [ ] Am I creating a DOM element inside `src/game/mygame/`? **Stop.**
- [ ] Am I using CSS transitions for game visuals? **Use GSAP.**
- [ ] Does my `destroy()` kill all tweens and remove all children? **It must.**
- [ ] Did I set a parent container to `eventMode = 'none'` with interactive children? **Use `'passive'`.**
- [ ] Is my asset bundle prefix correct for the loader I need? **Check the table.**
- [ ] Am I editing anything in `src/core/`? **Don't.**
- [ ] Am I using `Math.random()` in game state logic? **Use seeded RNG.**
- [ ] Am I importing from `'react'`? **Use `'solid-js'`.**
- [ ] Am I running `npm install`? **Use `bun`.**
- [ ] Am I creating objects inside `tick()`? **Pre-allocate or pool.**
- [ ] Am I importing a second renderer (Phaser + Pixi) *by accident*? **Pick one** — or opt into `gameMode: 'layered'` deliberately via `composeLayers` (guardrail #16).
- [ ] Am I calling `canvas.getContext('2d')` directly? **Use Pixi's Graphics API.**
- [ ] Am I destroying sprites before killing their tweens? **Tweens first, then destroy.**
- [ ] Am I putting game state in signals or closures instead of ECS? **Write ECS via transactions; DOM reads ECS.**
- [ ] Am I putting a turn-based game on a frame loop, or feeding raw deltas to `stepWorld`? **Turn-based = `applyTap` on input; real-time = fixed `dt` via `startFixedStepLoop`.**
- [ ] Am I writing a component without checking the `@wolfgames/components` catalog? **Check first.**
- [ ] Am I committing game media or hardcoding CDN URLs? **Generate → stage → `bun run assets:publish`; commit the lockfile, not the media.**
