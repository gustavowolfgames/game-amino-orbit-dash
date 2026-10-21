// In-process tests for scripts/amino-sync.ts. The CLI runs (bun subprocesses
// against git fixtures) live in tests/scripts/ and run with `bun run test:scripts`.
import { describe, expect, it } from 'vitest';
import { applyAminoSyncMeta } from '../../../scripts/amino-sync';

const sync = (game: object, amino: object) =>
  JSON.parse(
    applyAminoSyncMeta(
      JSON.stringify(game),
      JSON.stringify(amino),
      '2025-01-01',
      'abc123',
    ),
  );

describe('applyAminoSyncMeta (pure)', () => {
  it('takes the amino version and records when and from where', () => {
    const result = sync(
      { name: 'my-game', amino: { version: '1.0.0' } },
      { name: 'amino', amino: { version: '1.2.0' } },
    );
    expect(result.amino).toEqual({
      version: '1.2.0',
      syncedAt: '2025-01-01',
      syncedFrom: 'abc123',
    });
  });

  it('preserves the game name and other fields', () => {
    const result = sync(
      {
        name: 'my-game',
        dependencies: { foo: '1.0.0' },
        amino: { version: '1.0.0' },
      },
      { name: 'amino', amino: { version: '2.0.0' } },
    );
    expect(result.name).toBe('my-game');
    expect(result.dependencies.foo).toBe('1.0.0');
    expect(result.amino.version).toBe('2.0.0');
  });

  it('creates the amino field when the game has none', () => {
    const result = sync(
      { name: 'my-game' },
      { name: 'amino', amino: { version: '1.0.0' } },
    );
    expect(result.amino.version).toBe('1.0.0');
  });

  it('falls back to the game version when amino has none', () => {
    const result = sync(
      { name: 'my-game', amino: { version: '0.5.0' } },
      { name: 'amino' },
    );
    expect(result.amino.version).toBe('0.5.0');
  });

  it('falls back to 0.0.0 when neither has a version', () => {
    expect(sync({ name: 'my-game' }, { name: 'amino' }).amino.version).toBe(
      '0.0.0',
    );
  });

  it('ends the output with a newline', () => {
    const output = applyAminoSyncMeta('{}', '{}', '2025-01-01', 'abc123');
    expect(output.endsWith('\n')).toBe(true);
  });
});
