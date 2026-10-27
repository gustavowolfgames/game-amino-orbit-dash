// bun run add-kit <name> — install a genre kit: a working game you then change.
//
// A kit is `kits/<name>/files/`, a copy of every file the game adds or changes,
// laid out like the repo. This copies them over the repo (overwriting the
// template's skeleton files) and prints the kit's guide, `kits/<name>/KIT.md`.
//
//   bun run add-kit           list the kits
//   bun run add-kit match3    install one
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kitsDir = path.join(root, 'kits');
const kits = existsSync(kitsDir)
  ? readdirSync(kitsDir).filter((k) => statSync(path.join(kitsDir, k)).isDirectory())
  : [];
const name = process.argv[2];

if (!name) {
  console.log(`kits: ${kits.join(', ') || '(none)'}\nusage: bun run add-kit <name>`);
  process.exit(0);
}
if (!kits.includes(name)) {
  console.error(`no kit "${name}" (have: ${kits.join(', ')})`);
  process.exit(1);
}

const files = path.join(kitsDir, name, 'files');
const copied = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else copied.push(path.relative(files, p));
  }
};
walk(files);
// File by file: overwrite in place (no unlink), creating folders as needed.
for (const f of copied) {
  mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  copyFileSync(path.join(files, f), path.join(root, f));
}

console.log(`✓ installed kit "${name}" (${copied.length} files):`);
for (const f of copied.sort()) console.log(`  ${f}`);
console.log(`\n${readFileSync(path.join(kitsDir, name, 'KIT.md'), 'utf8')}`);
