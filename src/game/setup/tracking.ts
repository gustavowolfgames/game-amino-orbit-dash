import { useAnalyticsService } from '@wolfgames/components/solid';
import type { GameAnalyticsService } from './analytics-service';
import {
  audioSettingChangedSchema,
  errorCapturedSchema,
  gameStartSchema,
  screenEnterSchema,
  screenExitSchema,
  startScreenSkippedSchema,
} from './events';

// ============================================================================
// GAME TRACKING HOOK
// ============================================================================

export interface GameTracking {
  trackGameStart: (params: typeof gameStartSchema.infer) => void;
  trackAudioSettingChanged: (
    params: typeof audioSettingChangedSchema.infer,
  ) => void;
  trackScreenView: (params: typeof screenEnterSchema.infer) => void;
  trackScreenExit: (params: typeof screenExitSchema.infer) => void;
  trackError: (params: typeof errorCapturedSchema.infer) => void;
  trackStartScreenSkipped: (
    params: typeof startScreenSkippedSchema.infer,
  ) => void;
  service: GameAnalyticsService;
}

export function useGameTracking(): GameTracking {
  // useAnalyticsService returns the bare AnalyticsService type, which erases
  // the `base` param registration — see GameAnalyticsService.
  const service = useAnalyticsService() as GameAnalyticsService;

  return {
    trackGameStart: service.createTracker(
      'game_start',
      gameStartSchema,
      ['base'],
      {},
    ),
    trackAudioSettingChanged: service.createTracker(
      'audio_setting_changed',
      audioSettingChangedSchema,
      ['base'],
      {},
    ),
    trackScreenView: service.createTracker(
      'screen_enter',
      screenEnterSchema,
      ['base'],
      {},
    ),
    trackScreenExit: service.createTracker(
      'screen_exit',
      screenExitSchema,
      ['base'],
      {},
    ),
    trackError: service.createTracker(
      'error_captured',
      errorCapturedSchema,
      ['base'],
      {},
    ),
    trackStartScreenSkipped: service.createTracker(
      'start_screen_skipped',
      startScreenSkippedSchema,
      ['base'],
      {},
    ),
    service,
  };
}
