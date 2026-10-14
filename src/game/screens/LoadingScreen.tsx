import { createMemo, createSignal, onMount } from 'solid-js';
import { useScreen } from '~/core/systems/screens';
import { useAssets, useLoadingState } from '~/core/systems/assets';
import { useConfigState, useManifest, useSignal } from '@wolfgames/components/solid';
import { useTuning, type ScaffoldTuning } from '~/core';
import type { GameTuning } from '~/game/tuning';
import { gameConfig, GAME_TITLE } from '~/game/config';
import { loadContent } from '~/game/setup/content';
import { useGameTracking } from '~/game/setup/tracking';
import { IntroSting } from './components/IntroSting';
import { titleArt } from './components/titleFrame';

export function LoadingScreen() {
  const { goto } = useScreen();
  const assets = useAssets();
  const loadingState = useLoadingState();
  const { manifest } = useManifest();
  const tuning = useTuning<ScaffoldTuning, GameTuning>();
  const { trackStartScreenSkipped } = useGameTracking();
  const gameKit = useSignal(useConfigState().gameKit);

  const m = manifest();
  // The title screen's own art: the loader reveals into it (blurred, dark → colour → logo → sharp).
  const title = titleArt(m);
  const bundlesByPrefix = (prefix: string) =>
    m.bundles.filter((b) => b.name.startsWith(prefix)).map((b) => b.name);

  // boot-splash: needed for the loading phase. Other boot-* bundles (e.g. boot-ui) are
  // title-screen assets — background-load them when skipping so they don't block.
  const splashBundles = m.bundles
    .filter((b) => b.name.startsWith('boot-splash'))
    .map((b) => b.name);
  const titleBootBundles = m.bundles
    .filter((b) => b.name.startsWith('boot-') && !b.name.startsWith('boot-splash'))
    .map((b) => b.name);
  const themeBundles = bundlesByPrefix('theme-');
  const coreBundles = bundlesByPrefix('core-');
  const audioBundles = bundlesByPrefix('audio-');

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

  /* progress: 0–1 across all target bundles — drives the sting's loader bar */
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

  // The sting owns the two-gate exit (plays through once AND assets ready) and the
  // handoff, mirroring ContentLoader's exitSignal/onExitComplete contract.
  const [assetsReady, setAssetsReady] = createSignal(false);

  onMount(async () => {
    // Content Pack + brand sheet (Dynamic Data), in parallel with the bundles. Never rejects,
    // and is bounded — a slow or empty CDN costs the published content, never the boot.
    const content = loadContent(gameKit());
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
      } else {
        await assets.loadBoot();
        await assets.loadTheme();
      }
      await content;
      setAssetsReady(true);
    } catch (err) {
      console.error('Failed to load initial assets:', err);
    }
  });

  /* IntroSting roots itself at `position: absolute` and fills whatever box the
     host gives it. Unwrapped inside the GameShell design root that box is the
     390x844 canvas, so the sting would paint a column with bands down both sides
     of any phone shorter than the canvas ratio. The `design-box-span` wrapper is
     the frame box; `pointer-events-auto` opts this fully-DOM screen back in, since
     GameShell passes events through for the gameplay canvas. Same wrapper as
     template-amino's ContentLoader (components.md §9.5.2). */
  return (
    <div class="design-box-span pointer-events-auto">
      <IntroSting
        progress={progress}
        title={GAME_TITLE}
        backgroundSrc={title.background}
        logoSrc={title.logo}
        reveal={!skipToGame}
        exitSignal={assetsReady}
        onExitComplete={() => goto(skipToGame ? 'game' : 'start')}
      />
    </div>
  );
}
