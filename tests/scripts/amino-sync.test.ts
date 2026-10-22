// CLI tests for scripts/amino-sync.ts against git fixtures (slow: spawns bun).
// Run with `bun run test:scripts`.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitAll,
  createAminoAndGame,
  readPkg,
  runFailing,
  runIn,
  script,
  write,
} from './fixture';

const SYNC = script('sync');

describe('amino-sync.ts (CLI)', () => {
  let base: string;
  let aminoDir: string;
  let gameDir: string;

  beforeEach(() => {
    ({ base, aminoDir, gameDir } = createAminoAndGame('1.2.0'));
    // Amino moves on after the game was cloned.
    write(aminoDir, 'src/core/index.ts', 'export const version = "1.2.0";\n');
    write(
      aminoDir,
      'src/core/systems/audio.ts',
      'export const audio = { volume: 1 };\n',
    );
    commitAll(aminoDir, 'amino update');
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  const read = (file: string) =>
    readFileSync(path.join(gameDir, file), 'utf-8');

  it('syncs amino-owned paths into the game repo', () => {
    runIn(gameDir, `bun run ${SYNC}`);
    expect(read('src/core/index.ts')).toContain('version = "1.2.0"');
    expect(read('src/core/systems/audio.ts')).toContain('volume: 1');
  });

  it('does not modify game-owned files', () => {
    runIn(gameDir, `bun run ${SYNC}`);
    expect(read('src/game/config.ts')).toContain('"my-game"');
  });

  it('updates the amino sync metadata in package.json', () => {
    runIn(gameDir, `bun run ${SYNC}`);
    const { amino } = readPkg(gameDir);
    expect(amino.version).toBe('1.2.0');
    expect(amino.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof amino.syncedFrom).toBe('string');
    expect(amino.syncedFrom).toBeTruthy();
  });

  it('adds the amino remote when it is missing', () => {
    runIn(gameDir, 'git remote remove amino');
    const output = runIn(gameDir, `bun run ${SYNC}`, { AMINO_URL: aminoDir });
    expect(output).toContain('Adding amino remote');
    expect(runIn(gameDir, 'git remote -v')).toContain('amino');
  });

  it('rejects a dirty working tree', () => {
    writeFileSync(path.join(gameDir, 'package.json'), '{"dirty": true}');
    expect(runFailing(gameDir, `bun run ${SYNC}`)).toContain(
      'uncommitted changes',
    );
  });
});
