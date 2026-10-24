# screens: the controller and its feedback

`gameController.ts` is the bridge between `GameScreen` and the game: it builds
the Pixi app, starts the run and the fixed-step loop, and each frame updates
the views and plays the sim's events. `startView.tsx` is the title screen's
Pixi scene. Keep the controller thin (`.agents/recipes/game-controller.md`).

Feedback has three parts, all DOM-free:

| File | Job |
|------|-----|
| `../sim/events.ts` | The sim `emit`s events; `drainEvents(db)` takes them once a frame. |
| `gameAudio.ts` | `createGameAudio(engine, { sfx, music, settings })`: typed `play(id)`, `music(id \| null)`, `stopAll()`. Applies the gear menu's volume and music toggle. Never throws; logs a failing or unloaded channel once in dev. |
| `cues.ts` | `createCues<GameEvent, Sfx>(table, { play, say })`: per event type, a sound (`sfx`, `volume`, `gapMs` throttle on sim time), a screen-reader line (`aria`) and a `run` hook for the HUD or a view. |
| `feedback.ts` | The template's own table: `createFeedback(deps)` returns the cue runner, and its `run` hooks play the juice kit (`../render/juice.ts`) on `scored` and on `phase: won`. Game feel is `.agents/recipes/feel.md`. |

The whole wiring, minus the juice (`feedback.ts` adds it):

```ts
// check: feedback.ts
import { createSignal } from 'solid-js';
import { drainEvents } from '../sim/events';
import type { GameDatabase, GameEvent } from '../sim/plugin';
import { createCues } from './cues';
import { type AudioEngine, createGameAudio } from './gameAudio';

const SOUNDS = { sfx: ['sfx-pop', 'sfx-clear'], music: ['audio-music'] } as const;
type Sfx = (typeof SOUNDS.sfx)[number];

export function wireFeedback(engine: () => AudioEngine | undefined) {
  const [ariaText, setAriaText] = createSignal('');
  const audio = createGameAudio(engine, SOUNDS); // + settings: deps.audio
  const cues = createCues<GameEvent, Sfx>(
    {
      scored: { sfx: 'sfx-pop', gapMs: 60 },
      phase: {
        sfx: (e) => (e.phase === 'won' ? 'sfx-clear' : null),
        aria: (e) => (e.phase === 'won' ? 'Level complete.' : null),
      },
    },
    { play: audio.play, say: setAriaText },
  );
  audio.music('audio-music'); // once the scene is up
  /** Call from the per-frame render. */
  const frame = (db: GameDatabase) =>
    cues(drainEvents(db), db.resources.elapsedMs);
  return { ariaText, frame, stop: audio.stopAll }; // stop in destroy()
}
```

- Channel names are the `audio-*` aliases in `src/game/asset-manifest.ts`; a
  name not in `sfx` / `music` does not compile.
- Start music with `audio.music(id)`, never by playing the music channel: the
  gear menu's toggle only applies through it.
- A new kind of feedback is a new event in the sim plus a row in the table, not
  a counter the controller remembers from last frame.
- The table is plain data: a new game replaces the rows, not the helpers.
