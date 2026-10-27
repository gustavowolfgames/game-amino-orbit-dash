# Game Design — Ball Sort

> Source of truth for the game's design. Agents read this before building, and
> update it in the same change when the game changes. If this doc and the code
> disagree, the code wins for exact numbers and this doc wins for the loop and
> intent.

## The Game in One Sentence

Move coloured balls between tubes, one at a time, until every colour sits alone
in its own full tube.

## Core Loop

Tap a tube to lift its top ball. Tap another tube to drop it there. The drop is
legal when the target is empty, or its top ball is the same colour and it has
room (a tube holds 4). An illegal drop, or tapping the same tube again, puts the
ball back. A tube holding 4 balls of one colour is complete and drawn as done.

Three levels play in a row. Winning a level goes straight to the next; after
level 3 the results screen shows the total moves and 1–3 stars.

## Win and Lose

- **Win:** every tube is empty or complete.
- **Stuck:** no legal move left and not won. "No moves left" shows with a Retry
  button that restarts the level. There is no other way to lose.
- **Undo:** up to 3 per level, each takes back one move (and one off the move count).
- **Restart:** restarts the current level from its seed at any time (moves 0, undos 3).
- **Stars:** run total moves vs. the summed `par` of the levels played:
  ≤ par → 3, ≤ 1.5 × par → 2, else 1. Retry / restart reset that level's moves.

The level's `goal` is unused.

## Cadence

Turn-based: nothing moves until the player acts. Every tap, button press and
key calls a transaction directly (`SYSTEM_ORDER` is empty; the fixed step only
keeps time). Input is ignored while a ball is animating (`BoardView.busy`),
while paused, and while the settings menu is open.

## Entities

- `Ball`: `tube`, `slot` (0 = bottom), `color`, `spriteKey` (`ball-<n>`).
- `Tube`: `tubeIndex`, `done`, `spriteKey` (`tube` / `tube-done`).

Resources hold the level (`seed`, `colors`, `par`, `tubeCount`), the turn state
(`moves`, `undosLeft`, `history`, `heldTube`, `stuck`), the keyboard `cursor`,
the event queue (`events`), the run total
(`runMoves`, `runPar`) and `runId` (bumped on every board rebuild).

## Input

- Tap a tube (`tap` → `tubeAt` hit test → `tapTube`): lift / drop / put back.
- Undo, Restart, Retry buttons → `undo` / `restartLevel`.
- Keyboard: arrows move a tube cursor (`moveCursor`; up / down jump a row),
  Space / Enter taps the tube under it (`pressCursor`; the first press shows the
  cursor). Escape / P pause.

## Feedback

Transactions emit events (`lifted`, `putBack`, `moved`, `tubeDone`, `undone`,
`restarted`, `stuck`, `cursor`, `phase`); the controller's cue table turns them
into sounds (`sfx-pop` on a lift or move, `sfx-clear` on a sorted tube and a
win) and the screen-reader line.

## Levels and Tuning

A level (`schemas/levels/schema.ts`) holds `seed`, `colors` (2–7) and `par`.
Its start is `colors` full tubes of shuffled balls plus 2 empty tubes, generated
from the seed; a layout is kept only if no tube starts complete and the solver
(`solve` in `src/game/mygame/sim/rules/ballSort.ts`) finds a solution, so every
level is solvable.

| Level | Seed | Colours | Tubes | Par |
|-------|------|---------|-------|-----|
| 1     | 1    | 4       | 6     | 12  |
| 2     | 2    | 5       | 7     | 22  |
| 3     | 3    | 7       | 9     | 40  |

Constants (`rules/ballSort.ts`): tube capacity 4, empty tubes 2, undos 3.
Layout (`rules/layout.ts`, design px on the 390×844 canvas): up to 6 tubes per
row, more split into two rows.

## Screens and Feel

Start (template), game, results. HUD: level, moves, undos left. A lift raises
the ball above its tube; a drop flies it over to the target and down (~0.12 s
per leg, GSAP). Done tubes turn green. The results screen shows stars, total
moves and par.

## Assets

Placeholder geometry only: Pixi Graphics circles for balls and rounded rects for
tubes and button faces. No audio, no generated art.
