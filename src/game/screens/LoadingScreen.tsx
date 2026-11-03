import {
  useConfigState,
  useManifest,
  useSignal,
} from '@wolfgames/components/solid';
import { Howler } from 'howler';
import { createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { type ScaffoldTuning, useTuning } from '~/core';
import { useAssets, useLoadingState } from '~/core/systems/assets';
import { useScreen } from '~/core/systems/screens';
import { GAME_TITLE, gameConfig } from '~/game/config';
import { loadAudioInBackground } from '~/game/setup/audioLoad';
import { loadBootContent } from '~/game/setup/content';
import { useGameTracking } from '~/game/setup/tracking';
import type { GameTuning } from '~/game/tuning';
import { inVault } from '~/integrations/vault';
import { IntroSting } from './components/IntroSting';
import { gameArt, titleArt } from './components/titleFrame';
import { optional, required } from './loadSteps';
import { playsIntro, resolveSkipSource } from './skipStartScreen';
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

  // In the Vault (or when config, dev mode or `?screen=game` asks), loading hands straight to
  // the game. Precedence: ./skipStartScreen.ts.
  const skipSource = resolveSkipSource({
    inVault: inVault(),
    configSkip: gameConfig.skipStartScreen === true,
    devModeSkip: tuning.game.devMode?.skipStartScreen === true,
    search: window.location.search,
  });
  const skipToGame = skipSource !== null;
  // The loader reveals into the next screen's own art (blurred, dark → colour → sharp): the
  // title's background and logo, or with the title skipped the play screen's background.
  const title = titleArt(m);
  const game = gameArt(m);

  // When skipping: block on splash + theme + core; title boot assets and audio load in background.
  // When not skipping: block only on splash + theme (start screen loads the rest).
  const targetBundles = skipToGame
    ? [...splashBundles, ...themeBundles, ...coreBundles]
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
    const nextScreen = gameConfig.screens[skipToGame ? 'game' : 'start'];
    nextScreen.preload?.();
    // Optional steps log a failure and carry on; required ones retry, and the loader hands
    // off only once they all succeed (./loadSteps.ts). Handing off without the renderer or
    // the next screen's art leaves a screen that cannot start.
    try {
      if (skipToGame) {
        trackStartScreenSkipped({ skip_source: skipSource });
        // Title boot bundles load in the background (never rendered on this path).
        for (const name of titleBootBundles) assets.backgroundLoadBundle(name);
        await optional('the splash', () => assets.loadBoot());
        await optional('the theme', () => assets.loadTheme());
        // No title screen means no Play tap to unlock audio on. Try now (works when the host
        // already has user activation) and again on the player's first tap.
        assets.unlockAudio();
        unlockAudioOnFirstTap(
          assets.unlockAudio,
          () => Howler.ctx?.state === 'running',
        );
        await required('the renderer', () => assets.initGpu());
        // A missing file is skipped and reported, not a stuck loader (render/textures.ts).
        // Imported lazily: it brings Pixi, which stays out of the entry chunk.
        (await import('~/game/mygame/render/textures')).skipMissingArt();
        await required('the game UI', () => assets.loadCore());
        // The play screen's background, so the game draws its first frame right at the handoff.
        await required('the game art', () =>
          assets.coordinator.loadScene('game'),
        );
        // Audio loads last, in the background: nothing waits for it. Without a tap yet the
        // components Howler loader stalls between sounds until the first tap, so waiting here
        // could hang the loader. The game screen's music starts once it has loaded and that
        // tap has unlocked audio (../setup/audioLoad.ts).
        loadAudioInBackground(assets.loadAudio);
      } else {
        // The title screen loads the rest itself when the player taps Play.
        await optional('the splash', () => assets.loadBoot());
        await optional('the theme', () => assets.loadTheme());
      }
      await content;
      await required('the next screen', async () => nextScreen.preload?.());
      setAssetsReady(true);
    } catch (err) {
      // A required step failed every try: stay on the loader rather than hand off to a
      // screen that cannot start.
      console.error('The game could not load; staying on the loader:', err);
    }
  });

  /* IntroSting roots itself at `position: absolute` and fills whatever box the
     host gives it. Unwrapped inside the GameShell design root that box is the
     390x844 canvas, so the sting would paint a column with bands down both sides
     of any phone shorter than the canvas ratio. The `design-box-span` wrapper is
     the frame box; `pointer-events-auto` opts this fully-DOM screen back in, since
     GameShell passes events through for the gameplay canvas. Same wrapper as
     template-amino's ContentLoader (components.md §9.5.2). */
  // `?screen=game` and the dev toggle skip the intro too: a plain ground until the game has
  // loaded, then straight in (its own still covers the gap until Pixi draws).
  if (!playsIntro(skipSource)) {
    createEffect(() => {
      if (assetsReady()) goto('game');
    });
    return (
      <div
        class="design-box-span pointer-events-auto"
        data-loading="no-intro"
        style={{ background: 'var(--brand-ground)' }}
      />
    );
  }

  return (
    <div class="design-box-span pointer-events-auto">
      <IntroSting
        progress={progress}
        title={skipToGame ? undefined : GAME_TITLE}
        backgroundSrc={skipToGame ? game.background : title.background}
        logoSrc={skipToGame ? undefined : title.logo}
        reveal
        target={skipToGame ? 'game' : 'title'}
        exitSignal={assetsReady}
        onExitComplete={() => goto(skipToGame ? 'game' : 'start')}
      />
    </div>
  );
}
