import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../../..');

/** `execSync` throws on a non-zero exit; biome exits non-zero when it reports. */
interface ExecError {
  stdout?: string;
  stderr?: string;
}

function biomeLint(filePath: string): string {
  try {
    return execSync(
      `npx @biomejs/biome lint ${filePath} --diagnostic-level=error`,
      {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } catch (e: unknown) {
    const { stdout, stderr } = e as ExecError;
    return (stdout || '') + (stderr || '');
  }
}

function writeFixture(relativePath: string, content: string): string {
  const fullPath = path.join(ROOT, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
  return relativePath;
}

function cleanFixture(relativePath: string): void {
  rmSync(path.join(ROOT, relativePath), { force: true });
}

describe('Import boundary lint rules', () => {
  // --- core/ boundary ---

  it('core/ importing from ~/game/ should fail', () => {
    const file = writeFixture(
      'src/core/_boundary-test.ts',
      'export { } from "~/game/config";\n',
    );
    try {
      const output = biomeLint(file);
      expect(output).toContain('noRestrictedImports');
      expect(output).toContain('core/ must not import from game/');
    } finally {
      cleanFixture(file);
    }
  });

  it('core/ importing from ~/core/ should pass', () => {
    const file = writeFixture(
      'src/core/_boundary-test.ts',
      'export { } from "~/core/config";\n',
    );
    try {
      const output = biomeLint(file);
      expect(output).not.toContain('noRestrictedImports');
    } finally {
      cleanFixture(file);
    }
  });

  // --- game/ boundary ---

  it('game/ importing from ~/core/ should pass', () => {
    const file = writeFixture(
      'src/game/_boundary-test.ts',
      'export { } from "~/core/config";\n',
    );
    try {
      const output = biomeLint(file);
      expect(output).not.toContain('noRestrictedImports');
    } finally {
      cleanFixture(file);
    }
  });
});
