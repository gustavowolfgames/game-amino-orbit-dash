# Analytics

## When

Open this recipe when you add or change event tracking, wire PostHog, or change the edition events (`edition_started`, `edition_completed`) or the level events.

## Do

Analytics is already wired: screens call `useGameTracking()` from `src/game/setup/tracking.ts`, which wraps `useAnalyticsService()` from `@wolfgames/components/solid` (typed as the package's `BaseAnalyticsService`). Do not add a second analytics SDK.

Fire gameplay events from the game controller or an ECS transaction that owns the moment the event describes. Do not fire from a renderer or a DOM event handler — those run many times per frame.

Each event is an arktype schema in `src/game/setup/events.ts` and a typed `track*` function in `src/game/setup/tracking.ts`. Keep event names snake_case. Keep property names snake_case. Never pass raw ECS state as event props — pick the two or three fields that answer the question "what happened."

### Edition events (wired)

`src/game/setup/edition-analytics.ts` owns these; keep them when you replace the sample.

- `edition_started` — a run of the active Content Pack begins (its first level starts; a pack that loops round starts again). Props: `{ edition_id: string, edition_date: string | null }`.
- `edition_completed` — the pack's last level is won, next to `reportContentCompleted`. Same props.
- `edition_id` is the pack key (`getActivePack().id`). `edition_date` is the pack's `YYYY-MM-DD` in the Daily Editions catalog (`getEditions()`, loaded at boot inside a Vault), looked up by the Vault `contentId`, then the pack key. It is `null` for an unscheduled pack: the bundled default, the published default, a `?wolfPack=` override outside a Vault.
- Both are PostHog **super properties**. `registerEditionSuperProperties` (mounted once in `src/app.tsx`) registers them at mount and on every `onActivePackChange`, so each pack of an unlocked loop overwrites the last. `register` is a no-op until PostHog has loaded, so it registers again on `service.whenReady()`; events queued before that lack them, which is why the edition events carry both as props.

### Level events (wired)

`createRunAnalytics(deps.analytics)` in the game controller sends `level_start` (`is_replay` when the pack loops), `level_restart` (same level begun again, with `restart_count`) and `level_complete` (`time_to_complete` in seconds, `score`). `level_id` is `<pack key>/<1-based order>`. The sample has no losing state, so `level_fail` is never sent; a game with one calls `levelFailed(index, reason)` at that terminal moment. A new game keeps the three calls: `levelStarted(index, entry)` where a run starts, `levelWon(index, score)` where it is won.

Add more events the same way: one per state transition the player cares about (a move that changes the board, a combo), never every tap.

## Verify

- `bun run typecheck:baseline` passes.
- Open the game in dev. Make a move. Check PostHog Live view (dev project) — the event lands with the right props within a few seconds.
- For edition events: load the game with `?wolfPack=<key>` and verify `edition_started` fires on level 1 with that `edition_id`, and that later events carry it as a super property. `tests/unit/analytics/edition-analytics.test.ts` covers the payloads.
- The amino-posthog-report skill (if available) can replay a session and sanity-check the event mix.

## Example

`src/game/setup/events.ts` holds the schemas. `src/game/setup/tracking.ts` is the screen-side function table (`trackGameStart`, ...); `src/game/setup/edition-analytics.ts` is the controller-side one (level and edition events) plus the super properties. The vault host bridge is in `src/integrations/vault/`. Fire a gameplay event such as `move_made` from the controller's per-frame event drain (a `run` hook in its cue table, `src/game/mygame/screens/README.md`), not from the tap handler, so it fires only for moves the sim accepted.

## Do not

- Do not fire analytics from a Pixi renderer or a per-frame system.
- Do not import PostHog directly in game code. Go through `tracking.ts`.
- Do not log PII or raw user input strings. Props are typed shapes, not arbitrary blobs.
- Do not re-register super properties on every event, or from screen code; they follow `onActivePackChange`.
- Do not fire a loss event AND a complete event for the same terminal moment.
