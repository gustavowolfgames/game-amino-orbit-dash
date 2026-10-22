import {
  useConfigState,
  useManifest,
  useSignal,
} from '@wolfgames/components/solid';
import { createMemo, createSignal, onMount } from 'solid-js';
import { type ScaffoldTuning, useTuning } from '~/core';
import { useAssets, useLoadingState } from '~/core/systems/assets';
import { useScreen } from '~/core/systems/screens';
import { GAME_TITLE, gameConfig } from '~/game/config';
import { loadBootContent } from '~/game/setup/content';
import { useGameTracking } from '~/game/setup/tracking';
import type { GameTuning } from '~/game/tuning';
import { inVault } from '~/integrations/vault';
import { IntroSting } from './components/IntroSting';
import { titleArt } from './components/titleFrame';
import { resolveSkipSource } from './skipStartScreen';
import { unlockAudioOnFirstTap } from './unlockAudioOnFirstTap';

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
    .filter(
      (b) => b.name.startsWith('boot-') && !b.name.startsWith('boot-splash'),
    )
    .map((b) => b.name);
  const themeBundles = bundlesByPrefix('theme-');
  const coreBundles = bundlesByPrefix('core-');
  const audioBundles = bundlesByPrefix('audio-');

  // In the Vault (or when config, dev mode or `?screen=game` asks), loading hands straight to
  // the game. Precedence: ./skipStartScreen.ts.
  const skipSource = resolveSkipSource({
    inVault: inVault(),
    configSkip: gameConfig.skipStartScreen === true,
    devModeSkip: tuning.game.devMode?.skipStartScreen === true,
    search: window.location.search,
  });
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
    // and is bounded — a slow or empty CDN costs the published content, never the boot. In a
    // Vault it first waits (bounded) for the host's first context, so the Vault's selection —
    // not the bundled pack — is what loads.
    const content = loadBootContent(gameKit());
    // The next screen's code, fetched while the loader plays: a lazy screen fetched only at the
    // handoff leaves a dark frame between the loader and the title's first frame.
    const nextScreen = gameConfig.screens[skipToGame ? 'game' : 'start'] as {
      preload?: () => Promise<unknown>;
    };
    const nextScreenReady = nextScreen.preload?.();
    try {
      if (skipToGame) {
        trackStartScreenSkipped({ skip_source: skipSource });
        // Load splash + theme blocking; title boot bundles load in background (never rendered).
        for (const name of titleBootBundles) assets.backgroundLoadBundle(name);
        await assets.loadBoot();
        await assets.loadTheme();
        // No title screen means no Play tap to unlock audio on. Try now (works when the host
        // already has user activation) and again on the player's first tap.
        assets.unlockAudio();
        unlockAudioOnFirstTap(assets.unlockAudio);
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
      await nextScreenReady;
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
