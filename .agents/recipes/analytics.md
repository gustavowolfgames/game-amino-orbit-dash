# Analytics

## When

Open this recipe when you add or change event tracking, wire PostHog, or implement the vault edition events (`edition_started`, `edition_completed`).

## Do

PostHog is already wired in `src/integrations/analytics/posthog.ts`. The dev build sends to the dev project; the prod build sends to the prod project. Do not add a second analytics SDK.

Fire gameplay events from the game controller or an ECS transaction that owns the moment the event describes. Do not fire from a renderer or a DOM event handler — those run many times per frame.

Each event is a function in `src/integrations/analytics/events.ts`. The function takes typed args and calls `track(name, props)`. Keep event names snake_case. Keep property names snake_case. Never pass raw ECS state as event props — pick the two or three fields that answer the question "what happened."

### Vault / daily edition events (required)

A vault-eligible game MUST emit:

- `edition_started` — when the active content pack mounts. Props: `{ edition_id: string, edition_date: string }`.
- `edition_completed` — when the player clears the edition. Same props.
- `edition_id` and `edition_date` must be registered as PostHog **super properties** at mount so they ride on every subsequent event in the session. See `src/integrations/analytics/superProperties.ts`.

In **unlocked mode** the player plays through all editions back-to-back. Super properties update when the next pack mounts. Re-register them; do not append.

### Standard game events (recommended)

The convention is: one event per state transition the player cares about. For a tap-to-clear game:

- `level_started` — level 1 begins. Props: `{ level: number }`.
- `move_made` — player took a turn. Props: `{ level, moves_used, score }` only on moves that change the board.
- `combo` — a cascade cleared N groups in sequence. Props: `{ level, combo_count, score_gained }`.
- `level_cleared` / `level_failed` — terminal states. Props: `{ level, moves_used, score, stars }`.

Do not fire every single tap. Fire the state transition.

## Verify

- `bun run typecheck:baseline` passes.
- Open the game in dev. Make a move. Check PostHog Live view (dev project) — the event lands with the right props within a few seconds.
- For vault events: load the game with `?pack=<id>` and verify `edition_started` fires once with the right `edition_id`.
- The amino-posthog-report skill (if available) can replay a session and sanity-check the event mix.

## Example

`src/integrations/analytics/posthog.ts` is the SDK init. `src/integrations/analytics/events.ts` is the function table. The vault event wrapper is in `src/integrations/vault/edition.ts`. The gameController fires `move_made` from a dedicated path, not from the tap handler.

## Do not

- Do not fire analytics from a Pixi renderer or a per-frame system.
- Do not import PostHog directly in game code — go through `events.ts`.
- Do not log PII or raw user input strings. Props are typed shapes, not arbitrary blobs.
- Do not re-register super properties on every event; register once at pack mount.
- Do not fire a loss event AND a complete event for the same terminal moment.
