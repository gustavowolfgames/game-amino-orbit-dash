# Orbit Dash — Game Design

## Identity and sources

- Game: **Orbit Dash**; Nucleo slug and repository: `game-amino-orbit-dash`.
- Scaffold: `wolfgames/template-amino` at `69eac025c4fcb37a21f362d450583400fa1cec96` (clean clone).
- Feel reference: `wolfgames/carina` at `25e5d8a49214a09ea6dd125ba9a42cbf4a521b30`.
- The Wolf asset MCP is unavailable in this session. The first playable version uses intentional geometric Pixi art, the catalog HUD and effects, and the template's bundled local audio. No game release or production promotion is part of this work.

## The game in one sentence

Guide a fast orbiting pulse between two circular lanes, collecting gold energy and dodging magenta hazards with one tap per lane change.

## Core loop

The pulse moves clockwise on its own. Five gates are spaced around the orbit. Each gate has one energy orb and one hazard, one per lane. Tap or press Space/Enter to switch lanes. Crossing the orb's lane collects one point; crossing the hazard costs one shield. After each crossing, the gate's safe lane is chosen by seeded RNG for the next lap. The first gate starts safe in the inner lane so the first seconds teach the rule.

## Win and lose

Collect the level goal before all three shields are gone or the 45-second clock ends. A win continues to the next bundled level using the template's result flow. A loss offers retry. The three bundled goals are 8, 12 and 16 orbs.

## Cadence and state

Real-time fixed-step simulation at 60 Hz. The ECS `Runner` entity owns angle and lane. Each `Gate` entity owns angle, safe lane and next crossing lap. Global resources hold score, goal, shields, phase, remaining time, seeded RNG, run ID and event queue. Only transactions change state; the renderer projects entities and resources into Pixi objects.

## Input

Pointer-down anywhere on the active play canvas, Space or Enter switches lane. Input is locked during pause, settings and the result card. The lane changes in the input transaction and emits an event for immediate feedback. A tap does not award score on its own.

## Layout and feel

Design canvas 390 × 844. The two rings are centered at (195, 430), with radii 105 and 155. Gold circular energy and magenta diamond hazards are deliberate geometric art, not temporary media placeholders. `hud-display` shows level, score and shields; the orbit has a concise instruction line.

`particle-burst`, `pixel-burst`, `fly-text`, `screen-flash` and `screen-shake` come from `@wolfgames/components`. Switch feedback begins on the input frame and recovers over roughly 70–130 ms (Carina: `patterns/no-wind-up-on-player-input`). Damage begins at peak recoil and recovers over 0.3–0.5 s (Carina: `patterns/take-hit-first-frame-strongest`). The win holds five frames, then flashes and cascades (Carina: `patterns/freeze-frame-before-impact`, `patterns/layered-explosion`). The pooled effect budget stays below 80 live particles (Carina: `patterns/effects-budget-drop-the-least-noticed`). `?carina=0` disables these hooks for comparison.

## Assets and publication

The title draws its own geometric textures into Wolf's `dynamic-background`, `sprite-logo-title` and `sprite-button` modules. Gameplay reuses the template's local background and pop/clear audio pending Wolf asset tooling. The template's CDN-only ambience is omitted. Art replacement, an asset release, and deployment require the wolf-game-kit MCP; the GitHub repository alone is source publication, not a playable Wolf release. Browsers stay silent until the first player gesture; the two sound effects load in the background.
