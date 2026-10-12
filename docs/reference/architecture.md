# Architecture

This is the map of the scaffold. For a task, start at `AGENTS.md` and open one recipe. A recipe wins when it disagrees with this page.

## Tiers

| Tier | Path | Owner | Imports |
| --- | --- | --- | --- |
| Core | `src/core/` | template-amino | `@wolfgames/components` (`/core`, `/solid`, `/pixi`, `/howler`), `@wolfgames/client`, and `~/game/setup/tracking` |
| Game | `src/game/` | this game | `~/core`, `@wolfgames/components` (`/core`, `/solid`, `/pixi`, `/modules/*`, and `/modules-src/*` for proxy art), `~/integrations/embed` |
| Integrations | `src/integrations/` | template-amino | `@wolfgames/client`, `~/core`. `embed/` is publisher embeds, `vault/` is the Games Vault host bridge |
| Components | `@wolfgames/components` | game-components package | catalog modules, providers, Pixi loader, design shell |
| Client | `@wolfgames/client` | Games Manager client | game config, asset client, DynamicData, host context |

`src/app.tsx` wires all of them. Core is not game-agnostic: `src/core/systems/screens/context.tsx` and `src/core/systems/errors/boundary.tsx` import `useGameTracking` from `src/game/setup/tracking.ts`, and the CDN manifest provider imports `assets/registry.ts`. `biome.json` bans `~/game/**` imports in `src/core/**`, so those lines predate the rule.

`src/core/` is the template-amino scaffold. Do not edit it. `bun run amino:sync` pulls it from template-amino and also overwrites the other paths in `SYNC_PATHS` in `scripts/amino-sync.ts`, including `tsconfig.json`. `bun run amino:drift` reports local edits to them. `bun run amino:verify` runs the typecheck baseline, lint, and build after a sync.

`src/core/INDEX.md` lists the core folders.

## Boot path

1. `index.html` sets the viewport meta, preloads `/assets/fonts/Baloo-Regular.woff2`, and runs an inline script. Then it loads `/src/entry-client.tsx`.
2. The inline script sets `--dynamic-vh` to 1% of `window.innerHeight`. It runs on load, on resize, and 100 ms after an orientation change. Outside the design root, `calc(var(--dynamic-vh, 1vh) * 100)` is the visible height. Inside a screen, use design px instead. See the scaling standard below.
3. `src/entry-client.tsx` starts loading the Baloo `FontFace`, awaits `resolvePlayerId()` and `whenStoresReady()`, then renders `App` into `#app`.
4. Solid builds the provider tree in `src/app.tsx`. `CdnManifestProvider` holds its children until the asset client resolves. If the client fails, it falls back to the local manifest.
5. `App`'s `onMount` calls `initSentry` (which lazy-loads `src/game/lib/sentry-client.ts`), `setupGlobalErrorHandlers`, and `initPauseKeyboard` (spacebar).
6. `ScreenRenderer` shows `gameConfig.initialScreen`, which is `loading`.

## Provider order

Outer to inner, from `src/app.tsx`:

| # | Provider | From | Notes |
| --- | --- | --- | --- |
| 1 | `EmbedProvider` | `~/integrations/embed` | Embed URL contract |
| 2 | `GameConfigProvider` | `@wolfgames/components/solid` | GameKIT instance. `gameSlug` comes from `VITE_GAME_KIT_PROJECT_ID` |
| 3 | `AnalyticsProvider` | `@wolfgames/components/solid` | `SessionTrackerBridge` sits here |
| 4 | `GlobalBoundary` | `~/core` | Errors above this line are not caught by it |
| 5 | `TuningProvider` | `~/core` | Takes `GAME_DEFAULTS`. The dev Inspector mounts here |
| 6 | `FeatureFlagProvider` | `~/core` | Flag config registers when `src/game/setup/flags.ts` loads |
| 7 | `ViewportProvider autoFill` | `@wolfgames/components/solid` | Wrapped as `TuningViewportBridge` |
| 8 | `GameShell` | `@wolfgames/components/solid` | Viewport frame, renderer host, design transform. Dev `ViewportToggle` |
| 9 | `PauseProvider` | `~/core` | |
| 10 | `CdnManifestProvider` | `~/core` | Resolves the manifest against the lockfile, then mounts `ManifestProvider` |
| 11 | `AssetProvider` | `~/core` | Asset coordinator facade. `LoadingTrackerBridge` sits here |
| 12 | `ScreenProvider` | `~/core` | Takes `initialScreen` and `screenAssets` |

Inside `ScreenProvider`: the settings menu in `DesignBleed`, `VaultHostBridge`, and `AttractGate` around `ScreenRenderer`.

## Hooks

| Hook | Import | Works below |
| --- | --- | --- |
| `useGameConfig()` | `@wolfgames/components/solid` | `GameConfigProvider` |
| `useAnalyticsService()` | `@wolfgames/components/solid` | `AnalyticsProvider` |
| `useTuning()` | `~/core` | `TuningProvider` |
| `useFeatureFlags()` | `~/core` | `FeatureFlagProvider` (throws outside) |
| `useViewport()` | `@wolfgames/components/solid` | `ViewportProvider` |
| `usePause()` | `~/core` | `PauseProvider` |
| `useManifest()` | `@wolfgames/components/solid` | `CdnManifestProvider` |
| `useAssets()`, `useAssetCoordinator()` | `~/core` | `AssetProvider` (throws outside) |
| `useScreen()` | `~/core` | `ScreenProvider` |
| `useAudio()` | `~/core` | Anywhere. `AudioProvider` is not mounted, so it returns `audioState`, the volume and music signals |

## Contracts

The game provides:

- `gameConfig` in `src/game/config.ts`: a component for each of the four screens, `initialScreen`, and optional `screenAssets`, `defaultViewportMode` (declared, nothing reads it), and `skipStartScreen`.
- `defaultGameData` in `src/game/index.ts`. It is an untyped `null` today. Type it as `GameData` from `src/game/config.ts` when the game has data.
- `manifest` in `src/game/asset-manifest.ts`. Its srcs resolve through `assets/registry.ts` against the lockfile in the `assetsDir` from `wolf-game-kit.json`. The first publish creates the lockfile. Until then srcs load from `localBase`.
- `GAME_DEFAULTS` from `src/game/tuning/`.
- `useGameTracking` in `src/game/setup/tracking.ts`. Core imports it.
- `setupGame` and `setupStartScreen`, typed by `src/game/mygame-contract.ts` and re-exported by `src/game/mygame/index.ts`. `GameScreen.tsx` imports `screens/gameController` and `StartScreen.tsx` imports `screens/startView` directly.

Core guarantees:

- Tuning loads from localStorage, then `public/config/tuning/core.json` and `game.json`, then the defaults (`src/core/systems/tuning/loader.ts`).
- The manifest resolves through the asset client, or falls back to the local manifest. `VITE_ASSETS_LOCAL=1` forces the local manifest.
- The coordinator facade in `src/core/systems/assets/facade.ts` exposes `loadBundle`, `unloadBundle`, `initGpu`, `getGpuLoader`, and `audio.unlock`.
- `goto` and `back` change screens with the fade in `DEFAULT_TRANSITION` (`src/core/systems/screens/types.ts`). The screen manager loads a screen's required `screenAssets` bundles before showing it.
- `GlobalBoundary` and Sentry report errors. The ECS bridge for the Inspector is `src/core/systems/ecs/`. The game world is `src/game/mygame/world.ts`.

## Per-game edits

`.agents/recipes/new-game.md` has the steps. These are the files involved.

| File | Change |
| --- | --- |
| `.env` (copy `.env.example`) | `VITE_GAME_KIT_PROJECT_ID` set to the Nucleo slug |
| `wolf-game-kit.json` | `gameSlug` set to the same slug, plus `gameName` |
| `index.html`, `src/entry-client.tsx`, `src/app.css` | Font preload, `FontFace`, and `@font-face` |
| `src/game/config.ts` | `GAME_FONT_FAMILY`, `GameData`, screen wiring, `screenAssets` |
| `src/game/index.ts` | `defaultGameData` |
| `src/game/tuning/`, `public/config/tuning/game.json` | Game tuning defaults |
| `src/game/asset-manifest.ts` | Bundles |
| `src/game/setup/tracking.ts`, `src/game/setup/flags.ts` | Events and feature flags |
| `src/game/mygame/` | The game |
| `docs/GAME-DESIGN.md` | The design note |

`src/app.tsx` normally needs no edit.

## Scaling standard

Layout and responsive scaling follow section 9 of `node_modules/@wolfgames/components/docs/standards/components.md`. Code comments that cite docs/standards/components.md mean that file inside `@wolfgames/components`, not a file in this repo.

## Known debt: ScreenId

`ScreenId` is hardcoded in `src/core/systems/screens/types.ts` as `'loading' | 'start' | 'game' | 'results'`, so every game ships exactly those four screens. `GameScreen.tsx` passes `goto` to the controller as `(screen: string) => void` and casts it with `as never`. A wrong id compiles and then fails at runtime.
