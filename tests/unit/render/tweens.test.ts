/**
 * killTree (src/game/mygame/render/tweens.ts): every tween on a display tree stops before it is
 * destroyed, including those on a child, a scale and a position.
 */

import gsap from 'gsap';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { killTree } from '~/game/mygame/render/tweens';

describe('killTree', () => {
  it('kills tweens on the node, its scale and position, and every descendant', () => {
    const root = new Container();
    const child = new Container();
    const grandchild = new Container();
    child.addChild(grandchild);
    root.addChild(child);
    const tweens = [
      gsap.to(root, { alpha: 0, duration: 10 }),
      gsap.to(root.position, { x: 50, duration: 10 }), // a shake
      gsap.to(child.scale, { x: 2, duration: 10 }), // a pop
      gsap.to(grandchild, { rotation: 1, duration: 10 }),
    ];
    for (const t of tweens) expect(t.isActive() || t.progress() < 1).toBe(true);

    killTree(root);

    for (const target of [root, root.position, child.scale, grandchild])
      expect(gsap.isTweening(target)).toBe(false);
    expect(gsap.getTweensOf([root, child.scale, grandchild])).toEqual([]);
    root.destroy({ children: true });
  });

  it('leaves other trees alone', () => {
    const a = new Container();
    const b = new Container();
    const kept = gsap.to(b, { alpha: 0, duration: 10 });
    killTree(a);
    expect(gsap.getTweensOf(b)).toEqual([kept]);
    kept.kill();
  });

  it('is safe on a tree that is already destroyed', () => {
    const root = new Container();
    root.addChild(new Container());
    root.destroy({ children: true });
    expect(() => killTree(root)).not.toThrow();
  });
});
