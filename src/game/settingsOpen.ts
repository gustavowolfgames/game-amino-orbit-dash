/**
 * Whether the settings menu is open. The menu (`screens/components/GameSettingsMenu.tsx`)
 * sets it; the game reads it to stop its sim and input while the menu is up.
 *
 * Kept apart from the core pause state on purpose: that one also shows a
 * "PAUSED — press space" overlay, which an open menu doesn't need.
 */

import { createRoot, createSignal } from 'solid-js';

export const [settingsOpen, setSettingsOpen] = createRoot(() =>
  createSignal(false),
);
