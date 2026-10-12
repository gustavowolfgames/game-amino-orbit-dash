# Audio

Audio plays through Howler behind the asset coordinator. Every clip comes from the wolf-game-kit MCP. Follow `.agents/recipes/assets.md`. Do not synthesize audio or download a substitute.

## Sprite JSON

An audio sprite is one audio file plus a JSON map.

```json
{
  "urls": ["sfx-mygame.webm", "sfx-mygame.mp3"],
  "sprite": {
    "button_click": [0, 508],
    "level_complete": [11578, 480]
  }
}
```

The key must be `urls`, not `src`. The loader builds the Howl from `config.urls`, so `src` breaks the load. Each sprite entry is `[start_ms, duration_ms]`.

Make clips with `generate_sfx`, `generate_music`, or `generate_tts`. Pack them with the `sfx-audio-sprite` or `dialog-audio-sprite` process template. For clips you already have, run `bunx audiosprite -o sfx-mygame -f howler *.wav`. The `howler` format writes `urls`. `howler2` writes `src`, which breaks the load.

Stage the JSON and its audio at the top level of `assets/src/`, not under `json-data/`. Publish rewrites `urls` to the hashed names. The full flow is `docs/reference/asset-pipeline.md`.

## Manifest

```ts
{ name: 'audio-sfx-mygame', assets: [{ alias: 'audio-sfx-mygame', src: 'sfx-mygame.json' }] }
```

The bundle needs the `audio-` prefix. The asset alias is the channel you play. The Howler loader only loads `.json` srcs and skips anything else without an error. `loadAudio()` loads every `audio-` bundle. Give each music track its own bundle.

## Sound definitions

`SoundDefinition` comes from `~/core/systems/audio`. The catalog is `src/game/audio/sounds.ts`.

| Field | Meaning |
| --- | --- |
| `channel` | Asset alias, for example `audio-sfx-mygame` |
| `sprite` | Sprite name in the JSON |
| `volume` | 0 to 1, optional |
| `loop` | `true` loops the track. Unset plays once |

`GameAudioManager` in `src/game/audio/manager.ts` extends `BaseAudioManager`. Its constructor takes an `AudioLoader`, and `deps.coordinator.audio` satisfies that interface.

| Method | Purpose |
| --- | --- |
| `playSound(sound)` | Protected. Play one definition from a `GameAudioManager` method such as `playButtonClick()` |
| `playRandomSound(sounds)` | Protected. Play one of several variations |
| `startMusic(track)` | Start a track. It loops only when `loop: true` |
| `stopMusic()` | Stop the current track |
| `isMusicPlaying()` | Whether a track is playing |

## Where playback lives

Transactions and systems never play sound. A sibling module of the controller compares ECS state after a step, for example a score increase or a phase change, and plays the matching sound through `deps.coordinator.audio`.

The shipped controller calls `deps.coordinator.audio.play(channel)` with no sprite for `sfx-shoot`, `sfx-clear`, and `sfx-lose`. With no sprite, Howler plays the whole file under that alias. Those calls do nothing until a bundle registers those aliases.

## Unlock and settings

Mobile browsers block audio until a tap. The start flow already calls `unlockAudio()` from `useAssets()`.

The settings menus save `volume` and `musicEnabled` in `audioState` from `~/core/systems/audio`. `startMusic` already returns early when `musicEnabled()` is false. Nothing applies `volume`. Call `deps.coordinator.audio.setMasterVolume(volume)` when it changes.

## Verify

Run `bun run check:manifest`. After a publish, call the `assets_verify` MCP tool with `budget: true`.
