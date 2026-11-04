/**
 * Vault served modes: which mode a selection asks for, and what a completed pack does in each
 * mode. The game reads no schedule: the Vault names the pack and the game loads it.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveServedMode,
  UNLOCKED_EDITIONS_CONTENT_ID,
} from '~/game/content';
import {
  createServedSession,
  type ServedSessionDeps,
} from '~/game/setup/served-session';

const content = (contentId: string) => ({
  content: { type: 'content' as const, contentId },
});
const DEFAULT = { content: { type: 'default' as const } };

describe('resolveServedMode', () => {
  it.each([
    ['default selection', DEFAULT, 'default', null],
    ['no context', null, 'default', null],
    [
      'a daily edition',
      content('edition-2026-10-15'),
      'daily',
      'edition-2026-10-15',
    ],
    [
      'the unlocked sentinel plays the default',
      content(UNLOCKED_EDITIONS_CONTENT_ID),
      'default',
      null,
    ],
    ['an empty contentId', content(''), 'default', null],
    [
      'an unknown selection shape',
      { content: { type: 'mystery' } },
      'default',
      null,
    ],
  ])('%s', (_label, ctx, mode, pack) => {
    expect(
      resolveServedMode(ctx as Parameters<typeof resolveServedMode>[0]),
    ).toEqual({ mode, pack });
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

  it('unlocked sentinel: plays the default, loads nothing, reports the game completed', () => {
    const h = harness();
    h.session.select({
      type: 'content',
      contentId: UNLOCKED_EDITIONS_CONTENT_ID,
    });
    expect(h.session.mode()).toBe('default');
    expect(h.loads).toEqual([]);
    expect(h.session.packCompleted()).toBe('vault');
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

  it.each([
    [
      'the unlocked sentinel',
      { type: 'content' as const, contentId: UNLOCKED_EDITIONS_CONTENT_ID },
    ],
    ['default', { type: 'default' as const }],
  ])(
    '%s after boot loaded a daily pack drops it and reports the game',
    (_l, sel) => {
      const h = harness();
      h.setActive('edition-boot'); // boot's first-context gate seeded it
      h.session.select(sel);
      expect(h.loads).toEqual([null]);
      expect(h.session.packCompleted()).toBe('vault');
      expect(h.reports).toEqual(['game']);
    },
  );

  it('a new selection re-arms the exit', () => {
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
