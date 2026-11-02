// `bun run add-kit <kit>` installs a game that still builds on today's template (slow:
// copies the repo, then runs tsc, check:agent and the unit tests in the copy).
// Run with `bun run test:scripts`.
//
// A kit ships its own copies of the files it changes (kits/<kit>/files/), so a template
// change to a file it replaces, or to one it leaves in place next to them, can break the
// installed game while the template itself stays green (ENG-5254). This installs every
// kit into a copy of the working tree and runs the checks a new game must pass.
import { execSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT } from './fixture';

const KITS = readdirSync(path.join(ROOT, 'kits')).filter((k) =>
  statSync(path.join(ROOT, 'kits', k)).isDirectory(),
);

/** Runs `cmd` in `dir`; on failure the error carries its output. */
function run(dir: string, cmd: string): string {
  // The nested vitest must not think it runs inside this one.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !k.startsWith('VITEST') && k !== 'NODE_ENV',
    ),
  );
  try {
    return execSync(cmd, {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      timeout: 180_000,
    });
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: string; stderr?: string };
    throw new Error(
      `"${cmd}" failed in ${dir}:\n${stdout ?? ''}${stderr ?? ''}`,
    );
  }
}

/** The working tree as git sees it (tracked and new files, not ignored ones), with the
 *  repo's node_modules linked in. */
function copyRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'amino-add-kit-'));
  const files = run(
    ROOT,
    'git ls-files -z --cached --others --exclude-standard',
  )
    .split('\0')
    .filter(Boolean);
  for (const f of files) {
    const from = path.join(ROOT, f);
    // A tracked file deleted in the working tree is still listed.
    if (!statSync(from, { throwIfNoEntry: false })?.isFile()) continue;
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    copyFileSync(from, path.join(dir, f));
  }
  symlinkSync(
    realpathSync(path.join(ROOT, 'node_modules')),
    path.join(dir, 'node_modules'),
  );
  return dir;
}

describe('add-kit (CLI)', () => {
  const copies: string[] = [];
  afterAll(() => {
    for (const dir of copies) rmSync(dir, { recursive: true, force: true });
  });

  it('has kits to check', () => {
    expect(KITS).toEqual(expect.arrayContaining(['match3', 'ballsort']));
  });

  it.each(KITS)(
    '%s installs into a game that type-checks, passes check:agent and its unit tests',
    (kit) => {
      const dir = copyRepo();
      copies.push(dir);
      expect(run(dir, `bun run add-kit ${kit}`)).toContain(
        `installed kit "${kit}"`,
      );
      expect(run(dir, 'bun run typecheck:baseline')).toContain(
        'PASS typecheck',
      );
      expect(run(dir, 'bun run check:agent')).toContain('PASS agent surface');
      run(dir, 'npx vitest run'); // throws with the failures if any test fails
    },
    300_000,
  );
});
