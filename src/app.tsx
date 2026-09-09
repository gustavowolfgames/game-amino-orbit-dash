import { parseEnvironment } from '@wolfgames/client';
import {
  AnalyticsProvider,
  DevOnly,
  GameConfigProvider,
  useAnalyticsService,
  useGameConfig,
  ViewportModeWrapper,
  ViewportProvider,
  ViewportToggle,
} from '@wolfgames/components/solid';
import { onCleanup, onMount, type ParentComponent } from 'solid-js';
import {
  AssetProvider,
  CdnManifestProvider,
  FeatureFlagProvider,
  getResolvedPlayerId,
  GlobalBoundary,
  initPauseKeyboard,
  PauseProvider,
  ScreenProvider,
  ScreenRenderer,
  SettingsMenu,
  setupGlobalErrorHandlers,
  TuningProvider,
} from '~/core';
import { initSentry } from '~/core/lib/sentry';
import { defaultGameData, gameConfig } from '~/game';
import { manifest } from '~/game/asset-manifest';
import { GAME_DEFAULTS } from '~/game/tuning';
import './app.css';
import { Show } from 'solid-js';
import { Inspector } from '~/core/dev/inspector';
import { activeDb } from '~/core/systems/ecs/DbBridge';
import { createExampleWorld } from '~/core/systems/ecs/ExamplePlugin';
import { useGameTracking } from '~/game/setup/tracking';
import '~/game/setup/flags'; // registers flag config at module load
import { useAssetCoordinator } from '~/core/systems/assets';
import { EmbedHook } from '~/game/EmbedHook';
import { createLoadingTracker } from '~/game/setup/loading-tracker';
import { createSessionTracker } from '~/game/setup/session-tracker';
import { AttractGate, EmbedProvider } from '~/integrations/embed';
import { VaultHostBridge } from '~/integrations/vault';

const environment = parseEnvironment(import.meta.env.VITE_APP_ENV);

/** Reset progress and reload the page */
const handleResetProgress = () => {
  window.location.reload();
};

/** Wires session lifecycle events (start, pause, resume, end) */
function SessionTrackerBridge() {
  const service = useAnalyticsService();
  const cleanup = createSessionTracker(service, gameConfig.initialScreen);
  onCleanup(cleanup);
  return null;
}

/** Wires loading events (start, complete, abandon) to asset coordinator */
function LoadingTrackerBridge() {
  const service = useAnalyticsService();
  const coordinator = useAssetCoordinator();
  const cleanup = createLoadingTracker(service, coordinator.loadingStateSignal);
  onCleanup(cleanup);
  return null;
}

/** SettingsMenu wired with game analytics */
function GameSettingsMenu() {
  const config = useGameConfig();
  const { trackAudioSettingChanged } = useGameTracking();
  return (
    <SettingsMenu
      onResetProgress={!config.isProduction() ? handleResetProgress : undefined}
      onAudioSettingChanged={trackAudioSettingChanged}
    />
  );
}

const TuningViewportBridge: ParentComponent = (props) => (
  <ViewportProvider autoFill>{props.children}</ViewportProvider>
);

// Example ECS database — shown in Inspector when no game is active
const exampleDB = createExampleWorld();

export default function App() {
  onMount(async () => {
    // Initialize error tracking
    initSentry(environment);

    // Setup global error handlers
    setupGlobalErrorHandlers();

    // Initialize pause keyboard (spacebar)
    initPauseKeyboard();
  });

  return (
    <EmbedProvider>
      <GameConfigProvider debug>
        <AnalyticsProvider userId={getResolvedPlayerId() ?? undefined}>
          <SessionTrackerBridge />
          <GlobalBoundary>
            <TuningProvider gameDefaults={GAME_DEFAULTS}>
              <DevOnly>
                <Show when={activeDb()} fallback={<Inspector db={exampleDB} />}>
                  {(db) => <Inspector db={db()} />}
                </Show>
              </DevOnly>
              <FeatureFlagProvider>
                <TuningViewportBridge>
                  <ViewportModeWrapper>
                    {/* Settings Menu - Top Right Corner */}
                    <div class="fixed top-2 right-2 z-[9999]">
                      <GameSettingsMenu />
                    </div>
                    {/* Viewport Toggle - dev only; self-positions via Portal */}
                    <DevOnly>
                      <ViewportToggle />
                    </DevOnly>
                    <PauseProvider>
                      <CdnManifestProvider
                        manifest={manifest}
                        defaultGameData={defaultGameData}
                      >
                        <AssetProvider>
                          <LoadingTrackerBridge />
                          <ScreenProvider
                            options={{
                              initialScreen: gameConfig.initialScreen,
                              screenAssets: gameConfig.screenAssets,
                            }}
                          >
                            {/* Generic Vault runtime; inert outside a Vault.
                                Must stay inside ScreenProvider — reads
                                useScreen() to hold `ready` until playable. */}
                            <VaultHostBridge />
                            <AttractGate
                              hook={(engage) => <EmbedHook engage={engage} />}
                            >
                              <ScreenRenderer screens={gameConfig.screens} />
                            </AttractGate>
                          </ScreenProvider>
                        </AssetProvider>
                      </CdnManifestProvider>
                    </PauseProvider>
                  </ViewportModeWrapper>
                </TuningViewportBridge>
              </FeatureFlagProvider>
            </TuningProvider>
          </GlobalBoundary>
        </AnalyticsProvider>
      </GameConfigProvider>
    </EmbedProvider>
  );
}
