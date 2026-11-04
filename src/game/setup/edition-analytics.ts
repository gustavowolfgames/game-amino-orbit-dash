/**
 * Edition + level analytics — which Content Pack is in play, and when a run of it starts and ends.
 *
 *   registerEditionSuperProperties(service)  app mount: `edition_id` as a PostHog super property,
 *                                            re-registered on every pack change
 *   createRunAnalytics(service)              game controller: `level_start` / `level_restart` /
 *                                            `level_complete`, plus `edition_started` (first level
 *                                            of a run) and `edition_completed` (last level won)
 *
 * An edition IS the active Content Pack (`~/game/content`): `edition_id` is its pack key,
 * The game knows no dates: the Vault names the pack for the day.
 *
 * Super properties are driven by `onActivePackChange`, never by screen code, so each new pack
 * re-registers its own (PostHog `register` overwrites — nothing is appended).
 * `register` is a silent no-op until the PostHog SDK has loaded (it loads lazily), so the latest
 * values are registered again once it is ready. Events queued before that flush without them,
 * which is why the edition events also carry the field as their own prop.
 */

import type { BaseAnalyticsService } from '@wolfgames/components/core';
import {
  type ActivePack,
  getActivePack,
  isLastLevel,
  onActivePackChange,
} from '~/game/content';
import {
  editionCompletedSchema,
  editionStartedSchema,
  levelCompleteSchema,
  levelFailSchema,
  levelRestartSchema,
  levelStartSchema,
} from './events';

/** The edition fields: event props on edition_started/completed, super properties on the rest. */
export interface EditionProps {
  edition_id: string;
}

/** The edition fields for `pack` (the pack in play by default). */
export function editionProps(pack: ActivePack = getActivePack()): EditionProps {
  return { edition_id: pack.id };
}

/**
 * Register the active pack's edition fields as super properties now, again on every pack change,
 * and once more when PostHog has loaded. Call once at app mount; returns the unsubscribe.
 */
export function registerEditionSuperProperties(
  service: BaseAnalyticsService,
): () => void {
  const sync = (pack: ActivePack = getActivePack()) => {
    service.register({ ...editionProps(pack) });
  };
  sync();
  let live = true;
  void service.whenReady().then(() => {
    if (live) sync();
  });
  const unsubscribe = onActivePackChange(sync);
  return () => {
    live = false;
    unsubscribe();
  };
}

/** How a run's level begins: a fresh run, the next level after a win, or the same level again. */
export type LevelEntry = 'fresh' | 'next' | 'restart';

export interface RunAnalytics {
  /** The level at 0-based `index` of the active pack became playable. */
  levelStarted(index: number, entry: LevelEntry): void;
  /** The level at `index` was won with `score`. On the pack's last level the edition completes. */
  levelWon(index: number, score: number): void;
  /** The level at `index` ended without a win (the sample has no losing state; a game with one calls this). */
  levelFailed(index: number, reason: string): void;
}

const NO_OP: RunAnalytics = {
  levelStarted: () => {},
  levelWon: () => {},
  levelFailed: () => {},
};

function isService(value: unknown): value is BaseAnalyticsService {
  return (
    typeof (value as Partial<BaseAnalyticsService> | null)?.createTracker ===
    'function'
  );
}

/** A level's stable id: the pack key and its 1-based order (levels carry no id of their own). */
export const levelId = (packId: string, index: number) =>
  `${packId}/${index + 1}`;

/**
 * The gameplay trackers the controller calls. `analytics` is `GameControllerDeps.analytics`; a
 * missing service yields no-ops (tests, previews). `now` is injectable for tests.
 */
export function createRunAnalytics(
  analytics: unknown,
  now: () => number = Date.now,
): RunAnalytics {
  if (!isService(analytics)) return NO_OP;
  const track = {
    levelStart: analytics.createTracker(
      'level_start',
      levelStartSchema,
      ['base'],
      {},
    ),
    levelRestart: analytics.createTracker(
      'level_restart',
      levelRestartSchema,
      ['base'],
      {},
    ),
    levelComplete: analytics.createTracker(
      'level_complete',
      levelCompleteSchema,
      ['base'],
      {},
    ),
    levelFail: analytics.createTracker(
      'level_fail',
      levelFailSchema,
      ['base'],
      {},
    ),
    editionStarted: analytics.createTracker(
      'edition_started',
      editionStartedSchema,
      ['base'],
      {},
    ),
    editionCompleted: analytics.createTracker(
      'edition_completed',
      editionCompletedSchema,
      ['base'],
      {},
    ),
  };
  let startedAt = now();
  let restarts = 0;
  const elapsed = () => Math.round((now() - startedAt) / 10) / 100; // seconds, 2 dp
  const levelOf = (index: number) => ({
    level_id: levelId(getActivePack().id, index),
    level_order: index + 1,
  });

  return {
    levelStarted(index, entry) {
      const base = levelOf(index);
      startedAt = now();
      if (entry === 'restart') {
        restarts += 1;
        track.levelRestart({ ...base, restart_count: restarts });
        return;
      }
      restarts = 0;
      // `next` landing on level 1 is the pack looping round after its last level: a replay.
      track.levelStart({ ...base, is_replay: entry === 'next' && index === 0 });
      if (index === 0) track.editionStarted(editionProps());
    },
    levelWon(index, score) {
      track.levelComplete({
        ...levelOf(index),
        time_to_complete: elapsed(),
        score,
      });
      if (isLastLevel(index)) track.editionCompleted(editionProps());
    },
    levelFailed(index, reason) {
      track.levelFail({
        ...levelOf(index),
        fail_reason: reason,
        time_played: elapsed(),
      });
    },
  };
}
