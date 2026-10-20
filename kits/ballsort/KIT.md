# Kit: ball sort

A working ball sort on this template: tubes of 4 balls, one full tube per
colour plus 2 empty ones, tap a tube to lift its top ball and tap another to
drop it. A drop is legal onto an empty tube or the same colour with room; an
illegal drop puts the ball back. Complete tubes turn green. 3 undos per level,
Restart, a "No moves left" Retry, seeded levels that are always solvable,
3 levels (4, 5, 7 colours) and results with stars from par. It passes
`check:agent`, `typecheck:baseline`, `test:run` and `build` as installed.

Install: `bun run add-kit ballsort`. Then change it into the game you were
asked for. Don't rebuild what is already here.

## How a move flows

```
input/pointer.ts           tap → submitTap (design-space point); Undo / Restart buttons → a command
sim/systems/systemInput.ts first in SYSTEM_ORDER: a command runs undo / restartLevel;
                           else the tap goes to tubeAt (sim/rules/layout.ts) → tapTube
sim/plugin.ts tapTube      nothing held: lift the top ball (heldTube). Same tube: put it back.
                           Other tube: canDrop ? move it, push history, moves += 1 : put it back.
                           Then settle(): mark done tubes, set won / stuck
sim/rules/ballSort.ts      PURE: canDrop, applyMove, isTubeComplete, isWon, legalMoves,
                           solve (BFS), generateBoard (seeded shuffle kept only if solve finds a way)
render/BoardView.ts        reads Ball / Tube entities every frame; a ball whose tube, slot or
                           lift changed tweens there (lift → across → down). `busy` blocks input.
render/Controls.ts         the HUD (LEVEL / MOVES / UNDOS), Undo / Restart buttons and the
                           "No moves left" Retry (Pixi)
```

Balls are entities (`tube`, `slot`, `color`); tubes are entities (`tubeIndex`,
`done`). `readBoard` rebuilds the plain `number[][]` board from them, so the
rules never touch ECS. Undo keeps a `history` of moves in a resource and
plays the last one backwards.

## Where to change what

| To change | Edit |
|---|---|
| Tube size, empty tubes, undos | `TUBE_CAPACITY`, `EMPTY_TUBES`, `UNDOS_PER_LEVEL` in `sim/rules/ballSort.ts` (layout follows `TUBE_CAPACITY`) |
| What a move is | `canDrop` / `applyMove` / `legalMoves` in `sim/rules/ballSort.ts`, and `moveBall` + `tapTube` in `sim/plugin.ts` (it moves one ball entity today) |
| Per-ball state | add a component on Ball, set it in `buildBoard`, update it in `tapTube` / `settle`; draw it in `BoardView` |
| Win / lose | `settle` in `sim/plugin.ts` sets `phase` `won`, and `stuck` |
| Generator, solvability | `generateBoard` and `solve` in `sim/rules/ballSort.ts`. `solve` is a BFS capped at `maxStates`; keep it cheap if moves get richer |
| Level fields (colours, par, …) | `schemas/levels/schema.ts`, defaults in `src/game/content/level.ts`, levels in `src/game/content/packs/default.json`, passed to `startRun` in `screens/gameController.ts` |
| HUD, buttons | `render/Controls.ts` for the label or button, a command in `systemInput`, a transaction in `sim/plugin.ts` |
| Layout, sizes, rows | `sim/rules/layout.ts` (`tubeRects` wraps tubes into rows; `tubeAt` is the hit test) |
| Colours | `BALL_COLORS` in `render/BoardView.ts` (up to 7) |
| Stars | `starsFor` in `sim/rules/ballSort.ts`; results in `src/game/screens/ResultsScreen.tsx` |

## Tests

`tests/unit/ballSort.test.ts`: legal and illegal drops, complete tubes, the
win check, undo, restart, stuck detection, and that every pack level
generates and solves. Change them with the rules; add one for each new rule.
