import { useManifest, useRendererHost } from '@wolfgames/components/solid';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { type ScaffoldTuning, useTuning } from '~/core';
import { useAssets } from '~/core/systems/assets';
import { type ScreenId, useScreen } from '~/core/systems/screens';
import { Logo } from '~/core/ui/Logo';
// Game-specific start screen — swap this import for a different game
import { setupStartScreen } from '~/game/mygame/screens/startView';
import { BRAND_LOGO } from '~/game/safeZones';
import { useGameTracking } from '~/game/setup/tracking';
import type { GameTuning } from '~/game/tuning';
import {
  cssScaleOf,
  placeTitleLogo,
  titleArt,
  titleBgMatch,
} from './components/titleFrame';
import { useSpaceKey } from './useSpaceKey';

export default function StartScreen() {
  const { goto } = useScreen();
  const { coordinator, initGpu, unlockAudio, loadCore, loadAudio, loadBundle } =
    useAssets();
  const tuning = useTuning<ScaffoldTuning, GameTuning>();
  const { trackGameStart } = useGameTracking();
  let containerRef: HTMLDivElement | undefined;
  let stillRef: HTMLDivElement | undefined;
  let stillLogoRef: HTMLImageElement | undefined;
  let stillBgRef: HTMLImageElement | undefined;
  const [pixiReady, setPixiReady] = createSignal(false);
  const title = titleArt(useManifest().manifest());
  // Frame-sized mount outside the DOM design transform — see components.md §9.2b.
  const rendererHost = useRendererHost();

  // Setup game-specific start screen controller
  const startScreen = setupStartScreen({
    goto: (screen) => {
      void goto(screen as ScreenId);
    },
    coordinator,
    initGpu,
    unlockAudio,
    loadCore,
    loadAudio,
    loadBundle,
    tuning,
    analytics: { trackGameStart },
    onReady: () => setPixiReady(true),
  });

  /** Line the still up with the title screen's first frame. */
  function fitStill() {
    if (!stillRef) return;
    const box = stillRef.getBoundingClientRect();
    const k = cssScaleOf(stillRef);
    if (stillLogoRef) placeTitleLogo(stillLogoRef, box, k);
    if (stillBgRef?.naturalWidth) {
      const { scale, y } = titleBgMatch(
        box,
        { width: stillBgRef.naturalWidth, height: stillBgRef.naturalHeight },
        k,
      );
      stillBgRef.style.transform = `translateY(${y}px) scale(${scale})`;
    }
  }

  onMount(() => {
    fitStill();
    if (containerRef) startScreen.init(containerRef);
  });

  onCleanup(() => startScreen.destroy());

  // Space starts the game, the same as tapping play (and never toggles the scaffold's pause).
  useSpaceKey(() => startScreen.play?.());

  return (
    // `design-box-span` spans the frame box, not the 390×844 canvas: `fixed
    // inset-0` under the design root resolves to the canvas, which stops ~33 real
    // px short on each side of a 375×667 screen.
    //
    // NO `pointer-events-auto` here: this screen's only UI is Pixi (the PLAY
    // button is a SpriteButton), so the root must stay pass-through or it covers
    // the canvas and swallows the tap — the game renders perfectly and PLAY does
    // nothing. Caught by elementFromPoint at 375×667. A screen that adds DOM
    // chrome opts back in on the chrome element, not on this root.
    //
    // No background-color: the Pixi canvas is portalled out to the frame-sized
    // renderer host and now sits *underneath* this root, so painting the root
    // opaque would mask the scene out of the letterbox entirely. The renderer
    // applies startScreen.backgroundColor instead.
    <div class="design-box-span">
      {/* Pixi canvas container — portalled to the renderer host so Pixi renders
          1:1 with the screen instead of being handed a design-canvas CSS box and
          magnified. Show guards the first render, before the host ref lands. */}
      <Show when={rendererHost()}>
        {(host) => (
          <Portal mount={host()}>
            {/* A still of the title's first frame (the loader's reveal ends on it), under
                the canvas until Pixi has drawn — so the handoff never flashes empty. */}
            <Show when={!pixiReady()}>
              <div
                class="absolute inset-0 pointer-events-none"
                ref={(el) => (stillRef = el)}
              >
                <img
                  src={title.background}
                  alt=""
                  aria-hidden="true"
                  class="absolute inset-0 h-full w-full object-cover"
                  ref={(el) => (stillBgRef = el)}
                  onLoad={fitStill}
                />
                <img
                  src={title.logo}
                  alt=""
                  aria-hidden="true"
                  class="absolute"
                  style={{ transform: 'translateY(-50%)' }}
                  ref={(el) => (stillLogoRef = el)}
                />
              </div>
            </Show>
            <div ref={containerRef} class="absolute inset-0" />
          </Portal>
        )}
      </Show>

      {/* WolfGames logo at bottom centre, as on the game screen. The loader's reveal fades
          the same logo in at this spot, so it carries straight through the handoff.
          pointer-events-none keeps the root pass-through (see above). */}
      <div
        class="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ bottom: `${BRAND_LOGO.bottom}px` }}
      >
        <Logo />
      </div>
    </div>
  );
}
