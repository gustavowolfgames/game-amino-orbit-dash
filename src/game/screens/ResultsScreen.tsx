import { onMount } from 'solid-js';
import { useScreen } from '~/core/systems/screens';

/**
 * The `results` screen id, kept only because core's `ScreenId` requires one.
 *
 * Nothing in the template navigates here: a run ends on the game screen, on the Pixi end card
 * over the board (src/game/mygame/screens/endOfPlay.ts), or hands over to the Vault's own end
 * screen. Anything that still sends the player here (an old link, `initialScreen`) lands on the
 * menu. To look at the end card without playing a level, open `?screen=results` in a dev or QA
 * build (src/game/setup/devLinks.ts): the loader goes to the game screen with the card up.
 */
export function ResultsScreen() {
  const { goto } = useScreen();
  onMount(() => void goto('start'));
  return null;
}
