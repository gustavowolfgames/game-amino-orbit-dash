// bun run carina <words>   — look up Carina, the creative knowledge base, for game feel.
//
// Carina (github.com/wolfgames/carina) is a folder of markdown entries: patterns/, glossary/,
// critiques/, briefs/ and more, each with frontmatter (name, description, category, tags) and
// an "In our games" section with the numbers to use. This script is the offline fallback for
// the `pyxis_search({ project: "carina" })` MCP tool: keyword scoring, no index, no deps.
//
//   bun run carina hit impact            top matches for "hit impact"
//   bun run carina -n 10 confetti win    top 10
//   bun run carina --category juice      every entry in one category
//   bun run carina --show freeze-frame-before-impact    print one entry in full
//   bun run carina --categories          categories and how many entries each has
//
// Where Carina lives: CARINA_DIR (env, or .env.local / .env), else ../carina next to this repo.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Folders in Carina that are not entries (books, tooling, art). */
const NOT_ENTRIES = new Set([
  'sources',
  'docs',
  'scripts',
  'skills',
  'node_modules',
]);
const STOP = new Set(
  'a an and the of to for in on at by with is it be or as that this when what how do my our'.split(
    ' ',
  ),
);

function envValue(key) {
  if (process.env[key]) return process.env[key];
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`));
      if (m?.[1]) return m[1].replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

function carinaDir() {
  const raw = envValue('CARINA_DIR') || '../carina';
  const dir = path.resolve(
    root,
    raw.replace(/^~(?=\/)/, process.env.HOME ?? '~'),
  );
  if (!existsSync(path.join(dir, 'patterns'))) {
    console.error(
      `carina: no Carina checkout at ${dir} (looked for ${path.join(dir, 'patterns')}).\n` +
        '  Clone wolfgames/carina, then set CARINA_DIR=/path/to/carina in .env.local\n' +
        '  (or place it at ../carina next to this repo). See .env.example.',
    );
    process.exit(2);
  }
  return dir;
}

/** Minimal frontmatter: `key: value`, `key: [a, b]`, quoted strings, trailing `# comments`. */
function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  if (!m) return { meta, body: text };
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (!/^["'[]/.test(v)) v = v.replace(/\s+#.*$/, '').trim();
    if (v.startsWith('[')) {
      meta[kv[1]] = v
        .replace(/^\[|\]\s*(#.*)?$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      meta[kv[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: m[2] };
}

function loadEntries(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name.startsWith('.') || name.startsWith('_')) continue;
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.md') && name !== 'README.md') {
        const { meta, body } = parse(readFileSync(p, 'utf8'));
        const id = path
          .relative(dir, p)
          .replace(/\.md$/, '')
          .split(path.sep)
          .join('/');
        out.push({ id, file: p, meta, body });
      }
    }
  };
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (
      name.startsWith('.') ||
      NOT_ENTRIES.has(name) ||
      !statSync(p).isDirectory()
    )
      continue;
    walk(p);
  }
  return out;
}

const words = (s) =>
  String(s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));

function score(entry, query) {
  const name = words(entry.meta.name ?? entry.id);
  const tags = (entry.meta.tags ?? []).flatMap(words);
  const cat = words(entry.meta.category ?? entry.meta.type);
  const desc = words(entry.meta.description);
  const body = new Set(words(entry.body));
  let s = 0;
  for (const q of query) {
    const stem = q.length > 4 ? q.slice(0, -1) : q; // "shakes" ~ "shake", "frames" ~ "frame"
    const hit = (list) => list.some((w) => w === q || w === stem);
    // Prefix matches only for words of 4+ letters: "win" must not match "wind-up".
    const part = (list) =>
      q.length >= 4 &&
      list.some(
        (w) => w.startsWith(stem) || (w.length >= 4 && q.startsWith(w)),
      );
    if (hit(name)) s += 6;
    else if (part(name)) s += 3;
    if (hit(tags)) s += 5;
    else if (part(tags)) s += 2;
    if (hit(cat)) s += 4;
    if (hit(desc)) s += 3;
    else if (part(desc)) s += 1;
    if (body.has(q) || body.has(stem)) s += 1; // whole words: "win" is not in "showing"
  }
  return s;
}

const label = (e) => e.meta.category || e.meta.type || '-';
const line = (e) => `${e.id} [${label(e)}] ${e.meta.description ?? ''}`;

// ── CLI ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let top = 6;
let category = null;
let show = null;
let listCategories = false;
const query = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-n' || a === '--top') top = Number(args[++i]) || top;
  else if (a === '--category' || a === '-c') category = args[++i];
  else if (a === '--show' || a === '-s') show = args[++i];
  else if (a === '--categories') listCategories = true;
  else if (a === '-h' || a === '--help') {
    console.log(
      'usage: bun run carina [-n N] [--category C] <words…> | --show <name> | --categories',
    );
    process.exit(0);
  } else query.push(...words(a));
}

const dir = carinaDir();
const entries = loadEntries(dir);

if (show) {
  const key = show.replace(/\.md$/, '');
  const e =
    entries.find((x) => x.id === key) ??
    entries.find((x) => x.id.endsWith(`/${key}`) || x.meta.name === key);
  if (!e) {
    console.error(
      `carina: no entry "${show}". Try: bun run carina ${words(show).join(' ')}`,
    );
    process.exit(1);
  }
  console.log(`# ${e.id}  (${path.relative(root, e.file)})\n`);
  console.log(readFileSync(e.file, 'utf8'));
  process.exit(0);
}

if (listCategories || (!query.length && !category)) {
  const counts = new Map();
  for (const e of entries)
    counts.set(label(e), (counts.get(label(e)) ?? 0) + 1);
  console.log(`Carina at ${dir}: ${entries.length} entries`);
  for (const [c, n] of [...counts].sort((a, b) => b[1] - a[1]))
    console.log(`  ${c.padEnd(12)} ${n}`);
  if (!listCategories)
    console.log(
      '\nusage: bun run carina [-n N] [--category C] <words…> | --show <name>',
    );
  process.exit(0);
}

const pool = category ? entries.filter((e) => label(e) === category) : entries;
const ranked = query.length
  ? pool
      .map((e) => ({ e, s: score(e, query) }))
      .filter((r) => r.s > 1) // a body-only mention is not a match
      .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))
  : pool.map((e) => ({ e, s: 0 })).sort((a, b) => a.e.id.localeCompare(b.e.id));

if (!ranked.length) {
  console.log(
    `carina: nothing for "${query.join(' ')}"${category ? ` in ${category}` : ''}.`,
  );
  process.exit(0);
}
for (const { e } of query.length ? ranked.slice(0, top) : ranked)
  console.log(line(e));
if (query.length) console.log(`\nFull entry: bun run carina --show <name>`);
