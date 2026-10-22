// Git fixtures for the amino-* CLI tests. Each test gets a throwaway "amino" repo
// and a "game" clone of it whose `amino` remote points back at it.
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const script = (name: string) =>
  path.join(ROOT, `scripts/amino-${name}.ts`);

export function runIn(
  dir: string,
  cmd: string,
  env?: Record<string, string>,
): string {
  return execSync(cmd, {
    cwd: dir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
    timeout: 15000,
  });
}

/** Runs a command that must fail; returns its stdout + stderr. */
export function runFailing(dir: string, cmd: string): string {
  try {
    runIn(dir, cmd);
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: string; stderr?: string };
    return `${stdout ?? ''}${stderr ?? ''}`;
  }
  throw new Error(`expected "${cmd}" to fail`);
}

export const readPkg = (dir: string) =>
  JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf-8'));

export const write = (dir: string, file: string, content: string) => {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), content);
};

export const commitAll = (dir: string, message: string) =>
  runIn(dir, `git add -A && git commit -q -m '${message}'`);

export const pkgJson = (name: string, version: string) =>
  `${JSON.stringify({ name, amino: { version } }, null, 2)}\n`;

export function initRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  runIn(dir, 'git init -q -b main');
  runIn(dir, 'git config user.email "test@test.com"');
  runIn(dir, 'git config user.name "Test"');
}

/** An amino repo at `version`, and a game cloned from it with its own config. */
export function createAminoAndGame(version: string): {
  base: string;
  aminoDir: string;
  gameDir: string;
} {
  const base = mkdtempSync(path.join(tmpdir(), 'amino-scripts-'));
  const aminoDir = path.join(base, 'amino');
  const gameDir = path.join(base, 'game');

  initRepo(aminoDir);
  write(aminoDir, 'src/core/index.ts', 'export const version = "1.0.0";\n');
  write(aminoDir, 'src/core/systems/audio.ts', 'export const audio = {};\n');
  write(aminoDir, 'src/game/config.ts', 'export const game = "amino";\n');
  write(aminoDir, 'package.json', pkgJson('amino', version));
  write(aminoDir, 'vite.config.ts', 'export default {};\n');
  write(aminoDir, 'tsconfig.json', '{}\n');
  write(aminoDir, 'vitest.config.ts', 'export default {};\n');
  write(aminoDir, 'biome.json', '{}\n');
  write(aminoDir, '.gitattributes', 'src/game/** merge=ours\n');
  commitAll(aminoDir, `initial amino v${version}`);

  runIn(base, `git clone -q ${aminoDir} game`);
  runIn(gameDir, 'git config user.email "test@test.com"');
  runIn(gameDir, 'git config user.name "Test"');
  write(gameDir, 'src/game/config.ts', 'export const game = "my-game";\n');
  write(gameDir, 'package.json', pkgJson('my-game', '1.0.0'));
  commitAll(gameDir, 'customize game');
  // The scripts default to a remote named "amino".
  runIn(gameDir, 'git remote rename origin amino');

  return { base, aminoDir, gameDir };
}
