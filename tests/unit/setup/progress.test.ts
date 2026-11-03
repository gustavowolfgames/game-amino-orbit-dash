import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real `createVersionedStore` and SDK `GameSaveService` run against an in-memory
// localStorage; only the player-identity seam is stubbed (no network, fixed uuid).
vi.mock('~/core/systems/identity', () => {
  const identity = { uuid: 'player-1', isAnonymous: true };
  return {
    resolvePlayerId: async () => identity.uuid,
    getResolvedIdentityService: () => ({
      identify: async () => identity,
      subscribe: () => () => {},
    }),
  };
});

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

let storage: MemoryStorage;

/** Fresh modules per boot: the store, its priming, and the active pack all start over. */
async function boot() {
  vi.resetModules();
  const progress = await import('~/game/setup/progress.save');
  const content = await import('~/game/content');
  const { whenStoresReady } = await import('~/core/utils/storage');
  await whenStoresReady();
  return { ...progress, ...content };
}

const envelopeKey = (key: string) => `${key}_save_data`;

/** Seed a stored envelope the way the SDK writes one. */
function writeEnvelope(
  key: string,
  version: number,
  data: Record<string, unknown>,
) {
  storage.setItem(
    envelopeKey(key),
    JSON.stringify({
      version,
      timestamp: Date.now(),
      identity: { uuid: 'player-1', isAnonymous: true },
      data: { ...data, gameId: key, lastPlayed: 0 },
    }),
  );
}

const envelopeData = (key: string): Record<string, unknown> | null => {
  const raw = storage.getItem(envelopeKey(key));
  return raw ? JSON.parse(raw).data : null;
};

const pack = (id: string, count: number) => ({
  id,
  levels: Array.from({ length: count }) as never[],
});

let KEY: string;

beforeEach(async () => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', storage);
  KEY = (await import('~/game/setup/progress.save')).PROGRESS_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('progress store', () => {
  it('starts on defaults with nothing saved', async () => {
    const { loadProgress, resumeLevel, PROGRESS_DEFAULTS } = await boot();
    expect(loadProgress()).toEqual(PROGRESS_DEFAULTS);
    expect(resumeLevel(pack('default', 3))).toBe(0);
  });

  it('round-trips the resume point through the SDK envelope across a reload', async () => {
    const first = await boot();
    first.saveProgress('pack-a', 2);
    await vi.waitFor(() =>
      expect(envelopeData(KEY)).toMatchObject({ packId: 'pack-a', level: 2 }),
    );

    const second = await boot();
    expect(second.loadProgress()).toEqual({
      version: second.PROGRESS_VERSION,
      packId: 'pack-a',
      level: 2,
    });
    expect(second.resumeLevel(pack('pack-a', 5))).toBe(2);
  });

  it('migrates a v1 save (level only) onto the bundled pack', async () => {
    writeEnvelope(KEY, 1, { version: 1, level: 3 });
    const { loadProgress, BUNDLED_PACK } = await boot();
    expect(loadProgress()).toMatchObject({
      version: 2,
      packId: BUNDLED_PACK.id,
      level: 3,
    });
  });

  it('migrates a v1 save with a corrupt level to level 0', async () => {
    writeEnvelope(KEY, 1, { version: 1, level: 'three' });
    const { loadProgress, BUNDLED_PACK } = await boot();
    expect(loadProgress()).toMatchObject({ packId: BUNDLED_PACK.id, level: 0 });
  });

  it('reads a save from a newer build as defaults (future-version guard)', async () => {
    writeEnvelope(KEY, 99, { version: 99, packId: 'pack-a', level: 4 });
    const { loadProgress, PROGRESS_DEFAULTS } = await boot();
    expect(loadProgress()).toEqual(PROGRESS_DEFAULTS);
  });

  it('repairs bad fields instead of crashing', async () => {
    writeEnvelope(KEY, 2, { version: 2, packId: 'pack-a', level: -3.7 });
    const { loadProgress } = await boot();
    expect(loadProgress()).toMatchObject({ packId: 'pack-a', level: 0 });
  });

  it('resets an unusable record to defaults', async () => {
    writeEnvelope(KEY, 2, { version: 2, packId: 42, level: 1 });
    const { loadProgress, PROGRESS_DEFAULTS } = await boot();
    expect(loadProgress()).toEqual(PROGRESS_DEFAULTS);
  });

  it('survives corrupt JSON in storage', async () => {
    storage.setItem(envelopeKey(KEY), '{not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loadProgress, PROGRESS_DEFAULTS } = await boot();
    expect(loadProgress()).toEqual(PROGRESS_DEFAULTS);
    warn.mockRestore();
    error.mockRestore();
  });

  it('resets mid-play progress when a new content pack becomes active', async () => {
    writeEnvelope(KEY, 2, { version: 2, packId: 'pack-a', level: 2 });
    const { loadProgress, seedActivePack, getActivePack, PROGRESS_DEFAULTS } =
      await boot();
    const levels = getActivePack().levels;

    seedActivePack({
      id: 'pack-a',
      levels,
      source: 'published',
      contentId: null,
    });
    expect(loadProgress()).toMatchObject({ packId: 'pack-a', level: 2 }); // same pack: kept

    seedActivePack({
      id: 'pack-b',
      levels,
      source: 'published',
      contentId: 'c-b',
    });
    expect(loadProgress()).toEqual(PROGRESS_DEFAULTS);
    expect(envelopeData(KEY)).toBeNull();
  });

  it('ignores a save from another pack when resuming', async () => {
    writeEnvelope(KEY, 2, { version: 2, packId: 'pack-a', level: 2 });
    const { resumeLevel } = await boot();
    expect(resumeLevel(pack('pack-b', 5))).toBe(0);
  });

  it('clamps a saved level past the end of the pack', async () => {
    writeEnvelope(KEY, 2, { version: 2, packId: 'pack-a', level: 9 });
    const { resumeLevel } = await boot();
    expect(resumeLevel(pack('pack-a', 3))).toBe(2);
  });

  it('advances on a win and clears when the pack is complete', async () => {
    const { recordLevelWon, loadProgress, PROGRESS_DEFAULTS } = await boot();
    recordLevelWon('pack-a', 0, false);
    expect(loadProgress()).toMatchObject({ packId: 'pack-a', level: 1 });
    recordLevelWon('pack-a', 1, true);
    expect(loadProgress()).toEqual(PROGRESS_DEFAULTS);
  });
});

describe('progress rules (pure)', () => {
  it('sanitizeProgress repairs or resets', async () => {
    const { sanitizeProgress, PROGRESS_DEFAULTS } = await import(
      '~/game/setup/progress.save'
    );
    expect(sanitizeProgress(null)).toEqual(PROGRESS_DEFAULTS);
    expect(sanitizeProgress([])).toEqual(PROGRESS_DEFAULTS);
    expect(sanitizeProgress({ packId: 'p', level: 2.9 })).toMatchObject({
      packId: 'p',
      level: 2,
    });
    expect(sanitizeProgress({ packId: 'p', level: null })).toMatchObject({
      packId: 'p',
      level: 0,
    });
  });
});
