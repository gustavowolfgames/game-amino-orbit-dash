# Keep the controller thin

## When

Open this recipe when you edit `setupGame`, add a transition, or are about to put drawing, scoring, or VFX into `gameController.ts`.

## Do

Open `.agents/skills/game-controller/SKILL.md` and follow it. `setupGame` wires the world, the canvas, the fixed step, and `goto`. Sibling files own the scene.

Pixi calls are `.agents/skills/pixi-gameplay/SKILL.md`.

Feedback is a table, not code. `render` drains the sim's events once a frame (`drainEvents(db)`) and passes them to the cue table built with `createCues` (`src/game/mygame/screens/cues.ts`): per event type a sound, a screen-reader line, and a `run` hook for the HUD or a view. Do not keep a "heard last frame" snapshot to diff counters; emit an event in the sim instead (`.agents/recipes/ecs.md`).

The game screen shows `bg-game` as a still until the controller's first frame (`onReady`), so that alias must be the backdrop the first frame draws. When the scene opens on a different backdrop, re-point `bg-game` in `src/game/asset-manifest.ts` (`.agents/recipes/assets.md`, "The game screen's still"), or players see a flash of the old picture at the handoff.

Sound and music go through `createGameAudio` (`src/game/mygame/screens/gameAudio.ts`): typed channel names, never throws, and the settings menu's volume and music toggle apply through it. Start music with `audio.music('audio-music')`, never by playing the music channel directly; call `audio.stopAll()` in `destroy`. `src/game/mygame/screens/README.md` shows the wiring.

## Verify

`bun run check:agent` passes. If it reports that `gameController.ts` is over its line cap, move the new code out. Do not raise the cap.

## Example

The bridge is `src/game/mygame/screens/gameController.ts`. The contract is `src/game/mygame-contract.ts`.
