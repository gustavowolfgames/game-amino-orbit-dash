/**
 * The game's one settings menu: the catalog `settings-menu-dom` (gear, panel,
 * dismiss behaviour) with this game's theme and callbacks, on every screen. While
 * it is open `settingsOpen` is true, which stops the game's sim and input.
 *
 * Catalog check: `prefabs/settings-menu-dom` is the whole menu; nothing here is
 * hand-rolled but the analytics wiring, which is game-specific by definition.
 */

import { SettingsMenuDom } from '@wolfgames/components/modules/prefabs/settings-menu-dom';
import { useGameConfig } from '@wolfgames/components/solid';
import { useAudio } from '~/core/systems/audio';
import { setSettingsOpen } from '~/game/settingsOpen';
import { SETTINGS_THEME } from '~/game/settingsTheme';
import { useGameTracking } from '~/game/setup/tracking';

import gearIcon from './assets/icon_gear.svg';
import musicIcon from './assets/icon_sound_music2.svg';
import trashIcon from './assets/icon_trash.svg';
import volumeIcon from './assets/icon_volume_high.svg';

export interface GameSettingsMenuProps {
  /** Shows the reset row when provided (dev builds pass it). */
  onResetProgress?: () => void;
}

export function GameSettingsMenu(props: GameSettingsMenuProps) {
  const audio = useAudio();
  const config = useGameConfig();
  const { trackAudioSettingChanged } = useGameTracking();

  // Debounced so a slider drag reports once, not per frame.
  let volumeTimer: ReturnType<typeof setTimeout> | null = null;
  let volumeBeforeDrag = audio.volume();
  const trackVolume = (next: number) => {
    if (volumeTimer) clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => {
      trackAudioSettingChanged({
        setting_type: 'volume',
        old_value: volumeBeforeDrag,
        new_value: next,
        screen_name: 'settings_menu',
      });
      volumeBeforeDrag = next;
    }, 300);
  };

  return (
    <SettingsMenuDom
      gearSrc={gearIcon}
      onOpenChange={setSettingsOpen}
      {...SETTINGS_THEME}
      items={[
        {
          type: 'slider',
          label: 'Sounds',
          iconSrc: volumeIcon,
          value: audio.volume(),
          min: 0,
          max: 1,
          step: 0.05,
          onChange: (value) => {
            audio.setVolume(value);
            trackVolume(value);
          },
        },
        {
          type: 'toggle',
          label: 'Music',
          iconSrc: musicIcon,
          value: audio.musicEnabled(),
          onChange: (value) => {
            audio.toggleMusic();
            trackAudioSettingChanged({
              setting_type: 'mute',
              old_value: !value,
              new_value: value,
              screen_name: 'settings_menu',
            });
          },
        },
        ...(props.onResetProgress && !config.isProduction()
          ? [
              {
                type: 'button' as const,
                label: 'Reset Progress',
                iconSrc: trashIcon,
                onClick: () => props.onResetProgress?.(),
              },
            ]
          : []),
      ]}
    />
  );
}
