# Kit: ball sort

A working ball sort on this template: tubes of 4 balls, one full tube per
colour plus 2 empty ones, tap a tube to lift its top ball and tap another to
drop it. A drop is legal onto an empty tube or the same colour with room; an
illegal drop puts the ball back. Complete tubes turn green. 3 undos per level,
Restart, a "No moves left" Retry, seeded levels that are always solvable,
3 levels (4, 5, 7 colours) and results with stars from par. Keyboard: arrows
move a tube cursor, Space / Enter taps that tube. It passes `check:agent`,
`typecheck:baseline`, `test:run` and `build` as installed.

Install: `bun run add-kit ballsort`. Then change it into the game you were
asked for. Don't rebuild what is already here.

The kit sets the slug to `mygame` (`wolf-game-kit.json`, `.env.example`) and
empties the asset lockfile, as `.agents/recipes/new-game.md` step 1 says; set
the real Nucleo slug in both when you have it. Until the game publishes its own
Dynamic Data, the bundled pack (`src/game/content/packs/default.json`) plays and
the pack / brand fetches under `mygame` 404 in the console.

## How a move flows

Ball sort is turn-based: input calls transactions directly, and
`SYSTEM_ORDER` (`sim/systems/index.ts`) stays empty.

```
input/pointer.ts           tap → db.transactions.tap(point)  (design px, 390×844)
render/Controls.ts         Undo / Restart / Retry → controller → undo / restartLevel
screens/gameController.ts  input(intent) (useGameKeyboard): move → moveCursor, action → pressCursor.
                           Nothing is accepted while a ball moves (BoardView.busy), paused, or in settings.
sim/plugin.ts tap          tubeAt (sim/rules/layout.ts) → tapTube
sim/plugin.ts tapTube      nothing held: lift the top ball (heldTube). Same tube: put it back.
                           Other tube: canDrop ? move it, push history, moves += 1 : put it back.
                           Then settle(): mark done tubes, set won / stuck. Each step emits an event.
sim/rules/ballSort.ts      PURE: canDrop, applyMove, isTubeComplete, isWon, legalMoves, hasLegalMove,
                           solve (depth-first, capped), generateBoard (seeded shuffle kept only if
                           solve finds a way), starsFor
sim/readBoard.ts           readBoard / readBalls / readDoneTubes: the entities as plain values
render/BoardView.ts        reads Ball / Tube entities every frame; a ball whose tube, slot or
                           lift changed tweens there (lift → across → down). Draws the keyboard cursor.
render/Controls.ts         the HUD (LEVEL / MOVES / UNDOS), Undo / Restart buttons and the
                           "No moves left" Retry (Pixi, catalog modules)
screens/gameController.ts  render: views update, then drainEvents → cue table (screens/feedback.ts:
                           sound + aria line). screens/endOfPlay.ts: a won level starts the next;
                           the pack's last one goes to results.
```

Balls are entities (`tube`, `slot`, `color`); tubes are entities (`tubeIndex`,
`done`). `readBoard` rebuilds the plain `number[][]` board from them, so the
rules never touch ECS. Undo keeps a `history` of moves in a resource and
plays the last one backwards.

Events (`GameEvent` in `sim/plugin.ts`): `lifted`, `putBack` (`illegal` when a
drop was refused), `moved`, `tubeDone`, `undone`, `restarted`, `stuck`,
`cursor`, `phase`. Sounds and screen-reader lines are rows in the controller's
cue table, `screens/feedback.ts` (`sfx-pop`, `sfx-clear`).

## Where to change what

| To change | Edit |
|---|---|
| Tube size, empty tubes, undos | `TUBE_CAPACITY`, `EMPTY_TUBES`, `UNDOS_PER_LEVEL` in `sim/rules/ballSort.ts` (layout follows `TUBE_CAPACITY`) |
| What a move is | `canDrop` / `applyMove` / `legalMoves` in `sim/rules/ballSort.ts`, and `moveBall` + `tapTubeIn` in `sim/plugin.ts` (it moves one ball entity today) |
| Per-ball state | add a component on Ball, set it in `buildBoard`, update it in `tapTubeIn` / `settle`; draw it in `BoardView` |
| Win / lose | `settle` in `sim/plugin.ts` sets `phase` `won`, and `stuck` |
| Generator, solvability | `generateBoard` and `solve` in `sim/rules/ballSort.ts`. `solve` is a depth-first search capped at `maxStates`; keep it cheap if moves get richer |
| Level fields (colours, par, …) | `schemas/levels/schema.ts`, defaults in `src/game/content/level.ts`, levels in `src/game/content/packs/default.json`, passed to `startRun` in `screens/gameController.ts` |
| HUD, buttons | `render/Controls.ts` for the label or button, its `Command` in the controller's `command`, a transaction in `sim/plugin.ts` |
| Sounds, screen-reader lines | an event in `GameEvent` + `emit` in `sim/plugin.ts`, a row in the cue table (`screens/feedback.ts`) |
| End of a level | `screens/endOfPlay.ts`: analytics (with `moves`), saved progress, then the next level or results |
| Keys | `input` in `screens/gameController.ts` (intents from `src/game/screens/useGameKeyboard.ts`); cursor steps in `neighborTube` (`sim/rules/layout.ts`) |
| Agent / bot surface | states and actions in `agent/agentPlugin.ts` (`board`, `heldTube`, `moves`, … / `tapTube`, `undo`, `start`). On the running game the controller installs `start` (`setLiveStart`): the player's own `startRun` |
| Layout, sizes, rows | `sim/rules/layout.ts` (design px on DESIGN_CANVAS; `tubeRects` wraps tubes into rows; `tubeAt` is the hit test) |
| Colours | `BALL_COLORS` in `render/BoardView.ts` (up to 7) |
| Stars | `starsFor` in `sim/rules/ballSort.ts`; results in `src/game/screens/ResultsScreen.tsx` |

## Files the kit changes

New: `sim/rules/ballSort.ts`, `sim/rules/layout.ts`, `sim/readBoard.ts`,
`render/BoardView.ts`, `render/Controls.ts`, `tests/unit/ballSort.test.ts`.
Replaced: `sim/plugin.ts`, `agent/agentPlugin.ts`, `screens/gameController.ts`,
`screens/feedback.ts` (ball sort's cue table), `screens/endOfPlay.ts` (next level or
results, on the template's `runEnd.ts`; no end card),
the `README.md` in `sim/`, `sim/systems/`, `render/`, `screens/`, `input/`,
`agent/` (their checked snippets compile against ball sort),
`src/game/screens/ResultsScreen.tsx`, the level schema and pack,
`docs/GAME-DESIGN.md`, `wolf-game-kit.json`, `.env.example`, the asset lockfile
and `assets/registry.ts`. Tests: `tests/unit/schedule.test.ts`,
`tests/unit/events.test.ts` and `tests/unit/feedback.test.ts` are the kit's own versions (the template's drive its
example `tap`, which scores; ball sort has no score).

## Tests

`tests/unit/ballSort.test.ts`: legal and illegal drops, complete tubes, the
win check, undo, restart, stuck detection and retry, the events each move
emits, tap hit-testing on the design canvas, the keyboard cursor, and that
every pack level generates and solves. `tests/unit/schedule.test.ts`: run
lifecycle, fixed step and the agent surface. Change them with the rules; add
one for each new rule.
