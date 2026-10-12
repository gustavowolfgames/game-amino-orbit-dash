// bun run agent:surface — switch the agent guidance this repo gives Claude Code (and
// other harnesses) on or off. Toggles live in package.json:
//
//   "agentSurface": { "recipes": true, "cortex": false, "systems": false }
//
//   recipes  AGENTS.md router + always-on core + on-demand .agents/recipes/ (default on)
//   cortex   the @wolfgames/cortex alwaysApply rule pack (generated .claude/rules etc.)
//   systems  the @wolfgames/game-systems catalog steer (.agents/recipes/systems.md, loaded every turn)
//
// Runs on postinstall and predev, so the toggles always hold. One-off override without
// editing package.json: AGENT_SURFACE=recipes,cortex bun run agent:surface
//
// CLAUDE.md is GENERATED from the toggles. Edit the toggles, not CLAUDE.md.
// Benchmarks behind the default (recipes on, cortex off): ENG-4734 / ENG-4735, aminoBench.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULTS = { recipes: true, cortex: false, systems: false };

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
let on = { ...DEFAULTS, ...(pkg.agentSurface ?? {}) };
if (process.env.AGENT_SURFACE !== undefined) {
  const want = new Set(
    process.env.AGENT_SURFACE.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  on = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, want.has(k)]));
}

// Paths cortex setup generates. Only cortex's own output is ever removed: a symlink (what
// setup makes), or an entry named like one in a cortex pack (its copy fallback on Windows).
// Anything else (the recipes' own .agents/skills/, a game's own skills) stays, tracked or
// not: a game copied without git history (nucleo game create) still has them untracked.
const CORTEX_OUTPUT = [
  '.claude/rules',
  '.claude/skills',
  '.claude/commands',
  '.agents/rules',
  '.agents/skills',
  '.agents/commands',
];
const CORTEX_INDEX = '.claude/rules.md';
const CORTEX_PKG = path.join(root, 'node_modules/@wolfgames/cortex');

function tracked(rel) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', rel], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/** Entry names cortex setup can write into a `rules`, `skills` or `commands` folder. */
function cortexNames(kind) {
  const names = new Set();
  if (!existsSync(CORTEX_PKG)) return names;
  for (const pack of readdirSync(CORTEX_PKG)) {
    const dir = path.join(CORTEX_PKG, pack, kind);
    if (existsSync(dir) && lstatSync(dir).isDirectory())
      for (const n of readdirSync(dir)) names.add(n);
  }
  return names;
}

function cortexOff() {
  let removed = 0;
  for (const dir of CORTEX_OUTPUT) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    const generated = cortexNames(path.basename(dir));
    for (const name of readdirSync(abs)) {
      const rel = `${dir}/${name}`;
      const fromCortex =
        lstatSync(path.join(root, rel)).isSymbolicLink() || generated.has(name);
      if (fromCortex && !tracked(rel)) {
        rmSync(path.join(root, rel), { recursive: true, force: true });
        removed++;
      }
    }
    if (!readdirSync(abs).length) rmSync(abs, { recursive: true }); // leave no empty cortex dirs
  }
  if (existsSync(path.join(root, CORTEX_INDEX))) {
    rmSync(path.join(root, CORTEX_INDEX));
    removed++;
  }
  return removed;
}

function trackedFiles(dir) {
  try {
    return execFileSync('git', ['ls-files', dir], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function cortexOn() {
  const setup = path.join(
    root,
    'node_modules/@wolfgames/cortex/scripts/setup.mjs',
  );
  if (!existsSync(setup)) {
    console.warn(
      '[agent-surface] cortex is on but @wolfgames/cortex is not installed — run bun install',
    );
    return false;
  }
  // Cortex setup rewrites its output folders wholesale, which would delete the files
  // git tracks there (the recipes' own .agents/skills/). Keep them and put them back.
  const keep = CORTEX_OUTPUT.flatMap(trackedFiles).map((rel) => [
    rel,
    readFileSync(path.join(root, rel)),
  ]);
  execFileSync('node', [setup], { cwd: root, stdio: 'inherit' });
  for (const [rel, buf] of keep) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), buf);
  }
  return true;
}

const notes = [];
if (on.cortex) {
  if (cortexOn()) notes.push('cortex rules generated');
} else {
  const n = cortexOff();
  if (n) notes.push(`removed ${n} generated cortex file(s)`);
}

if (
  on.systems &&
  !existsSync(path.join(root, 'node_modules/@wolfgames/game-systems'))
) {
  console.warn(
    '[agent-surface] systems is on but @wolfgames/game-systems is not installed — bun add @wolfgames/game-systems',
  );
}

// CLAUDE.md: one @import per enabled surface, in load order.
const imports = [];
if (on.recipes) imports.push('@AGENTS.md');
if (on.cortex) imports.push('@.claude/rules.md');
if (on.systems) imports.push('@.agents/recipes/systems.md');
const enabled = Object.entries(on)
  .filter(([, v]) => v)
  .map(([k]) => k);
const claude = [
  '<!-- GENERATED by scripts/agent-surface.mjs from package.json "agentSurface". Edit the toggles, then run `bun run agent:surface`. -->',
  `<!-- Agent surface: ${enabled.join(' + ') || 'none'} -->`,
  '',
  ...imports,
  '',
  on.recipes
    ? '`AGENTS.md` (imported above) is the router. Open the one recipe it names for the task.'
    : 'Read `docs/INDEX.md` for the routing table.',
  'If the task changes what the game is, update `docs/GAME-DESIGN.md` in the same change.',
  '',
].join('\n');
const claudePath = path.join(root, 'CLAUDE.md');
const before = existsSync(claudePath) ? readFileSync(claudePath, 'utf8') : '';
if (before !== claude) {
  writeFileSync(claudePath, claude);
  notes.push('CLAUDE.md regenerated');
}

console.log(
  `[agent-surface] ${enabled.join(' + ') || 'none'}${notes.length ? ` — ${notes.join(', ')}` : ''}`,
);
