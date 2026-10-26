// In-process tests for scripts/amino-release.ts. The CLI runs (bun subprocesses
// against a git fixture) live in tests/scripts/ and run with `bun run test:scripts`.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertCleanWorkingTree,
  bumpAminoVersion,
  bumpVersion,
  validateBumpType,
} from '../../../scripts/amino-release';

describe('bumpVersion (pure)', () => {
  it.each([
    ['1.0.0', 'patch', '1.0.1'],
    ['1.0.0', 'minor', '1.1.0'],
    ['1.0.0', 'major', '2.0.0'],
    ['0.0.0', 'patch', '0.0.1'],
    ['1.2.3', 'minor', '1.3.0'],
    ['1.2.3', 'major', '2.0.0'],
  ] as const)('%s + %s → %s', (from, type, to) => {
    expect(bumpVersion(from, type)).toBe(to);
  });
});

describe('validateBumpType (pure)', () => {
  it.each(['patch', 'minor', 'major'])('accepts %s', (type) => {
    expect(validateBumpType(type)).toBe(type);
  });

  it.each(['invalid', ''])('rejects %j', (type) => {
    expect(validateBumpType(type)).toBeNull();
  });
});

describe('bumpAminoVersion / assertCleanWorkingTree (git fixture)', () => {
  let dir: string;

  const run = (cmd: string) =>
    execSync(cmd, { cwd: dir, encoding: 'utf-8', stdio: 'pipe' });
  const readPkg = () =>
    JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf-8'));

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'amino-release-unit-'));
    run('git init -q -b main');
    run('git config user.email "test@test.com"');
    run('git config user.name "Test"');
    writeFileSync(
      path.join(dir, 'package.json'),
      `${JSON.stringify({ name: 'test', amino: { version: '1.0.0' } }, null, 2)}\n`,
    );
    run("git add -A && git commit -q -m 'init'");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('bumpAminoVersion writes the new version to disk', () => {
    expect(bumpAminoVersion('patch', dir)).toBe('1.0.1');
    expect(readPkg().amino.version).toBe('1.0.1');
  });

  it('bumpAminoVersion starts from 0.0.0 when amino is missing', () => {
    writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}\n');
    expect(bumpAminoVersion('minor', dir)).toBe('0.1.0');
  });

  it('assertCleanWorkingTree passes on a clean tree', () => {
    expect(() => assertCleanWorkingTree(dir)).not.toThrow();
  });

  it('assertCleanWorkingTree throws on a dirty tree', () => {
    writeFileSync(path.join(dir, 'package.json'), '{"dirty": true}');
    expect(() => assertCleanWorkingTree(dir)).toThrow('uncommitted changes');
  });
});
