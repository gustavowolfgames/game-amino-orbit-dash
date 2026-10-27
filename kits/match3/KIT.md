# Kit: match-3

A working match-3 on this template: an 8×8 board of 5 colours, swap by drag,
tap-tap or keys, runs of 3+ clear, tiles fall and refill, chains score ×1, ×2,
×3…, a move budget and a colour goal per level, 3 levels, results with stars.
It passes `check:agent`, `typecheck:baseline`, `test:run` and `build` as
installed.

Install: `bun run add-kit match3`. Then change it into the game you were asked
for. Don't rebuild what is already here.

## How a move flows

```
input/swap.ts            drag or tap-tap (Pixi stage), or a key intent → onSwap(a, b)
  keys: useGameKeyboard → controller.input(intent) → swapInput.key(intent)
        arrows move a cursor; Space/Enter picks a tile; an arrow then swaps it that way
sim/turn.ts  applySwap   reads the board (sim/tiles.ts readBoard), calls resolveSwap,
                         commits it with commitMove, returns the ruling
sim/rules/board.ts       resolveSwap: PURE. swap → find runs → clear → fall → refill → repeat
                         returns a SwapRuling: valid, steps[] (cleared, falls, spawns, points per chain)
sim/plugin.ts commitMove writes the settled board, rng, score, moves, goal progress, won / lost,
                         and emits events: `scored` per cascade step, `rejected`, `reshuffled`, `phase`
render/BoardView.ts play animates the ruling step by step (swap or swap-back, clear, fall, refill)
                         then re-syncs from ECS. `busy` blocks input while it plays.
screens/gameController   render(): views update from ECS, then drainEvents → cue table
                         (sfx-pop per move, sfx-clear on a win, the screen-reader line);
                         once the board settles, a won/lost phase shows a banner and moves on
```

Turn-based: no systems in `SYSTEM_ORDER`. The fixed-step loop still runs, so a
system added there (a timer, a spawner) just works.

The world is app-scoped (`world.ts` `getGameWorld()`): the results screen reads
the final score from it. Between levels the game screen plays straight on; the
last win and a loss go to results.

## Where to change what

| To change | Edit |
|---|---|
| Board size | `BOARD_SIZE` in `sim/rules/board.ts` (square; split into cols/rows for a non-square board: `indexOf`, `cellOf`, the loops, `BoardView`'s `TileGrid`) |
| Board geometry on screen | `CELL_SIZE`, `CELL_GAP`, `TILE_SIZE` in `render/BoardView.ts` (design px on the 390×844 `DESIGN_CANVAS`); placement in the controller's `buildScene` |
| Colours | `COLOR_NAMES` (`sim/rules/board.ts`) and `TILE_COLORS` (`render/BoardView.ts`), same order |
| What a match is / special tiles | `findMatches` and the clear in `resolveSwap`: anything you add to a step's `cleared` cells, `falls` and `spawns` animates for free |
| Scoring, stars | `sim/rules/scoring.ts` (`pointsFor`, `STAR_THRESHOLDS`) |
| Win / lose | `commitMove` in `sim/plugin.ts` (goal reached → `won`, moves out → `lost`) |
| Sounds, screen-reader lines | a new event in `GameEvent` (`sim/plugin.ts`), `emit` it in a transaction, a row in the controller's cue table (`createCues`); channels in `SOUNDS` |
| Keys | `key` in `input/swap.ts` (intents come from `src/game/screens/useGameKeyboard.ts`) |
| Level fields (goal, moves, …) | `schemas/levels/schema.ts`, defaults in `src/game/content/level.ts`, levels in `src/game/content/packs/default.json`, passed to `startRun` in `screens/gameController.ts` |
| Agent states / actions | `agent/agentPlugin.ts` (`board`, `goal`, `movesLeft`, … and `swap`, `start`) |
| HUD | `render/GameHud.ts` |
| Results screen | `src/game/screens/ResultsScreen.tsx` |
| Animation timing | constants at the top of `render/BoardView.ts` |

## What the kit replaces

- The skeleton's example `tap` move and its pointer binding: `input/pointer.ts`
  stays in the repo but nothing calls it (swap input is `input/swap.ts`). The
  slot READMEs still describe `tap` as the skeleton's example; the code above
  is the match-3's.
- `tests/unit/schedule.test.ts` and `tests/unit/events.test.ts` are the kit's
  own versions of the template's tests: same lifecycle, determinism, event
  queue and agent checks, driven by swaps instead of `tap`.
- `wolf-game-kit.json` and `.env.example` (`VITE_GAME_KIT_PROJECT_ID`) are on
  the local-only slug `mygame`, and the asset lockfile
  (`assets/asset-manifest.cdn.json`, `assets/registry.ts`) is emptied, so local
  dev serves `public/assets/`. Set the real slug in both per
  `.agents/recipes/new-game.md` step 1.

## Tests

`tests/unit/match3.test.ts`: board generation, matching, swap and swap-back,
cascades and chain scoring, commitMove's win and lose, the run total and stars.
`tests/unit/events.test.ts`: the events a move emits. `tests/unit/schedule.test.ts`:
the run lifecycle and the agent surface. Change them with the rules; add one
for each new rule.
