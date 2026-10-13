# Keep the controller thin

## When

Open this recipe when you edit `setupGame`, add a transition, or are about to put drawing, scoring, or VFX into `gameController.ts`.

## Do

Open `.agents/skills/game-controller/SKILL.md` and follow it. `setupGame` wires the world, the canvas, the fixed step, and `goto`. Sibling files own the scene.

Pixi calls are `.agents/skills/pixi-gameplay/SKILL.md`.

Music and the settings menu's volume go through `bindAudioSettings` (`./audioSettings.ts`); the assets recipe says how. Start music with `music.startMusic()`, never by playing the music channel directly.

## Verify

`bun run check:agent` passes. If it reports that `gameController.ts` is over its line cap, move the new code out. Do not raise the cap.

## Example

The bridge is `src/game/mygame/screens/gameController.ts`. The contract is `src/game/mygame-contract.ts`.
