import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import wolfGameKit from '../../../wolf-game-kit.json';

// Real `createVersionedStore` + SDK over an in-memory localStorage; only identity is stubbed.
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

interface Coins {
  version: number;
  coins: number;
}
const COINS: Coins = { version: 1, coins: 0 };

const envelope = (key: string, data: Record<string, unknown>) =>
  JSON.stringify({
    version: 1,
    timestamp: Date.now(),
    identity: { uuid: 'player-1', isAnonymous: true },
    data: { ...data, gameId: key, lastPlayed: 0 },
  });

/** Fresh registry, stores and priming per boot. */
async function boot() {
  vi.resetModules();
  const saves = await import('~/game/setup/saves');
  const { whenStoresReady } = await import('~/core/utils/storage');
  return { ...saves, whenStoresReady };
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('save keys', () => {
  it('start with the game slug from wolf-game-kit.json', async () => {
    const { saveKey, SAVE_SLUG } = await boot();
    expect(SAVE_SLUG).toBe(wolfGameKit.gameSlug);
    expect(saveKey('progress')).toBe(`${wolfGameKit.gameSlug}:progress`);
  });

  it('differ between a game and its fork', async () => {
    const { saveKey } = await boot();
    expect(saveKey('colony', 'marsx')).not.toBe(saveKey('colony', 'moonx'));
  });

  it('keep the progress key the template already shipped', async () => {
    const { PROGRESS_KEY } = await import('~/game/setup/progress.save');
    expect(PROGRESS_KEY).toBe(`${wolfGameKit.gameSlug}:progress`);
  });
});

describe('registerSave', () => {
  it('stores under the slugged key and lists the store by name', async () => {
    const { registerSave, getSave, saveNames, saveKey, whenStoresReady } =
      await boot();
    const store = registerSave<Coins>({
      name: 'coins',
      version: 1,
      defaults: COINS,
    });
    expect(store.key).toBe(saveKey('coins'));
    expect(getSave('coins')).toBe(store);
    expect(saveNames()).toEqual(['coins']);

    await whenStoresReady();
    store.save({ version: 1, coins: 7 });
    await vi.waitFor(() =>
      expect(storage.getItem(`${saveKey('coins')}_save_data`)).toContain(
        '"coins":7',
      ),
    );
  });

  it('replaces an entry registered again under the same name', async () => {
    const { registerSave, getSave, saveNames } = await boot();
    registerSave<Coins>({ name: 'coins', version: 1, defaults: COINS });
    const again = registerSave<Coins>({
      name: 'coins',
      version: 1,
      defaults: COINS,
    });
    expect(getSave('coins')).toBe(again);
    expect(saveNames()).toEqual(['coins']);
  });

  it('warns in dev about a save first registered after boot, not about a hot reload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { registerSave, markSavesBooted } = await boot();
    registerSave<Coins>({ name: 'coins', version: 1, defaults: COINS });
    markSavesBooted();
    registerSave<Coins>({ name: 'coins', version: 1, defaults: COINS });
    expect(warn).not.toHaveBeenCalled();
    registerSave<Coins>({ name: 'late', version: 1, defaults: COINS });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('"late"');
    warn.mockRestore();
  });
});

describe('save files', () => {
  // app.tsx loads every `*.save.ts` before boot; a registerSave anywhere else hydrates late.
  it('registerSave is called only from *.save.ts files', () => {
    const sources = import.meta.glob('/src/game/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const callers = Object.entries(sources)
      .filter(([, text]) => /\bregisterSave\s*[<(]/.test(text))
      .map(([path]) => path)
      .filter((path) => !path.endsWith('/setup/saves.ts'));
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter((path) => !path.endsWith('.save.ts'))).toEqual([]);
  });

  it('app.tsx loads the save files before boot', async () => {
    const app = (await import('/src/app.tsx?raw')).default as string;
    expect(app).toContain("import.meta.glob('/src/game/**/*.save.ts'");
  });
});

describe('clearSaves', () => {
  it('clears every registered store, the template progress included', async () => {
    const { registerSave, clearSaves, saveNames, whenStoresReady } =
      await boot();
    const progress = await import('~/game/setup/progress.save');
    const coins = registerSave<Coins>({
      name: 'coins',
      version: 1,
      defaults: COINS,
    });
    await whenStoresReady();
    expect(saveNames()).toEqual(['progress', 'coins']);

    progress.saveProgress('pack-a', 3);
    coins.save({ version: 1, coins: 9 });
    clearSaves();

    expect(progress.loadProgress()).toEqual(progress.PROGRESS_DEFAULTS);
    expect(coins.load()).toEqual(COINS);
    expect(storage.getItem(`${progress.PROGRESS_KEY}_save_data`)).toBeNull();
    expect(storage.getItem(`${coins.key}_save_data`)).toBeNull();
  });
});

describe('adoptFrom', () => {
  it('moves a save from an old key to the new one, once', async () => {
    storage.setItem(
      'colony_save_data',
      envelope('colony', { version: 1, coins: 5 }),
    );
    const { registerSave, saveKey, whenStoresReady } = await boot();
    const store = registerSave<Coins>({
      name: 'coins',
      version: 1,
      defaults: COINS,
      adoptFrom: ['colony'],
    });
    await whenStoresReady();
    expect(store.load()).toEqual({ version: 1, coins: 5 });
    expect(storage.getItem('colony_save_data')).toBeNull();
    expect(storage.getItem(`${saveKey('coins')}_save_data`)).not.toBeNull();
  });

  it('adopts a bare legacy payload through the core wrapper', async () => {
    storage.setItem('colony', JSON.stringify({ version: 1, coins: 4 }));
    const { registerSave, whenStoresReady } = await boot();
    const store = registerSave<Coins>({
      name: 'coins',
      version: 1,
      defaults: COINS,
      adoptFrom: ['colony'],
    });
    await whenStoresReady();
    expect(store.load()).toEqual({ version: 1, coins: 4 });
    expect(storage.getItem('colony')).toBeNull();
  });

  it('never overwrites a save already under the new key', async () => {
    const { saveKey } = await boot();
    const key = saveKey('coins');
    storage.setItem(
      `${key}_save_data`,
      envelope(key, { version: 1, coins: 2 }),
    );
    storage.setItem(
      'colony_save_data',
      envelope('colony', { version: 1, coins: 5 }),
    );
    const { registerSave, whenStoresReady } = await boot();
    const store = registerSave<Coins>({
      name: 'coins',
      version: 1,
      defaults: COINS,
      adoptFrom: ['colony'],
    });
    await whenStoresReady();
    expect(store.load()).toEqual({ version: 1, coins: 2 });
    expect(storage.getItem('colony_save_data')).not.toBeNull();
  });
});
