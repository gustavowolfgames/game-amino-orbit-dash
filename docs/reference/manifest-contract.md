# Manifest contract

The rules a valid `src/game/asset-manifest.ts` follows. The types are `Manifest`, `Bundle`, and `AssetDefinition` from `@wolfgames/components/core`. `src/core/systems/assets/types.ts` only re-exports them.

## Bundle prefix and loader

The loader comes from the bundle name prefix, or from `kind` when it is set.

| Prefix | `kind` | Loader | Use for |
| --- | --- | --- | --- |
| `boot-` | `boot` | DOM | Splash assets before the engine |
| `theme-` | `theme` | DOM | Branding and logo before the GPU |
| `data-` | `data` | DOM | JSON config |
| `audio-` | `audio` | Howler | Sound effects and music |
| `core-` | `core` | GPU (Pixi) | In-game UI atlases |
| `scene-` | `scene` | GPU (Pixi) | Game spritesheets, backgrounds, characters |
| `fx-` | `fx` | GPU (Pixi) | Particles and VFX |

Game atlases must use `scene-` or `core-`. A `theme-` bundle never reaches Pixi, and the sprite lookup fails without an error.

## Bundle rules

- A bundle name matches `^[a-z][a-z0-9-]*$`. Use lowercase letters, digits, and hyphens. No underscores.
- A bundle has a known prefix, an explicit `kind`, or both. When both are set they must agree. `kind: 'audio'` on `theme-branding` fails.
- Bundle names are unique in the manifest.
- Every asset sets its own `alias`. An alias is unique across bundles. Nothing derives it from the path.
- For a single-asset GPU bundle, set the alias to the bundle name so `createSprite('scene-tiles', 'frame.png')` finds it.

## Asset path rules

- `src` is relative. No leading `/`, no `..`, no `http://` or `https://`.
- A published `src` is the lockfile key: the path relative to `assets/src/`. GPU atlas JSON keeps its `json-data/` prefix. Audio and DOM JSON stay at the top level.
- At boot, `CdnManifestProvider` swaps published srcs for hashed CDN paths. A `src` that is not in the lockfile resolves against `localBase`.
- Do not set `base` on a published asset. It opts the asset out of CDN resolution.
- `check:manifest` accepts these extensions: `json`, `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`, `woff`, `woff2`, `ttf`, `otf`, `webm`, `mp3`, `ogg`, `wav`.

## Anti-patterns

- A leading slash: `"/atlas.json"`.
- An absolute URL in `src`.
- Two bundles with the same name, or two assets in different bundles with the same alias.
- Uppercase, spaces, or underscores in a bundle name.
- A `kind` that disagrees with the prefix.
- A bundle with no known prefix and no `kind`.
- A `..` segment in a path.
- A game atlas in a `theme-` bundle.
- An empty `assets` array. The types allow it, but it is usually a mistake.

## Validation

At runtime, the asset coordinator in `@wolfgames/components` runs `assertManifestValid` when it is created. An invalid manifest throws before any bundle loads.

Offline, run `bun run check:manifest`. It runs the same `validateManifest` from `@wolfgames/components/core`, then the checks in `scripts/check-manifest.ts`. The shared validator always enforces the lowercase name pattern. `--strict` also enforces it in the fallback check that runs when `@wolfgames/components` is missing. `--path=manifest.json` checks a JSON file instead of the game manifest.

Run `bun run check:assets` for file names in `public/assets/` and `assets/src/`. It skips `assets/src/_staging/`. The naming rules are `docs/reference/asset-naming.md`.

## Example

```ts
{
  cdnBase: '/assets',
  localBase: '/assets',
  bundles: [
    { name: 'theme-branding', assets: [{ alias: 'atlas-branding-wolf', src: 'atlas-branding-wolf.json' }] },
    { name: 'scene-tiles-mygame', assets: [{ alias: 'scene-tiles-mygame', src: 'json-data/atlas-tiles-mygame.json' }] },
    { name: 'audio-sfx-mygame', assets: [{ alias: 'audio-sfx-mygame', src: 'sfx-mygame.json' }] },
  ],
}
```
