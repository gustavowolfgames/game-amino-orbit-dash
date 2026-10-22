// CLI tests for scripts/amino-release.ts against a git fixture (slow: spawns bun).
// Run with `bun run test:scripts`.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitAll,
  initRepo,
  pkgJson,
  readPkg,
  runFailing,
  runIn,
  script,
  write,
} from './fixture';

const RELEASE = script('release');

describe('amino-release.ts (CLI)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'amino-release-'));
    initRepo(dir);
    write(dir, 'package.json', pkgJson('test', '1.0.0'));
    commitAll(dir, 'init');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    ['patch', '1.0.1'],
    ['minor', '1.1.0'],
  ])('%s bump: 1.0.0 → %s, tagged', (type, version) => {
    runIn(dir, `bun run ${RELEASE} ${type}`);
    expect(readPkg(dir).amino.version).toBe(version);
    expect(runIn(dir, 'git tag')).toContain(`amino-v${version}`);
  });

  it('major bump: 1.0.0 → 2.0.0 with a full-merge warning', () => {
    const output = runIn(dir, `bun run ${RELEASE} major`);
    expect(readPkg(dir).amino.version).toBe('2.0.0');
    expect(output).toContain('MAJOR VERSION BUMP');
    expect(output).toContain('full merge');
    expect(runIn(dir, 'git tag')).toContain('amino-v2.0.0');
  });

  it('writes a changelog entry', () => {
    runIn(dir, `bun run ${RELEASE} patch`);
    const changelog = readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf-8');
    expect(changelog).toContain('## 1.0.1');
  });

  it('rejects an invalid bump type', () => {
    expect(runFailing(dir, `bun run ${RELEASE} invalid`)).toContain('Usage');
  });

  it('rejects a dirty working tree', () => {
    writeFileSync(path.join(dir, 'package.json'), '{"dirty": true}');
    expect(runFailing(dir, `bun run ${RELEASE} patch`)).toContain(
      'uncommitted changes',
    );
  });
});
