# rules: the game's rules as pure functions

A rule is a plain function from values to a value: scoring, matching, whether a
move is legal, what a level spawns. No ECS, no Pixi, no randomness of its own
(take an rng state as an argument and return the next one). Systems and
transactions call rules; tests call them directly.

```ts
// check: scoring.ts
/** Points for clearing `count` pieces at once: bigger groups score more than linearly. */
export function pointsFor(count: number): number {
  return count < 2 ? 0 : count * count * 10;
}
```

```ts
// tests/unit/rules.test.ts
expect(pointsFor(3)).toBe(90);
```

Tuning numbers that never change per level (speeds, sizes, limits) go here as
named constants. Numbers that change per level go in the level shape
(`schemas/levels/schema.ts`), so a content person can edit them.
