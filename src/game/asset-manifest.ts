/**
 * Asset manifest — single source for bundle list and paths.
 *
 * This file is intentionally free of runtime imports (no Solid.js, no ~/core)
 * so it can be imported by CLI scripts (scripts/check-manifest.ts) running
 * under plain Bun without the Vite/app dependency graph.
 *
 * cdnBase and localBase are static placeholders here. At boot,
 * CdnManifestProvider resolves srcs against the committed lockfile: published
 * srcs become content-hashed CDN paths, unpublished srcs (the bundled boot
 * chrome below) stay on localBase. Published srcs are lockfile keys — paths
 * relative to assets/src/, so GPU-loaded atlas JSON keeps its json-data/
 * prefix while audio/DOM JSON is top-level (see assets/README.md).
 *
 * Types are imported directly from @wolfgames/components/core — this is the
 * single source of truth for the manifest schema.
 *
 * Bundle naming determines which loader handles the assets:
 *
 *   boot-*   → DOM only   — splash screen assets
 *   theme-*  → DOM only   — branding/logo (loading screen, pre-GPU)
 *   scene-*  → GPU (Pixi) — game spritesheets, backgrounds, tiles, characters
 *   core-*   → GPU (Pixi) — in-game UI atlases
 *   fx-*     → GPU (Pixi) — particles, effects, VFX spritesheets
 *   audio-*  → Howler     — sound effects, music
 *
 * Game atlases MUST use scene-* or core-* to be accessible via Pixi
 * (createSprite, getTexture, hasSheet). Using theme-* for game atlases
 * will silently fail — Pixi never sees them.
 *
 * Bundle names must match [a-z][a-z0-9-]* — only lowercase, digits, hyphens.
 * NO underscores. Asset file paths can have underscores; bundle names cannot.
 *
 * For single-asset GPU bundles, set alias = bundle name so Pixi lookups work:
 *   { name: 'scene-tiles', assets: [{ alias: 'scene-tiles', src: 'json-data/atlas-tiles.json' }] }
 *   → gpuLoader.createSprite('scene-tiles', 'frame-name.png')
 */

import type { Manifest } from '@wolfgames/components/core';

export const LOCAL_ASSET_PATH = '/assets';

export const manifest: Manifest = {
  cdnBase: LOCAL_ASSET_PATH,
  localBase: LOCAL_ASSET_PATH,
  bundles: [
    // Micro-bundle: lightweight hero image loaded first so ContentLoader
    // can mount before the rest of the heavy assets finish.
    {
      name: 'boot-splash',
      assets: [
        { alias: 'splash-hero', src: 'bg-splash.webp' },
        // Optional game-specific loader bar image. Remove if not used.
        // { alias: 'loader-bar', src: 'loader-bar.webp' },
      ],
    },

    // DOM — branding logo shown on loading screen (pre-GPU)
    {
      name: 'theme-branding',
      assets: [{ alias: 'atlas-branding-wolf', src: 'atlas-branding-wolf.json' }],
    },

    // ── Demo gameplay + start screen art (GPU) ──────────────────────────────
    // The gameplay sprites (a neutral orb, the game-field background) and the
    // start-screen art (title, play button, title background) are NOT loaded
    // through the coordinator/CDN bundle path. They ship committed under
    // src/game/mygame/assets/generated/*.webp and load via Vite ?url + Pixi
    // Assets (src/game/mygame/render/textures.ts) — self-contained, no CDN
    // round-trip, works identically in dev and the production build. The same
    // files are also published to the CDN (assets/asset-manifest.cdn.json) for
    // the deployed pipeline; no bundle entry is needed here.

    // ── Audio (Howler) ──────────────────────────────────────────────────────
    // One Howl per JSON sidecar, keyed by alias = the channel the game plays
    // (gameController.tryPlay('sfx-pop') → play whole file). Loaded by
    // loadAudio() (all audio-* bundles) before the game screen. Audio JSON is
    // top-level in assets/src (not json-data/); publish rewrites the mp3 refs.
    // The demo plays two SFX channels; add more as your game grows. Audio is
    // optional — the controller no-ops if a channel is missing.
    {
      name: 'audio-sfx',
      assets: [
        { alias: 'sfx-pop', src: 'sfx-pop.json' },
        { alias: 'sfx-clear', src: 'sfx-clear.json' },
      ],
    },
    // Looping ambience — the 'loop' sprite ([0, dur, true]) loops seamlessly;
    // gameController plays play('audio-music', 'loop') on init, stops on destroy.
    {
      name: 'audio-music',
      assets: [{ alias: 'audio-music', src: 'music-ambience.json' }],
    },
  ],
};
