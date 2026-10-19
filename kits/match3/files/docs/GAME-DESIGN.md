# Game Design — Match 3

> Source of truth for the game's design. Agents read this before building, and
> update it in the same change when the game changes. If this doc and the code
> disagree, the code wins for exact numbers and this doc wins for the loop and
> intent.

## The Game in One Sentence

Swap neighbouring tiles on an 8×8 board to line up three or more of a colour,
and clear enough tiles of the level's goal colour before your 20 moves run out.

## Core Loop

1. Drag a tile onto a neighbour (or tap one, then a neighbour).
2. If the swap makes no line of 3+ in a row or column, it swaps back (no move spent).
3. Otherwise the lines clear, tiles above fall, new tiles drop in from the top,
   and any new lines clear too, as a chain. One move is spent.
4. Repeat until the goal is reached or the moves run out.

## Win and Lose

A level's `goal` counts tiles of its `goalColor` cleared (chains count).
Reaching it wins the level, even on the last move. Spending the last move short
of it loses. A win plays straight on to the next level; winning level 3 shows
the results screen (run total + stars). A loss shows results with **Retry**,
which restarts that level on the same seeded board.

Score: 30 points per tile cleared × the chain step (×1 for the swap's own clear,
×2 for the next cascade, ×3 after that …). The run total is the sum over levels
won plus the current level. Stars on the final total: 1 for finishing,
2 at 12,000, 3 at 16,000.

If a move leaves a board with no legal swap, the board is redrawn (seeded).

## Cadence

Turn-based. Input calls the turn function `applySwap`
(`src/game/mygame/sim/turn.ts`): it reads the tiles, resolves the swap with pure
rules (`sim/rules/board.ts`), commits through `commitMove`, and returns the
ruling the board view animates. `SYSTEM_ORDER` stays empty. Input is ignored
while the board animates.

## Entities

- `Tile` — `col`, `row`, `color` (0 red, 1 blue, 2 green, 3 yellow, 4 purple), `spriteKey` (`tile-<colour>`). 64 per board.

Resources: `level`, `seed`, `goal`, `goalColor`, `goalProgress`, `maxMoves`,
`movesLeft`, `score`, `bankedScore`, `phase`, `rng`, `runId`.

## Input

Press and drag about a third of a tile toward a neighbour to swap with it; or
tap a tile (it gets a white ring) and tap a neighbour. Tapping a non-neighbour
moves the selection. Pointer events are read on the Pixi stage
(`src/game/mygame/input/swap.ts`).

## Levels and Tuning

A level (`schemas/levels/schema.ts`) holds `seed`, `goal`, `goalColor`, `moves`.

| Level | Seed | Goal | Moves |
|-------|------|------|-------|
| 1 | 1 | 15 red | 20 |
| 2 | 2 | 20 blue | 20 |
| 3 | 3 | 25 green | 20 |

Constants (`src/game/mygame/sim/rules/`): 8×8 board, 5 colours, 30 points per
tile, star thresholds `[1, 12000, 16000]`. The starting board is deterministic
from the seed and never contains a ready-made match.

## Screens and Feel

- Start: the template's title screen.
- Game: HUD (level, moves, score; "CLEAR RED n/15" in the goal colour), the
  board on a `tile-grid` backdrop. Swaps slide (0.16 s), invalid swaps slide
  back, clears shrink out, tiles fall with a slight acceleration, refills drop in
  from above. "+points ×chain" popups over each clear; a "LEVEL n CLEAR!" /
  "OUT OF MOVES" banner at the end of a level.
- Results: the `screen-results-dom` module — headline, stars, score count-up,
  Next/Play Again or Retry, and Main Menu.

## Assets

Placeholder geometry only: tiles are rounded squares drawn with Pixi Graphics.
No audio or generated art yet.
