// Runs tsc and compares its errors to scripts/typecheck-baseline.txt.
// The baseline holds errors inherited from template-amino, keyed by file and TS code
// so line shifts do not matter. A new error fails. A fixed one asks for --update.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineFile = path.join(root, 'scripts/typecheck-baseline.txt');

let output = '';
try {
  output = execSync(
    `${existsSync(path.join(root, 'node_modules/.bin/tsc')) ? path.join(root, 'node_modules/.bin/tsc') : 'tsc'} --noEmit --pretty false`,
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  );
} catch (error) {
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
}

const current = new Map();
for (const line of output.split('\n')) {
  const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+):/);
  if (!match) continue;
  const key = `${match[1]} ${match[2]}`;
  current.set(key, (current.get(key) ?? 0) + 1);
}
if (current.size === 0 && /error TS/.test(output)) {
  process.stderr.write('Could not parse tsc output:\n' + output);
  process.exit(1);
}

const serialize = (map) =>
  [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, n]) => `${n} ${key}`)
    .join('\n') + '\n';

if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, serialize(current));
  process.stdout.write(
    `Wrote ${[...current.values()].reduce((a, b) => a + b, 0)} errors to the baseline.\n`,
  );
  process.exit(0);
}

const baseline = new Map();
if (existsSync(baselineFile)) {
  for (const line of readFileSync(baselineFile, 'utf8').split('\n')) {
    const match = line.match(/^(\d+) (.+)$/);
    if (match) baseline.set(match[2], Number(match[1]));
  }
}

const added = [];
const fixed = [];
for (const key of new Set([...current.keys(), ...baseline.keys()])) {
  const now = current.get(key) ?? 0;
  const before = baseline.get(key) ?? 0;
  if (now > before) added.push(`${key}: ${before} -> ${now}`);
  if (now < before) fixed.push(`${key}: ${before} -> ${now}`);
}

const total = [...current.values()].reduce((a, b) => a + b, 0);
if (added.length > 0) {
  process.stderr.write(
    `FAIL typecheck: ${added.length} new error group(s)\n${added.map((l) => `- ${l}`).join('\n')}\n`,
  );
  process.stderr.write('Run `bun run typecheck` for the full messages.\n');
  process.exit(1);
}
if (fixed.length > 0) {
  process.stdout.write(
    `Fewer errors than the baseline:\n${fixed.map((l) => `- ${l}`).join('\n')}\n`,
  );
  process.stdout.write(
    'Run `bun run typecheck:baseline -- --update` and commit the baseline.\n',
  );
}
process.stdout.write(
  `PASS typecheck baseline (${total} inherited errors, none new)\n`,
);
