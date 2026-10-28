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
    const { PROGRESS_KEY } = await import('~/game/setup/progress');
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
});

describe('clearSaves', () => {
  it('clears every registered store, the template progress included', async () => {
    const { registerSave, clearSaves, saveNames, whenStoresReady } =
      await boot();
    const progress = await import('~/game/setup/progress');
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
