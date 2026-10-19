# Kit: match-3

A working match-3 on this template: an 8×8 board of 5 colours, swap by drag or
tap-tap, runs of 3+ clear, tiles fall and refill, chains score ×1, ×2, ×3…,
a move budget and a colour goal per level, 3 levels, results with stars. It
passes `check:agent`, `typecheck:baseline`, `test:run` and `build` as installed.

Install: `bun run add-kit match3`. Then change it into the game you were asked
for. Don't rebuild what is already here.

## How a move flows

```
input/swap.ts            drag or tap-tap → onSwap(a, b)
sim/turn.ts  applySwap   reads the board from ECS, calls resolveSwap, commits it
sim/rules/board.ts       resolveSwap: PURE. swap → find runs → clear → fall → refill → repeat
                         returns a SwapRuling: valid, steps[] (cleared, falls, spawns, points per chain)
sim/plugin.ts commitMove writes the settled board, rng, score, moves, goal progress, won / lost
render/BoardView.ts play animates the ruling step by step (swap or swap-back, clear, fall, refill)
                         then re-syncs from ECS. `busy` blocks input while it plays.
```

Turn-based: no systems in `SYSTEM_ORDER`. The fixed-step loop still runs, so a
system added there (a timer, a spawner) just works.

## Where to change what

| To change | Edit |
|---|---|
| Board size | `BOARD_SIZE` in `sim/rules/board.ts` (square; split into cols/rows for a non-square board: `indexOf`, `cellOf`, the loops, `BoardView`'s `TileGrid`) |
| Colours | `COLOR_NAMES` (`sim/rules/board.ts`) and `TILE_COLORS` (`render/BoardView.ts`), same order |
| What a match is / special tiles | `findMatches` and the clear in `resolveSwap`: anything you add to a step's `cleared` cells, `falls` and `spawns` animates for free |
| Scoring, stars | `sim/rules/scoring.ts` (`pointsFor`, `STAR_THRESHOLDS`) |
| Win / lose | `commitMove` in `sim/plugin.ts` (goal reached → `won`, moves out → `lost`) |
| Level fields (goal, moves, …) | `schemas/levels/schema.ts`, defaults in `src/game/content/level.ts`, levels in `src/game/content/packs/default.json`, passed to `startRun` in `screens/gameController.ts` |
| HUD | `render/GameHud.ts` |
| Results screen | `src/game/screens/ResultsScreen.tsx` |
| Animation timing | constants at the top of `render/BoardView.ts` |

## Tests

`tests/unit/match3.test.ts`: board generation, matching, swap and swap-back,
cascades and chain scoring, commitMove's win and lose. Change them with the
rules; add one for each new rule.
