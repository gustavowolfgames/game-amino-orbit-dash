/**
 * Feedback table (src/game/mygame/screens/feedback.ts) and the Carina switch
 * (src/game/setup/carina.ts): the juice plays from events, at the tap's point,
 * and not at all with `?carina=0`.
 */

import { describe, expect, it } from 'vitest';
import type { GameTheme } from '~/game/brand';
import type { Juice } from '~/game/mygame/render/juice';
import { createFeedback } from '~/game/mygame/screens/feedback';
import type { GameEvent } from '~/game/mygame/sim/plugin';
import { carinaFromSearch } from '~/game/setup/carina';
import { GAME_DEFAULTS } from '~/game/tuning';

const theme = {
  accent: '#F6C453',
  pieces: [0x112233],
  fonts: { numeric: 'sans-serif' },
} as unknown as GameTheme;

function fakeJuice() {
  const calls: Array<[string, ...unknown[]]> = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const juice = {
    burst: rec('burst'),
    sparkle: rec('sparkle'),
    fly: rec('fly'),
    pop: rec('pop'),
    flash: rec('flash'),
    cascade: rec('cascade'),
    shake: rec('shake'),
    freeze: (frames: number, then: () => void) => {
      calls.push(['freeze', frames]);
      then(); // run the payoff at once in the test
    },
  } as unknown as Juice;
  return { juice, calls };
}

function setup(on: boolean) {
  const { juice, calls } = fakeJuice();
  const played: string[] = [];
  const hud = {} as never;
  const cues = createFeedback({
    juice: () => juice,
    hud: () => hud,
    root: () => hud,
    theme: () => theme,
    tuning: () => GAME_DEFAULTS.juice,
    on: () => on,
    play: (id) => played.push(id),
    say: () => {},
  });
  return { cues, calls, played };
}

const scored: GameEvent = { type: 'scored', x: 120, y: 300, score: 1 };
const won: GameEvent = { type: 'phase', phase: 'won' };

describe('carinaFromSearch', () => {
  it('reads ?carina=0/1 and ignores everything else', () => {
    expect(carinaFromSearch('?carina=0')).toBe(false);
    expect(carinaFromSearch('?screen=game&carina=off')).toBe(false);
    expect(carinaFromSearch('?carina=1')).toBe(true);
    expect(carinaFromSearch('?carina')).toBe(true);
    expect(carinaFromSearch('?screen=game')).toBeNull();
    expect(carinaFromSearch('?carina=maybe')).toBeNull();
  });
});

describe('createFeedback', () => {
  it('plays the tap juice at the tap point, on the same frame', () => {
    const { cues, calls, played } = setup(true);
    cues([scored], 0);
    expect(played).toEqual(['sfx-pop']);
    const burst = calls.find((c) => c[0] === 'burst');
    expect(burst?.slice(1, 3)).toEqual([120, 300]);
    expect(calls.map((c) => c[0])).toEqual(['burst', 'sparkle', 'fly', 'pop']);
  });

  it('holds a freeze before the win payoff', () => {
    const { cues, calls } = setup(true);
    cues([won], 0);
    expect(calls[0]).toEqual(['freeze', GAME_DEFAULTS.juice.winFreezeFrames]);
    expect(calls.filter((c) => c[0] === 'cascade')).toHaveLength(
      GAME_DEFAULTS.juice.winCascades,
    );
  });

  it('keeps sound and drops every effect with carina off', () => {
    const { cues, calls, played } = setup(false);
    cues([scored, won], 0);
    expect(played).toEqual(['sfx-pop', 'sfx-clear']);
    expect(calls).toEqual([]);
  });
});
