# Add game feel from Carina

## When

Open this recipe when the task says juice, game feel, polish, impact, a hit, a score pop, a combo, a win or lose moment, or "make it feel better". Also open it when you add an effect that answers a player action.

## Do

1. **Look it up in Carina first.** Carina is the creative knowledge base: one markdown entry per pattern, each with the why and an "In our games" section with the numbers. If the `pyxis_search` MCP tool exists, call `pyxis_search({ query: "<the moment>", project: "carina" })`. Otherwise run `bun run carina <words>` (for example `bun run carina hit impact`), then `bun run carina --show <name>` for the entries you will use. The script reads `CARINA_DIR` (see `.env.example`). If neither works, say so in the task output; do not invent pattern names.
2. **Pick patterns, then numbers.** Use the entry's "In our games" values (frames, seconds, eases, particle counts) as the starting point. A pattern's "When not to" line is a rule: for example, a freeze-frame goes on the win, never on every tap.
3. **Implement verbs, not effects.** Feel is one small kit of verbs in `src/game/mygame/render/juice.ts` (pop, burst, sparkle, fly, flash, shake, cascade, freeze). Add a verb there only when no existing one composes into the effect. Each verb wraps a `@wolfgames/components` module (table below); check `.agents/recipes/components.md` before a new one, and draw no art of your own.
4. **Trigger from events.** Call verbs from the `run` hook of the cue table in `src/game/mygame/screens/feedback.ts`, one row per sim event. If the moment has no event, emit one in the sim (`.agents/recipes/ecs.md`). Never keep a "last frame" counter to diff.
5. **Numbers go in tuning.** Peaks, frame counts, particle counts and hold times live in the `juice` section of `src/game/tuning/types.ts`. A verb takes them as arguments; the cue hook reads them through the controller's `feel()`.
6. **Cite the pattern.** Write `(Carina: patterns/<name>)` in the comment above each verb or hook that follows one, so the next agent can find the reasoning. A glossary term is `(Carina: glossary/<name>)`.
7. **Keep the switch working.** `?carina=0` loads the same build with the juice off (`src/game/setup/carina.ts`, default from `juice.carina` in tuning). Every hook checks `on()` first, so the off build is the plain game for a side-by-side.

| Carina category | Template slot | Catalog module (`@wolfgames/components/modules/primitives/…`) |
|---|---|---|
| juice | verb in `src/game/mygame/render/juice.ts` | `particle-burst`, `pixel-burst`, `screen-flash`, `screen-shake`, `sprite-vfx` (needs an atlas) |
| feedback | `run` hook in `src/game/mygame/screens/feedback.ts` | `fly-text`, `count-up`, `star-rating`, `screen-shake` |
| ui | a view in `src/game/mygame/render/` | `hud-display`, `progress-bar`, `count-up`, `sprite-button` |
| transition | `src/game/mygame/screens/gameController.ts` (`goto`) and the Solid screens in `src/game/screens/` | `transition-wipe` |
| sound | `sfx` / `gapMs` in the cue table; channels via `src/game/mygame/screens/gameAudio.ts` | `@wolfgames/components/howler`; new sounds come from `.agents/recipes/assets.md` |
| onboarding | a view in `src/game/mygame/render/` triggered by a sim event | `tutorial-hand`, `hint-box`, `spotlight-overlay`, `cta-radar-ping` |
| difficulty | rules in `src/game/mygame/sim/rules/`, per-level numbers in the Content Pack (`.agents/recipes/dynamic-data.md`) | none: it is data, not a module |

Effects budget: stay near 80 live particles in total and never drop the feedback for the player's own tap (Carina: patterns/effects-budget-drop-the-least-noticed).

## Verify

`bun run check:agent`, `bun run typecheck:baseline` and `bun run test:run` pass. Then run `bun run dev`, open the game with `?screen=game` and with `?screen=game&carina=0`, and compare the same taps and the win. In the task output, list each Carina entry you used and the verb or hook it landed in. A screen change also runs `bun run test:e2e`.

## Example

The template's tap game: `scored` plays a burst, a sparkle and a "+1" at the tap, and punches the HUD (Carina: patterns/no-wind-up-on-player-input, patterns/take-hit-first-frame-strongest). `phase: won` freezes the juice for 5 frames, then plays a contrast frame, a white flash, a medium shake and three confetti showers (Carina: patterns/freeze-frame-before-impact, patterns/layered-explosion). The verbs are in `src/game/mygame/render/juice.ts`, the hooks in `src/game/mygame/screens/feedback.ts`, and the numbers in `src/game/tuning/types.ts`.
