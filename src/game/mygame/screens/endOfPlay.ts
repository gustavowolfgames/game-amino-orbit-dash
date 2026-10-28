/**
 * endOfPlay — what happens when a run ends, kept out of the controller so it stays thin.
 *
 * A terminal phase (`won` / `lost`) never leaves the game screen:
 *
 *   • A won level records progress and celebrates (flash + confetti over the board).
 *   • The pack's last level goes through the Vault's served session (`completeActivePack`):
 *     when the Vault takes over, the game shows nothing of its own.
 *   • Otherwise, after a beat, the end card (`../render/endScreen.ts`) comes up over the board:
 *     Next level / Try again / Play again (or Next edition in the Vault's unlocked walk), and
 *     Main menu. Its primary action waits for any new edition to load, then starts the next run.
 *
 * Input reaches it as intents (`input`): Enter / Space / Escape from `useGameKeyboard`, and the
 * screen-reader buttons `GameScreen` renders while the card is up. Pause and the settings menu
 * lock both, the same as taps on the board.
 *
 * The controller drives it: `handlePhase` and `tick` from its per-frame render, `reset` from
 * `startRun`, `destroy` before the Pixi app goes. A dev/QA `?screen=results` link
 * (src/game/setup/devLinks.ts) calls `preview` once the first run has started.
 */

import type { Container } from 'pixi.js';
import type { PixiLoader } from '~/core/systems/assets';
import { pauseState } from '~/core/systems/pause';
import { isLastLevel } from '~/game/content';
import type { GameIntent } from '~/game/mygame-contract';
import { settingsOpen } from '~/game/settingsOpen';
import type { RunAnalytics } from '~/game/setup/edition-analytics';
import { recordLevelWon } from '~/game/setup/progress';
import { completeActivePack } from '~/game/setup/served-session';
import {
  createEndScreen,
  type EndOutcome,
  type EndScreenOptions,
} from '../render/endScreen';
import type { GameDatabase, GamePhase } from '../sim/plugin';
import { createRunEnd } from './runEnd';

/** Delay (s) before the end card, so the last frame (and the confetti) reads. */
export const END_PAUSE = 0.9;

/**
 * What `?screen=results` shows: the run's level, won, scored at its goal (what a real win of it
 * scores). The primary button restarts that level: nothing was won, so nothing moves on.
 */
export function resultsPreview(level: number, goal: number): EndOutcome {
  return { won: true, packDone: isLastLevel(level), level, score: goal };
}

export interface EndOfPlayDeps {
  /** The game's design-space root: the card and its effects draw on top of the board here. */
  root: Container;
  gpu: PixiLoader;
  /** The world, or null once the controller is torn down. */
  world: () => GameDatabase | null;
  analytics: RunAnalytics;
  /** Confetti and flash colours from the current theme. */
  palette: EndScreenOptions['palette'];
  /** The card's own flash and confetti on a win; false while the juice kit plays the win
   *  payoff (./feedback.ts). Default true. */
  celebrates?: () => boolean;
  /** Seconds from the end to the card (read at each end). Default `END_PAUSE`. */
  pause?: () => number;
  /** Start the next run once any new edition has loaded (the controller's `startWhenSettled`). */
  playOn: () => Promise<void>;
  /** Main menu. */
  toMenu: () => void;
  /** The card's screen-reader line. */
  say: (text: string) => void;
  /** The card went up or down. */
  onOpenChange: (open: boolean) => void;
}

export interface EndOfPlay {
  /** The card is up (board input is off). */
  readonly open: boolean;
  /** Called every frame with the run's phase; acts once per terminal phase. */
  handlePhase(phase: GamePhase): void;
  /** A run started: forget the last end and take the card down. */
  reset(): void;
  /** Enter / Space = the card's primary action, Escape = Main menu. */
  input(intent: GameIntent): void;
  /** Dev/QA `?screen=results`: the card for the run in play (`resultsPreview`), up now.
   *  Records no progress and sends no analytics. */
  preview(): void;
  tick(dtSec: number): void;
  destroy(): void;
}

export function createEndOfPlay(deps: EndOfPlayDeps): EndOfPlay {
  let destroyed = false;
  /** The card the current end will show; null when the Vault takes over. */
  let outcome: EndOutcome | null = null;

  /** Next / Try again / Play again. A finished pack in the Vault's unlocked walk has started
   *  loading the next edition; the controller waits for it (bounded) so the run starts there. */
  const playOn = () => {
    card.hide();
    void deps.playOn();
  };

  const card = createEndScreen(deps.root, deps.gpu, {
    palette: deps.palette,
    onPrimary: () => void playOn(),
    onSecondary: deps.toMenu,
    onOpenChange: deps.onOpenChange,
  });

  /** Once per terminal phase; a run restarted during the pause cancels the card (./runEnd.ts). */
  const runEnd = createRunEnd({
    pause: deps.pause ?? END_PAUSE,
    onEnd: (phase) => {
      outcome = null;
      const db = deps.world();
      if (!db) return;
      const { level, score, packId } = db.resources;
      const won = phase === 'won';
      const last = won && isLastLevel(level);
      if (won) deps.analytics.levelWon(level, score);
      // The Vault's served mode decides what a finished pack means.
      const next = last ? completeActivePack() : 'replay';
      if (won) {
        recordLevelWon(packId, level, last); // a reload resumes the next level
        if (deps.celebrates?.() ?? true) card.celebrate();
      }
      if (next === 'vault') return; // the Vault's end screen, not ours
      outcome = {
        won,
        packDone: last,
        nextEdition: next === 'next-edition',
        level,
        score,
      };
    },
    afterPause: () => {
      if (!destroyed && outcome) deps.say(card.show(outcome));
    },
    phase: () => deps.world()?.resources.phase ?? 'idle',
  });

  return {
    get open() {
      return card.open;
    },

    handlePhase(phase) {
      runEnd.update(phase);
    },

    reset() {
      runEnd.reset();
      outcome = null;
      if (card.open) card.hide(); // the Inspector's restart, mid-card
    },

    input(intent) {
      // Same lock as taps on the board: nothing acts under the pause overlay or the menu.
      if (!card.ready || pauseState.paused() || settingsOpen()) return;
      if (intent.type === 'action') void playOn();
      else if (intent.type === 'back') deps.toMenu();
    },

    preview() {
      const db = deps.world();
      if (destroyed || !db) return;
      runEnd.reset();
      outcome = resultsPreview(db.resources.level, db.resources.goal);
      deps.say(card.show(outcome));
    },

    tick(dtSec) {
      card.tick(dtSec);
    },

    destroy() {
      destroyed = true;
      runEnd.reset();
      card.destroy();
    },
  };
}
