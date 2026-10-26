// End-to-end amino workflow (release → sync → rollback → drift) against git
// fixtures (slow: spawns bun). Run with `bun run test:scripts`.
import { readFileSync, rmSync } from 'node:fs';
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
const RELEASE = script('release');
const ROLLBACK = script('rollback');
const DRIFT = script('drift');

describe('amino e2e workflow', () => {
  let base: string;
  let aminoDir: string;
  let gameDir: string;

  beforeEach(() => {
    ({ base, aminoDir, gameDir } = createAminoAndGame('1.0.0'));
    runIn(aminoDir, 'git tag -a amino-v1.0.0 -m "Amino release v1.0.0"');
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  const read = (dir: string, file: string) =>
    readFileSync(path.join(dir, file), 'utf-8');

  it('release: bumps the version, tags, and writes the changelog', () => {
    write(aminoDir, 'src/core/index.ts', 'export const version = "1.1.0";\n');
    commitAll(aminoDir, 'feat: update core');

    runIn(aminoDir, `bun run ${RELEASE} minor`);

    expect(readPkg(aminoDir).amino.version).toBe('1.1.0');
    expect(runIn(aminoDir, "git tag -l 'amino-v*'")).toContain('amino-v1.1.0');
    const changelog = read(aminoDir, 'CHANGELOG.md');
    expect(changelog).toContain('## 1.1.0');
    expect(changelog).toContain('feat: update core');
  });

  it('sync: pulls the amino update and keeps game files', () => {
    write(aminoDir, 'src/core/index.ts', 'export const version = "updated";\n');
    commitAll(aminoDir, 'update core');

    runIn(gameDir, `bun run ${SYNC}`);

    expect(read(gameDir, 'src/core/index.ts')).toContain('updated');
    expect(read(gameDir, 'src/game/config.ts')).toContain('my-game');
    const { amino } = readPkg(gameDir);
    expect(amino.syncedAt).toBeTruthy();
    expect(amino.syncedFrom).toBeTruthy();
  });

  it('rollback: reverts a sync commit', () => {
    write(aminoDir, 'src/core/index.ts', 'export const version = "new";\n');
    commitAll(aminoDir, 'update');
    runIn(gameDir, `bun run ${SYNC}`);
    expect(read(gameDir, 'src/core/index.ts')).toContain('new');

    runIn(gameDir, `bun run ${ROLLBACK}`);

    expect(read(gameDir, 'src/core/index.ts')).toContain('version = "1.0.0"');
  });

  it('rollback: refuses when the latest commit is not a sync', () => {
    expect(runFailing(gameDir, `bun run ${ROLLBACK}`)).toContain(
      'not an amino sync',
    );
  });

  it('drift: reports clean when nothing changed locally', () => {
    expect(runIn(gameDir, `bun run ${DRIFT}`)).toContain('No drift detected');
  });

  it('drift: detects local edits to amino-owned paths', () => {
    write(gameDir, 'src/core/index.ts', 'export const version = "hacked";\n');
    commitAll(gameDir, 'local hack');
    expect(runFailing(gameDir, `bun run ${DRIFT}`)).toContain(
      'src/core/index.ts',
    );
  });

  it('full workflow: release → sync → no drift', () => {
    write(aminoDir, 'src/core/index.ts', 'export const version = "1.1.0";\n');
    commitAll(aminoDir, 'feat: new core feature');

    runIn(aminoDir, `bun run ${RELEASE} minor`);
    expect(readPkg(aminoDir).amino.version).toBe('1.1.0');

    runIn(gameDir, `bun run ${SYNC}`);
    expect(readPkg(gameDir).amino.version).toBe('1.1.0');

    expect(runIn(gameDir, `bun run ${DRIFT}`)).toContain('No drift detected');
    expect(read(gameDir, 'src/game/config.ts')).toContain('my-game');
    expect(runIn(gameDir, 'git log -1 --format=%s').trim()).toMatch(
      /^chore: sync amino to/,
    );
  });
});
