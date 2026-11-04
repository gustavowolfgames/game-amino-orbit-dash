/**
 * Edition analytics (src/game/setup/edition-analytics.ts): the edition fields, the super
 * properties re-registered on every pack change, and the level / edition events a run sends.
 * The analytics service is faked down to the three methods the module calls.
 */

import type { BaseAnalyticsService } from '@wolfgames/components/core';
import { type } from 'arktype';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ActivePack,
  getActivePack,
  levelAt,
  seedActivePack,
} from '~/game/content';
import {
  createRunAnalytics,
  editionProps,
  levelId,
  registerEditionSuperProperties,
} from '~/game/setup/edition-analytics';

interface Sent {
  event: string;
  props: Record<string, unknown>;
}

/** A service that records tracked events (after schema validation) and registered properties. */
function fakeService(ready: Promise<void> = Promise.resolve()) {
  const sent: Sent[] = [];
  const registered: Record<string, unknown>[] = [];
  const service = {
    createTracker:
      (event: string, schema: (p: unknown) => unknown) =>
      (props: Record<string, unknown>) => {
        const out = schema(props);
        if (out instanceof type.errors)
          throw new Error(`${event}: ${out.summary}`);
        sent.push({ event, props });
      },
    register: (props: Record<string, unknown>) => {
      registered.push(props);
    },
    whenReady: () => ready,
  };
  return {
    service: service as unknown as BaseAnalyticsService,
    sent,
    registered,
  };
}

/** A published pack of `n` levels, optionally selected by a Vault `contentId`. */
const packOf = (
  id: string,
  n: number,
  contentId: string | null = null,
): ActivePack => ({
  id,
  levels: Array.from({ length: n }, () => levelAt(0)),
  source: 'published',
  contentId,
});

afterEach(() => {
  seedActivePack(null);
});

describe('editionProps', () => {
  it('the bundled default is its pack key', () => {
    expect(editionProps(getActivePack())).toEqual({
      edition_id: getActivePack().id,
    });
  });
});

describe('registerEditionSuperProperties', () => {
  it('registers at mount, on every pack change, and again once PostHog is ready', async () => {
    let markReady = () => {};
    const ready = new Promise<void>((r) => {
      markReady = r;
    });
    const { service, registered } = fakeService(ready);
    const stop = registerEditionSuperProperties(service);
    const bundledId = getActivePack().id;
    expect(registered).toEqual([{ edition_id: bundledId }]);

    seedActivePack(packOf('pack-1', 2));
    seedActivePack(packOf('pack-2', 2));
    expect(registered.slice(1)).toEqual([
      { edition_id: 'pack-1' },
      { edition_id: 'pack-2' },
    ]);

    // PostHog drops `register` before it has loaded; the latest pack is re-sent when it has.
    markReady();
    await ready;
    expect(registered.at(-1)).toEqual({
      edition_id: 'pack-2',
    });
    const count = registered.length;

    stop();
    seedActivePack(packOf('pack-3', 2));
    expect(registered).toHaveLength(count);
  });
});

describe('createRunAnalytics', () => {
  it('is a no-op without a service', () => {
    const run = createRunAnalytics(undefined);
    expect(() => {
      run.levelStarted(0, 'fresh');
      run.levelWon(0, 10);
    }).not.toThrow();
  });

  it('sends edition_started on level 1 and edition_completed on the last level won', () => {
    seedActivePack(packOf('pack-x', 2));
    const { service, sent } = fakeService();
    let t = 1_000;
    const run = createRunAnalytics(service, () => t);

    run.levelStarted(0, 'fresh');
    t += 2_500;
    run.levelWon(0, 40);
    run.levelStarted(1, 'next');
    t += 1_250;
    run.levelWon(1, 70);

    expect(sent).toEqual([
      {
        event: 'level_start',
        props: {
          level_id: levelId('pack-x', 0),
          level_order: 1,
          is_replay: false,
        },
      },
      {
        event: 'edition_started',
        props: { edition_id: 'pack-x' },
      },
      {
        event: 'level_complete',
        props: {
          level_id: 'pack-x/1',
          level_order: 1,
          time_to_complete: 2.5,
          score: 40,
        },
      },
      {
        event: 'level_start',
        props: { level_id: 'pack-x/2', level_order: 2, is_replay: false },
      },
      {
        event: 'level_complete',
        props: {
          level_id: 'pack-x/2',
          level_order: 2,
          time_to_complete: 1.25,
          score: 70,
        },
      },
      {
        event: 'edition_completed',
        props: { edition_id: 'pack-x' },
      },
    ]);
  });

  it('counts restarts, and a loop back to level 1 is a replay that starts the edition again', () => {
    seedActivePack(packOf('pack-y', 1));
    const { service, sent } = fakeService();
    const run = createRunAnalytics(service);

    run.levelStarted(0, 'fresh');
    run.levelStarted(0, 'restart');
    run.levelStarted(0, 'restart');
    run.levelWon(0, 5);
    run.levelStarted(0, 'next');

    const events = sent.map((s) => s.event);
    expect(events).toEqual([
      'level_start',
      'edition_started',
      'level_restart',
      'level_restart',
      'level_complete',
      'edition_completed',
      'level_start',
      'edition_started',
    ]);
    expect(sent[3].props).toMatchObject({
      level_id: 'pack-y/1',
      restart_count: 2,
    });
    expect(sent[6].props).toMatchObject({ is_replay: true });
  });

  it('level_fail carries the reason and time played, and never completes the edition', () => {
    seedActivePack(packOf('pack-z', 1));
    const { service, sent } = fakeService();
    let t = 0;
    const run = createRunAnalytics(service, () => t);
    run.levelStarted(0, 'fresh');
    t += 3_000;
    run.levelFailed(0, 'out_of_moves');
    expect(sent.at(-1)).toEqual({
      event: 'level_fail',
      props: {
        level_id: 'pack-z/1',
        level_order: 1,
        fail_reason: 'out_of_moves',
        time_played: 3,
      },
    });
    expect(sent.map((s) => s.event)).not.toContain('edition_completed');
  });
});
