/**
 * Game Configuration
 *
 * Screen wiring, asset manifest, and data types.
 * Game identity (projectId, slug, CDN URLs) comes from GameConfigProvider.
 */

import { lazy, type Component } from 'solid-js';
import type { ViewportMode } from '@wolfgames/components/core';
import type { ScreenId, ScreenAssetConfig, TransitionConfig } from '~/core/systems/screens/types';
import { LoadingScreen } from './screens/LoadingScreen';
import { ResultsScreen } from './screens/ResultsScreen';

/** Game font family — loaded via @font-face in app.css */
export const GAME_FONT_FAMILY = 'Baloo, system-ui, sans-serif';

/** Game title shown by the intro-sting loader once the WolfGames lockup settles
 *  into its publisher footer. Replace with your game's name. */
export const GAME_TITLE = 'My Game';

// ============================================================================
// DATA TYPES
//
// Define your game's data schema here.
// These types are used by useGameData() and the ManifestProvider.
// ============================================================================

/** Dialogue message for companion/NPC interactions */
export interface DialogueMessage {
  id: string;
  speaker?: string;
  text: string;
}

/**
 * Game data fetched from server / injected by host.
 * Replace with your game's actual data shape.
 */
export interface GameData {
  uid: string;
  name: string;
}
// ============================================================================
// SCREEN WIRING
// ============================================================================

export interface GameConfig {
  screens: {
    loading: Component;
    start: Component;
    game: Component;
    results: Component;
  };
  /** Per-screen asset requirements. The screen manager loads required bundles
   *  before showing the screen and background-loads optional bundles. */
  screenAssets?: Partial<Record<ScreenId, ScreenAssetConfig>>;
  initialScreen: 'loading' | 'start' | 'game' | 'results';
  defaultViewportMode?: ViewportMode;
  /** Skip the title/start screen and go straight from loading to gameplay.
   *  Title-screen asset bundles (e.g. boot-ui) are background-loaded rather
   *  than blocking. Intended for playable ad units where a start screen is
   *  not required. Default: false. */
  skipStartScreen?: boolean;
  /** The app-wide fade between screens. Default: 300 ms fade out, then in. */
  screenTransition?: TransitionConfig;
}

export const gameConfig: GameConfig = {
  screens: {
    loading: LoadingScreen,
    start: lazy(() => import('./screens/StartScreen')),
    game: lazy(() => import('./screens/GameScreen')),
    results: ResultsScreen,
  },
  initialScreen: 'loading',
  // No app-wide fade: the loader reveals straight into the title's first frame, the
  // title fades its own art out on Play, and a run restarts on the game screen.
  screenTransition: { type: 'none', duration: 0 },
};
