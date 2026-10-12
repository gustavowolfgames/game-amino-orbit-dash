# Animation

GSAP patterns for in-scene motion on Pixi display objects. Rules stay in ECS, see `.agents/recipes/ecs.md`. A tween only moves the view.

This repo does not register GSAP's PixiPlugin, so a `pixi: {}` tween does nothing. Tween the display object's own properties: `sprite` for `x`, `y`, `alpha`, `rotation`, and `sprite.scale` for `x` and `y`.

Check the catalog first. `applyMotion` in `@wolfgames/components/modules/logic/motion-presets` covers float, breathe, pulse, sway, drift, and flicker. The count-up primitive covers score counters. See `.agents/recipes/components.md`.

## Easings

| Feel | Ease | Use for |
| --- | --- | --- |
| Snappy | `power2.out` | UI |
| Bouncy | `back.out(1.7)` | Pop-ins |
| Elastic | `elastic.out(1, 0.5)` | Playful feedback |
| Heavy | `power3.out` | Large objects |
| Smooth | `sine.inOut` | Camera, idle loops |
| Punch | `power4.out` | Impacts |

## Kill before destroy

Kill every tween on an object before you remove and destroy it. The object and its `scale` are separate targets.

```ts
gsap.killTweensOf(sprite);
gsap.killTweensOf(sprite.scale);
sprite.parent?.removeChild(sprite);
sprite.destroy({ children: true });
```

The controller kills its dot and banner tweens in `destroy` before `app.destroy`. It does not kill `banner.scale`, a known gap in the sample. Kill every tweened target, including nested ones like `sprite.scale`. The full teardown order is in `.agents/skills/pixi-gameplay/SKILL.md`.

## Await a tween

A GSAP tween is thenable, so you can `await` it. Wrap several tweens in one promise when the last one decides the end.

```ts
async function popIn(sprite: Container, delay = 0): Promise<void> {
  sprite.scale.set(0);
  sprite.alpha = 0;
  gsap.to(sprite, { alpha: 1, duration: 0.4, delay });
  await gsap.to(sprite.scale, { x: 1, y: 1, duration: 0.4, delay, ease: 'back.out(1.7)' });
}

async function popOut(sprite: Container): Promise<void> {
  gsap.to(sprite, { alpha: 0, duration: 0.25 });
  await gsap.to(sprite.scale, { x: 0, y: 0, duration: 0.25, ease: 'back.in(1.7)' });
}
```

A killed tween never resolves. Do not await a tween on an object that may be destroyed first.

## Common patterns

```ts
// Bounce for attention
gsap.to(sprite.scale, { x: 1.2, y: 1.2, duration: 0.15, ease: 'power2.out', yoyo: true, repeat: 1 });

// Shake for an error
const startX = sprite.x;
gsap.to(sprite, {
  x: startX + 5,
  duration: 0.05,
  repeat: 5,
  yoyo: true,
  ease: 'none',
  onComplete: () => {
    sprite.x = startX;
  },
});

// Pulse to highlight, two loops
gsap.to(sprite, { alpha: 0.5, duration: 0.3, repeat: 3, yoyo: true, ease: 'sine.inOut' });

// Float while idle. Keep the tween so you can kill it.
const float = gsap.to(sprite, { y: sprite.y - 10, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
```

## Stagger

One tween with `stagger` beats a loop of tweens. Pass the scale objects as targets.

```ts
sprites.forEach((s) => s.scale.set(0));
await gsap.to(
  sprites.map((s) => s.scale),
  { x: 1, y: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(1.7)' },
);
```

## Timeline

A timeline runs steps in order. The position argument overlaps them.

```ts
async function levelComplete(stars: Container[], banner: Container): Promise<void> {
  const tl = gsap.timeline();
  tl.from(stars.map((s) => s.scale), { x: 0, y: 0, duration: 0.3, stagger: 0.15, ease: 'back.out(2)' });
  tl.from(banner, { y: '+=50', alpha: 0, duration: 0.4, ease: 'power2.out' }, '-=0.1');
  await tl;
}
```

Kill a timeline with `tl.kill()` in teardown.

## Count up

Tween a plain object and write the text on update.

```ts
import { Text } from 'pixi.js';

async function countTo(label: Text, end: number, duration = 1): Promise<void> {
  const counter = { value: 0 };
  await gsap.to(counter, {
    value: end,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      label.text = String(Math.round(counter.value));
    },
  });
}
```

## Delays

Pace a bot move or a banner with `gsap.delayedCall`, not `setTimeout`. It runs on the GSAP timeline, so teardown can kill it. The pause screen does not stop it, and the sim advances on fixed steps, not on GSAP time.

```ts
const call = gsap.delayedCall(0.5, showBanner);
call.kill(); // in teardown
```

Use `overwrite: 'auto'` when a new tween may land on a property that is still animating.
