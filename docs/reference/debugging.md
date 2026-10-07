# Debugging

Where to look when the game misbehaves. Rules live in `.agents/recipes/`. Proof that a change works is `.agents/recipes/verify.md`.

## Game state

Gameplay state is the ECS world. Read it before you guess.

- `getGameWorld()` in `src/game/mygame/world.ts` returns the app-scoped world. `getGameWorld().resources.score` and `getGameWorld().resources.phase` are the live values.
- `world.ts` binds that world to the dev Inspector with `setActiveDb`. The Inspector lists entities, resources, systems, and archetypes, and refreshes twice a second while the panel is open.
- In dev, the backtick key toggles the Inspector. The Tweakpane tuning panel in `src/core/dev/TuningPanel.tsx` is not mounted. The key handler has no focus guard, so a backtick typed in the Inspector filter closes it. Production builds do not include it.
- The panel is not proof. A value you see there, or change there, does not show the rules work. Proof is a unit test that calls the transaction, or a value read from `getGameWorld()`.
- The controller registers dev buttons with `setActiveInspectorActions` and clears them with `setActiveInspectorActions([])` in `destroy`.

A headless check needs no screen. `tests/unit/schedule.test.ts` creates a world, pumps `stepWorld(db, dt)`, and asserts resources.

## Pixi DevTools

The PixiJS DevTools browser extension finds the app through a global. Set it in dev only.

```ts
if (import.meta.env.DEV) {
  (globalThis as any).__PIXI_APP__ = app;
}
```

It shows the display tree, lets you toggle visibility, and lists textures.

## Sprite not showing

| Symptom | Check | Fix |
| --- | --- | --- |
| Nothing drawn | `sprite.visible`, `sprite.alpha` | Set `true` and `1` |
| Blank or missing texture | Bundle not loaded yet | Await the load before you make the sprite |
| Wrong place | Parent transform | Log `sprite.getGlobalPosition()` |
| Behind something | Draw order | `parent.sortableChildren = true`, then set `zIndex` |

```ts
console.log({
  visible: sprite.visible,
  alpha: sprite.alpha,
  position: sprite.getGlobalPosition(),
  bounds: sprite.getBounds(),
});
```

Frame names are case sensitive and include the extension. `road.png` is not `Road.png` or `road`.

New game art comes from the CDN lockfile. Only the template's boot, theme, and settings art is served from `public/assets/`. A 404 on art usually means the key is missing from the lockfile `assets/asset-manifest.cdn.json`, or no publish has run yet. The first publish creates that file. See `.agents/recipes/assets.md`. Run the dev server, never `file://`, or the browser blocks the fetch with a CORS error.

## Input not working

```ts
import { Rectangle } from 'pixi.js';

console.log({ eventMode: sprite.eventMode, hitArea: sprite.hitArea });
sprite.hitArea = new Rectangle(0, 0, 100, 100); // test a known area
container.interactiveChildren = false; // test whether a child blocks it
```

`eventMode` must be `static` or `dynamic` for taps. Listen for `pointertap`, not `click`. The modes are in `.agents/skills/pixi-gameplay/SKILL.md`.

## GSAP

```ts
gsap.globalTimeline.paused(); // true means everything is frozen
gsap.getTweensOf(target); // what is running on this object
gsap.killTweensOf(target); // clear a stuck tween
```

A tween on `sprite.scale` is a separate target from `sprite`. Kill both.

## Audio

| Symptom | Cause | Fix |
| --- | --- | --- |
| Silent on mobile | Audio not unlocked | The start screen Play button calls `unlockAudio()` in `src/game/mygame/screens/startView.tsx`. The loading screen skip path calls it too. Keep both |
| Music silent, no error | Music is off in settings | `startMusic` returns early when `audioState.musicEnabled()` is false. See `docs/reference/audio.md` |
| `play` of undefined | Played before its bundle loaded | Await `loadBundle` first |
| Late or stuttering | Loaded on demand | Preload the audio bundle before play and use audio sprites |

## Screens

A blank screen after `goto` usually means the id is wrong. `goto` takes `loading`, `start`, `game`, or `results`, the keys of `gameConfig.screens` in `src/game/config.ts`.

State that resets between screens is not a screen bug. Gameplay state lives in the app-scoped world, so the results screen reads `getGameWorld().resources.score`. Do not add a signal to carry it.

## Tuning

A tuning value that changes but does nothing is not read reactively. Read it when the level starts. `WIRED_GAME_PATHS` in `src/core/dev/tuningRegistry.ts` only colors unwired paths in the unmounted Tweakpane panel.

Stored tuning can go stale. The storage keys are `STORAGE_KEYS` in `src/core/systems/tuning/loader.ts`. Remove the game key in the console when the tuning shape changes. Leave the scaffold key.

## Performance

1. Watch `app.ticker.FPS` for a few seconds.
2. Record in the Chrome Performance tab.
3. For a leak, take a heap snapshot before and after a level in the Memory tab, then compare retained Pixi objects.

`app.renderer.texture.managedTextures.length` counts textures on the GPU. A count that grows every level is a leak.

Usual causes of a leak:

- A display object never destroyed. Call `container.destroy({ children: true })`.
- A listener left behind. Call `sprite.removeAllListeners()` and remove window listeners.
- A tween still alive. Kill it before destroy.

Publish encodes oversized images, except files above the encoder limit in `docs/reference/asset-pipeline.md`. Shrink those before staging.

## Mobile

Notches use the `.safe-area-inset` class in `src/app.css`, which pads all four sides with the `env(safe-area-inset-*)` values.

## Logging

Prefix each log with its area so you can filter.

```ts
console.log('[GameScreen] level loaded', level);
console.error('[Assets] load failed', error);
```

Remove debug logs before ship.
