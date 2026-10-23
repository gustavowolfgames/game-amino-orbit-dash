import { onMount } from 'solid-js';
import { useScreen } from '~/core/systems/screens';

/**
 * The `results` screen id, kept only because core's `ScreenId` requires one.
 *
 * Nothing in the template navigates here: a run ends on the game screen, on the Pixi end card
 * over the board (src/game/mygame/screens/endOfPlay.ts), or hands over to the Vault's own end
 * screen. Anything that still sends the player here (an old link, `initialScreen`) lands on the
 * menu.
 */
export function ResultsScreen() {
  const { goto } = useScreen();
  onMount(() => void goto('start'));
  return null;
}
