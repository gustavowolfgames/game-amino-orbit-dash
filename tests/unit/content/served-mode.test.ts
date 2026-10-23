/**
 * Vault served modes (productionization #17): which mode a selection asks for, the unlocked
 * cursor's order and end, and what a completed pack does in each mode — the daily exit fires
 * once, the unlocked walk advances without reporting until its end.
 */

import type { ScheduledContentMetadata } from '@wolfgames/client';
import { describe, expect, it } from 'vitest';
import {
  createEditionCursor,
  resolveServedMode,
  scheduleDay,
  UNLOCKED_EDITIONS_CONTENT_ID,
  unlockedPacks,
} from '~/game/content';
import {
  createServedSession,
  type ServedSessionDeps,
} from '~/game/setup/served-session';

const NOW = new Date('2026-10-15T12:00:00Z');

const CATALOG: ScheduledContentMetadata[] = [
  { contentId: 'edition-2026-10-16', availableFrom: '2026-10-16' }, // tomorrow — not open yet
  { contentId: 'edition-2026-10-14', availableFrom: '2026-10-14' },
  { contentId: 'edition-2026-10-08', availableFrom: '2026-10-08' },
  { contentId: 'edition-2026-10-15', availableFrom: '2026-10-15' }, // today
];

const content = (contentId: string) => ({
  content: { type: 'content' as const, contentId },
});
const DEFAULT = { content: { type: 'default' as const } };

describe('resolveServedMode', () => {
  it.each([
    ['default selection', DEFAULT, 'default', []],
    ['no context', null, 'default', []],
    [
      "today's daily edition",
      content('edition-2026-10-15'),
      'daily',
      ['edition-2026-10-15'],
    ],
    [
      'a daily edition not in the schedule (the fetch validates it)',
      content('edition-x'),
      'daily',
      ['edition-x'],
    ],
    [
      'the unlocked sentinel',
      content(UNLOCKED_EDITIONS_CONTENT_ID),
      'unlocked',
      ['edition-2026-10-08', 'edition-2026-10-14', 'edition-2026-10-15'],
    ],
    ['an empty contentId', content(''), 'default', []],
    [
      'an unknown selection shape',
      { content: { type: 'mystery' } },
      'default',
      [],
    ],
  ])('%s', (_label, ctx, mode, packs) => {
    expect(
      resolveServedMode(
        ctx as Parameters<typeof resolveServedMode>[0],
        CATALOG,
        NOW,
      ),
    ).toEqual({ mode, packs });
  });

  it('unlocked with nothing open yet falls back to default', () => {
    const future = [
      { contentId: 'edition-2026-10-16', availableFrom: '2026-10-16' },
    ];
    expect(
      resolveServedMode(content(UNLOCKED_EDITIONS_CONTENT_ID), future, NOW)
        .mode,
    ).toBe('default');
    expect(
      resolveServedMode(content(UNLOCKED_EDITIONS_CONTENT_ID), [], NOW).mode,
    ).toBe('default');
  });

  it('the schedule day is UTC', () => {
    expect(scheduleDay(new Date('2026-10-15T23:59:59Z'))).toBe('2026-10-15');
    expect(scheduleDay(new Date('2026-10-16T00:00:00Z'))).toBe('2026-10-16');
  });
});

describe('unlockedPacks', () => {
  it('orders by day then key, drops future editions, duplicates and the sentinel', () => {
    const catalog = [
      ...CATALOG,
      { contentId: 'edition-b', availableFrom: '2026-10-08' },
      { contentId: 'edition-2026-10-14', availableFrom: '2026-10-14' },
      { contentId: UNLOCKED_EDITIONS_CONTENT_ID, availableFrom: '2026-01-01' },
    ];
    expect(unlockedPacks(catalog, NOW)).toEqual([
      'edition-2026-10-08',
      'edition-b',
      'edition-2026-10-14',
      'edition-2026-10-15',
    ]);
  });
});

describe('createEditionCursor', () => {
  it('walks in order and ends after the last pack — no wrap', () => {
    const cursor = createEditionCursor(['a', 'b', 'c']);
    expect(cursor.current()).toBe('a');
    expect(cursor.advance()).toBe('b');
    expect(cursor.advance()).toBe('c');
    expect(cursor.done()).toBe(false);
    expect(cursor.advance()).toBeNull();
    expect(cursor.done()).toBe(true);
    expect(cursor.advance()).toBeNull();
    expect(cursor.current()).toBeNull();
  });

  it('starts at a given index, and an empty walk is done at once', () => {
    expect(createEditionCursor(['a', 'b'], 1).current()).toBe('b');
    expect(createEditionCursor([]).done()).toBe(true);
  });
});

/** A session over fakes; `active` tracks the pack the last load would seed. */
function harness() {
  let active: string | null = null;
  const loads: (string | null)[] = [];
  const reports: string[] = [];
  const deps: ServedSessionDeps = {
    load: (key) => {
      loads.push(key);
      active = key;
    },
    activeContentId: () => active,
    catalog: () => CATALOG,
    now: () => NOW,
    reportContentCompleted: (id) => reports.push(`content:${id}`),
    reportGameCompleted: () => reports.push('game'),
  };
  return {
    session: createServedSession(deps),
    loads,
    reports,
    setActive: (id: string | null) => (active = id),
  };
}

describe('createServedSession', () => {
  it('default: reports the game completed, loads nothing', () => {
    const h = harness();
    h.session.select({ type: 'default' });
    expect(h.session.packCompleted()).toBe('vault'); // the Vault takes over
    expect(h.loads).toEqual([]);
    expect(h.reports).toEqual(['game']);
    expect(h.session.mode()).toBe('default');
  });

  it('daily: loads the edition and exits to the Vault exactly once', () => {
    const h = harness();
    h.session.select({ type: 'content', contentId: 'edition-2026-10-15' });
    expect(h.session.mode()).toBe('daily');
    expect(h.loads).toEqual(['edition-2026-10-15']);
    expect(h.session.packCompleted()).toBe('vault');
    expect(h.session.packCompleted()).toBe('replay'); // already handed over
    h.session.select({ type: 'content', contentId: 'edition-2026-10-15' }); // a re-send
    h.session.packCompleted();
    expect(h.reports).toEqual(['content:edition-2026-10-15']);
  });

  it('daily: a pack that failed to load (bundled still in play) never reports the edition', () => {
    const h = harness();
    h.session.select({ type: 'content', contentId: 'edition-2026-10-15' });
    h.setActive(null);
    expect(h.session.packCompleted()).toBe('replay'); // the game keeps the player
    expect(h.reports).toEqual([]);
  });

  it('unlocked: advances through open editions in schedule order, then reports once', () => {
    const h = harness();
    h.session.select({
      type: 'content',
      contentId: UNLOCKED_EDITIONS_CONTENT_ID,
    });
    expect(h.session.mode()).toBe('unlocked');
    expect(h.session.packCompleted()).toBe('next-edition'); // the next edition loads; play goes on
    expect(h.session.packCompleted()).toBe('next-edition');
    expect(h.reports).toEqual([]); // no per-edition report: it would end the session mid-walk
    expect(h.session.packCompleted()).toBe('vault'); // the last one: the Vault takes over
    expect(h.session.packCompleted()).toBe('replay');
    expect(h.loads).toEqual([
      'edition-2026-10-08',
      'edition-2026-10-14',
      'edition-2026-10-15',
    ]);
    expect(h.reports).toEqual(['game']);
  });

  it('default after a selection is a deselection; a re-sent default is ignored', () => {
    const h = harness();
    h.session.select({ type: 'default' });
    expect(h.loads).toEqual([]);
    h.session.select({ type: 'content', contentId: 'edition-2026-10-14' });
    h.session.select({ type: 'default' });
    h.session.select({ type: 'default' });
    expect(h.loads).toEqual(['edition-2026-10-14', null]);
    expect(h.session.mode()).toBe('default');
  });

  it('a new selection restarts the walk and re-arms the exit', () => {
    const h = harness();
    h.session.select({ type: 'content', contentId: 'edition-2026-10-08' });
    h.session.packCompleted();
    h.session.select({ type: 'content', contentId: 'edition-2026-10-14' });
    h.session.packCompleted();
    expect(h.reports).toEqual([
      'content:edition-2026-10-08',
      'content:edition-2026-10-14',
    ]);
  });
});
