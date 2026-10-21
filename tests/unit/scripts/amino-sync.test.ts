/**
 * amino:sync pulls template-owned paths from template-amino-ecs-pure. These pin
 * the upstream, what counts as template-owned, and that a fork still pointing
 * at the old template-amino stops instead of syncing a different scaffold.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureAminoRemote,
  repoSlug,
  SYNC_PATHS,
  TEMPLATE_URL,
} from '../../../scripts/amino-sync';

const dirs: string[] = [];
function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'amino-sync-'));
  dirs.push(dir);
  execSync('git init -q', { cwd: dir });
  return dir;
}
const remoteUrl = (cwd: string) =>
  execSync('git remote get-url amino', { cwd, encoding: 'utf-8' }).trim();

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('amino-sync upstream', () => {
  it('defaults to template-amino-ecs-pure, not template-amino', () => {
    expect(repoSlug(TEMPLATE_URL)).toBe('wolfgames/template-amino-ecs-pure');
  });

  it('syncs the scaffold and the agent recipes, never game-owned paths', () => {
    expect(SYNC_PATHS).toEqual(
      expect.arrayContaining([
        'src/core/',
        '.agents/recipes/',
        '.agents/skills/',
      ]),
    );
    for (const owned of ['src/game/', 'schemas/', 'docs/', 'AGENTS.md']) {
      expect(SYNC_PATHS).not.toContain(owned);
    }
  });
});

describe('repoSlug', () => {
  it('reads ssh and https GitHub URLs the same way', () => {
    expect(
      repoSlug('git@github.com:wolfgames/template-amino-ecs-pure.git'),
    ).toBe(repoSlug('https://github.com/wolfgames/template-amino-ecs-pure'));
  });

  it('tells the old template apart from this one', () => {
    expect(repoSlug('git@github.com:wolfgames/template-amino.git')).not.toBe(
      repoSlug(TEMPLATE_URL),
    );
  });
});

describe('ensureAminoRemote', () => {
  it('adds the remote when it is missing', () => {
    const cwd = repo();
    expect(ensureAminoRemote('amino', TEMPLATE_URL, cwd)).toBe(true);
    expect(remoteUrl(cwd)).toBe(TEMPLATE_URL);
  });

  it('keeps an existing remote for the same repo, in either URL form', () => {
    const cwd = repo();
    execSync(
      'git remote add amino https://github.com/wolfgames/template-amino-ecs-pure.git',
      { cwd },
    );
    expect(ensureAminoRemote('amino', TEMPLATE_URL, cwd)).toBe(false);
  });

  it('stops a fork still pointing at template-amino, and says how to fix it', () => {
    const cwd = repo();
    execSync(
      'git remote add amino git@github.com:wolfgames/template-amino.git',
      {
        cwd,
      },
    );
    expect(() => ensureAminoRemote('amino', TEMPLATE_URL, cwd)).toThrow(
      /git remote set-url amino git@github\.com:wolfgames\/template-amino-ecs-pure\.git/,
    );
    expect(remoteUrl(cwd)).toBe('git@github.com:wolfgames/template-amino.git');
  });
});
