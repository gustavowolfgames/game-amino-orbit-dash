import { createMemo, createSignal, onMount } from 'solid-js';
import { ContentLoader } from '@wolfgames/components/modules/prefabs/screen-content-loader';
import { useScreen } from '~/core/systems/screens';
import { useAssets, useLoadingState } from '~/core/systems/assets';
import { useManifest } from '@wolfgames/components/solid';
import { useTuning, type ScaffoldTuning } from '~/core';
import type { GameTuning } from '~/game/tuning';
import { gameConfig } from '~/game/config';
import { useGameTracking } from '~/game/setup/tracking';

export function LoadingScreen() {
  const { goto } = useScreen();
  const assets = useAssets();
  const loadingState = useLoadingState();
  const { manifest } = useManifest();
  const tuning = useTuning<ScaffoldTuning, GameTuning>();
  const { trackStartScreenSkipped } = useGameTracking();

  const m = manifest();
  const bundlesByPrefix = (prefix: string) =>
    m.bundles.filter((b) => b.name.startsWith(prefix)).map((b) => b.name);

  // boot-splash: needed for loading animation. Other boot-* bundles (e.g. boot-ui)
  // are title-screen assets — background-load them when skipping to avoid blocking.
  const splashBundles = m.bundles
    .filter((b) => b.name.startsWith('boot-splash'))
    .map((b) => b.name);
  const titleBootBundles = m.bundles
    .filter((b) => b.name.startsWith('boot-') && !b.name.startsWith('boot-splash'))
    .map((b) => b.name);
  const themeBundles = bundlesByPrefix('theme-');
  const coreBundles = bundlesByPrefix('core-');
  const audioBundles = bundlesByPrefix('audio-');

  /* Resolve the hero image src from the manifest so the URL stays consistent
     with cdnBase regardless of local vs CDN mode. */
  const splashSrc = m.bundles
    .find((b) => b.name === 'boot-splash')
    ?.assets.find((a) => (a as { alias?: string }).alias === 'splash-hero')
    ?.src as string | undefined;

  type SkipSource = 'config' | 'dev_mode' | 'url_param';

  const resolveSkipSource = (): SkipSource | null => {
    if (gameConfig.skipStartScreen) return 'config';
    if (tuning.game.devMode?.skipStartScreen) return 'dev_mode';
    const params = new URLSearchParams(window.location.search);
    if (params.get('screen') === 'game') return 'url_param';
    return null;
  };

  const skipSource = resolveSkipSource();
  const skipToGame = skipSource !== null;

  // When skipping: block on splash + theme + core + audio; title boot assets load in background.
  // When not skipping: block only on splash + theme (start screen loads the rest).
  const targetBundles = skipToGame
    ? [...splashBundles, ...themeBundles, ...coreBundles, ...audioBundles]
    : [...splashBundles, ...themeBundles];

  /* progress: 0–1 across all target bundles */
  const progress = createMemo(() => {
    const s = loadingState();
    if (targetBundles.length === 0) return 1;
    let sum = 0;
    for (const name of targetBundles) {
      if (s.loaded.includes(name)) sum += 1;
      else if (s.loading.includes(name)) sum += 0.5;
    }
    return sum / targetBundles.length;
  });

  /* heroUrl becomes non-null once boot-splash resolves */
  const heroUrl = createMemo<string | null>(() => {
    const s = loadingState();
    if (!splashBundles.some((b) => s.loaded.includes(b))) return null;
    if (!splashSrc) return null;
    const base = m.cdnBase ?? '/assets';
    return `${base}/${splashSrc}`;
  });

  const [shouldExit, setShouldExit] = createSignal(false);

  onMount(async () => {
    try {
      if (skipToGame) {
        trackStartScreenSkipped({ skip_source: skipSource });
        // Load splash + theme blocking; title boot bundles load in background (never rendered).
        for (const name of titleBootBundles) assets.backgroundLoadBundle(name);
        await assets.loadBoot();
        await assets.loadTheme();
        assets.unlockAudio();
        await assets.initGpu();
        await assets.loadCore();
        try {
          await assets.loadAudio();
        } catch (err) {
          console.warn('Audio loading failed:', err);
        }
        await new Promise((r) => setTimeout(r, 300));
      } else {
        await assets.loadBoot();
        await assets.loadTheme();
        await new Promise((r) => setTimeout(r, 500));
      }
      setShouldExit(true);
    } catch (err) {
      console.error('Failed to load initial assets:', err);
    }
  });

  return (
    <ContentLoader
      heroUrl={heroUrl()}
      progress={progress}
      exitSignal={shouldExit}
      onExitComplete={() => goto(skipToGame ? 'game' : 'start')}
      bgColor="#1a1a2e"
      enterAnimation="rise"
      heroAmbient="gentle"
      exitAnimation="fade"
    />
  );
}
