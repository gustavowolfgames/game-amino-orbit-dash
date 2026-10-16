// bun run check:agent (step) — the code snippets in the game's slot READMEs still
// compile against the real code.
//
// A README under src/game/mygame/ may hold a ```ts block whose first line is
// `// check: <file>.ts`. That block is a whole file: it is written next to the
// README for a moment, typechecked with the project's tsconfig, then removed.
// Snippets that only show lines to add inside another file carry no marker and are
// not compiled. A snippet that stops compiling fails here, not in an agent's build.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(root, 'src/game/mygame');
const MARK = /^\/\/ check: ([A-Za-z0-9_.-]+\.tsx?)\s*$/;

function readmes(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) readmes(p, out);
    else if (name === 'README.md') out.push(p);
  }
  return out;
}

const written = [];
const tsconfig = path.join(root, 'tsconfig.snippets.json');
let failed = false;
try {
  for (const readme of existsSync(GAME) ? readmes(GAME) : []) {
    for (const [, body] of readFileSync(readme, 'utf8').matchAll(
      /```ts\n([\s\S]*?)```/g,
    )) {
      const mark = body.split('\n')[0].match(MARK);
      if (!mark) continue;
      const file = path.join(path.dirname(readme), `__snippet__${mark[1]}`);
      writeFileSync(file, body);
      written.push(file);
    }
  }
  if (written.length) {
    writeFileSync(
      tsconfig,
      JSON.stringify({
        extends: './tsconfig.json',
        include: written.map((f) => path.relative(root, f)),
      }),
    );
    let output = '';
    try {
      execFileSync(
        path.join(root, 'node_modules/.bin/tsc'),
        ['-p', tsconfig, '--noEmit', '--pretty', 'false'],
        {
          cwd: root,
          encoding: 'utf8',
          stdio: 'pipe',
        },
      );
    } catch (error) {
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    // Only the snippets' own errors count; errors in files they import are the baseline's job.
    const errors = output.split('\n').filter((l) => l.includes('__snippet__'));
    if (errors.length) {
      failed = true;
      console.error(
        `FAIL snippets (${errors.length} error(s)) — fix the README snippet:`,
      );
      for (const e of errors)
        console.error(`  ${e.replace('__snippet__', '')}`);
    }
  }
} finally {
  for (const f of written) rmSync(f, { force: true });
  rmSync(tsconfig, { force: true });
}
if (failed) process.exit(1);
console.log(`PASS snippets (${written.length} compiled)`);
