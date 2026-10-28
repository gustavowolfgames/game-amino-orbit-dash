// CLI tests for scripts/init-game.mjs on a copy of this repo (slow: copies the tree,
// spawns node and bun). Run with `bun run test:scripts`.
import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  commitAll,
  initRepo,
  ROOT,
  readPkg,
  runFailing,
  runIn,
  write,
} from './fixture';

const INIT = 'node scripts/init-game.mjs';
const read = (dir: string, file: string) =>
  readFileSync(path.join(dir, file), 'utf-8');
const json = (dir: string, file: string) => JSON.parse(read(dir, file));

/** The template's lockfile files with no copy in public/assets/ (its music). */
const CDN_ONLY = Object.keys(
  json(ROOT, 'assets/asset-manifest.cdn.json').files,
).filter((f) => !existsSync(path.join(ROOT, 'public/assets', f)));

/** Every file git would ship from this checkout (tracked + new), copied into a fresh
 *  committed repo, with node_modules linked so check:agent can typecheck. `staged` puts
 *  the CDN-only files in assets/src/ (gitignored), as assets_pull would. */
function copyRepo({ staged = true } = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'init-game-'));
  const files = execSync('git ls-files --cached --others --exclude-standard', {
    cwd: ROOT,
    encoding: 'utf-8',
  })
    .split('\n')
    .filter(Boolean);
  for (const f of files) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    try {
      cpSync(path.join(ROOT, f), path.join(dir, f));
    } catch {
      // deleted in the working tree but still in the index
    }
  }
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  initRepo(dir);
  commitAll(dir, 'template');
  if (staged)
    for (const f of CDN_ONLY) write(dir, `assets/src/${f}`, 'pulled\n');
  return dir;
}

describe('init-game.mjs (CLI)', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('sets every identity file and empties the lockfile like the kits do', () => {
    dir = copyRepo();
    const out = runIn(dir, `${INIT} ballblast "Ball Blast"`);

    expect(json(dir, 'wolf-game-kit.json')).toMatchObject({
      projectId: 'ballblast',
      gameSlug: 'ballblast',
      gameName: 'Ball Blast',
      assetsDir: 'assets',
    });
    expect(read(dir, '.env.example')).toMatch(
      /^VITE_GAME_KIT_PROJECT_ID=ballblast$/m,
    );
    expect(read(dir, '.env.example')).not.toContain('aminoecspure');
    expect(readPkg(dir).name).toBe('ballblast');
    expect(readPkg(dir).scripts['init-game']).toBeDefined();
    expect(read(dir, 'src/game/config.ts')).toContain(
      "export const GAME_TITLE = 'Ball Blast';",
    );
    expect(read(dir, 'docs/GAME-DESIGN.md')).toMatch(
      /^# Game Design — Ball Blast$/m,
    );
    // The empty lockfile is byte-for-byte what the kits ship.
    for (const f of ['assets/asset-manifest.cdn.json', 'assets/registry.ts'])
      expect(read(dir, f)).toBe(read(ROOT, `kits/ballsort/files/${f}`));

    expect(out).toContain('7 files');
    expect(out).toMatch(/Register "ballblast" in Nucleo/);
    expect(out).toContain('Next (not run by this script)');
  });

  it('keeps saves on the new slug: SAVE_SLUG reads wolf-game-kit.json', () => {
    dir = copyRepo();
    runIn(dir, `${INIT} ballblast "Ball Blast"`);
    expect(read(dir, 'src/game/setup/saves.ts')).toMatch(
      /SAVE_SLUG: string = wolfGameKit\.gameSlug/,
    );
  });

  it('is idempotent', () => {
    dir = copyRepo();
    runIn(dir, `${INIT} ballblast "Ball Blast"`);
    commitAll(dir, 'init-game');
    expect(runIn(dir, `${INIT} ballblast "Ball Blast"`)).toContain(
      'nothing to change',
    );
    expect(runIn(dir, 'git status --porcelain').trim()).toBe('');
  });

  it('escapes quotes in the title', () => {
    dir = copyRepo();
    runIn(dir, `${INIT} odds "Lucy's Odds"`);
    expect(read(dir, 'src/game/config.ts')).toContain(
      "export const GAME_TITLE = 'Lucy\\'s Odds';",
    );
  });

  it.each([
    ['Ball-Blast', 'not a bare Nucleo slug'],
    ['ballblast_1234abcd', 'never <slug>_<uuid>'],
    ['-ball', 'not a bare Nucleo slug'],
    ['aminoecspure', "template's own slug"],
  ])('rejects slug %s and changes nothing', (slug, message) => {
    dir = copyRepo();
    expect(runFailing(dir, `${INIT} ${slug} "Ball Blast"`)).toContain(message);
    expect(runIn(dir, 'git status --porcelain').trim()).toBe('');
  });

  it('needs a title', () => {
    dir = copyRepo();
    expect(runFailing(dir, `${INIT} ballblast`)).toContain('usage');
  });

  it('refuses a dirty tree unless --force', () => {
    dir = copyRepo();
    write(dir, 'notes.txt', 'wip\n');
    expect(runFailing(dir, `${INIT} ballblast "Ball Blast"`)).toContain(
      'uncommitted changes',
    );
    expect(json(dir, 'wolf-game-kit.json').gameSlug).toBe('aminoecspure');
    runIn(dir, `${INIT} ballblast "Ball Blast" --force`);
    expect(json(dir, 'wolf-game-kit.json').gameSlug).toBe('ballblast');
  });

  it('refuses while the template music exists only on its CDN, and names the files', () => {
    expect(CDN_ONLY).toEqual(
      expect.arrayContaining(['music-ambience.json', 'music-ambience.mp3']),
    );
    dir = copyRepo({ staged: false });
    const out = runFailing(dir, `${INIT} ballblast "Ball Blast"`);
    expect(out).toContain("exist only on the template's CDN");
    for (const f of CDN_ONLY) expect(out).toContain(f);
    expect(out).toContain('assets_pull');
    expect(json(dir, 'wolf-game-kit.json').gameSlug).toBe('aminoecspure');
  });

  it('with the files staged, lists them for the first publish', () => {
    dir = copyRepo();
    const out = runIn(dir, `${INIT} ballblast "Ball Blast"`);
    expect(out).toMatch(
      /Publish the template files staged in assets\/src\/ under "ballblast"/,
    );
    for (const f of CDN_ONLY) expect(out).toContain(f);
    expect(out).not.toContain('Left behind');
  });

  it('--skip-cdn-only goes on without them and says what is left behind', () => {
    dir = copyRepo({ staged: false });
    const out = runIn(dir, `${INIT} ballblast "Ball Blast" --skip-cdn-only`);
    expect(json(dir, 'wolf-game-kit.json').gameSlug).toBe('ballblast');
    expect(out).toContain("Left behind on the template's CDN");
    expect(out).toContain('music-ambience.mp3');
  });

  it('a local-only build (mygame) only warns', () => {
    dir = copyRepo({ staged: false });
    const out = runIn(dir, `${INIT} mygame "My Game"`);
    expect(json(dir, 'wolf-game-kit.json').gameSlug).toBe('mygame');
    expect(out).toContain('A local-only build plays without them');
  });

  it('leaves check:agent passing', () => {
    dir = copyRepo();
    runIn(dir, `${INIT} ballblast "Ball Blast"`);
    const out = execSync('bun run check:agent', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    expect(out).toContain('PASS agent surface');
  }, 150_000);
});
