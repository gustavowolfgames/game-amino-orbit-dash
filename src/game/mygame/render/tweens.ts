/**
 * tweens — kill every GSAP tween on a display tree before it is destroyed.
 *
 * `gsap.killTweensOf(node)` only stops tweens whose target is that node. A tween on a child, or
 * on a node's `scale` / `position` (a pop, a shake), keeps running and writes into a destroyed
 * object on its next tick. Call `killTree` first, then `destroy({ children: true })`.
 */

import gsap from 'gsap';
import type { Container } from 'pixi.js';

/** Kill the tweens of `node`, its `scale` and `position`, and those of every descendant. */
export function killTree(node: Container): void {
  gsap.killTweensOf(node);
  if (node.destroyed) return; // its scale, position and children are gone with it
  gsap.killTweensOf(node.scale);
  gsap.killTweensOf(node.position);
  for (const child of node.children) killTree(child as Container);
}
