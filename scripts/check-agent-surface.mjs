// bun run check:agent — mechanical checks for the rules recipes can't enforce in prose.
//
//   1. No DOM or timers in game code: nothing under src/game/ outside the DOM shell
//      folders touches document, window/document listeners, requestAnimationFrame,
//      setTimeout or setInterval. Keyboard input is wired in a Solid screen.
//   2. (retired: the template ships a skeleton, not a sample game to replace)
//   3. The game controller stays thin (CONTROLLER_MAX_LINES), skeleton included.
//   4. AGENTS.md is the one agent entry point: CLAUDE.md imports it, and nothing runs
//      on install or dev to write agent files.
//   5. Every repo path the router, recipes, skills, README and src/game's own instruction
//      files cite exists (or is a path the recipes tell you to create). docs/ holds only
//      docs/GAME-DESIGN.md, so a cite of any other docs/ file fails here.
//   6. wolf-game-kit.json gameSlug is a bare slug and projectId equals it (always), and a
//      new game does not keep the template's slug: gameSlug is the CDN and Dynamic Data
//      namespace, so a game left on it publishes as the template.
//   7. The game screen keeps Space away from the scaffold's pause toggle (ENG-4797):
//      GameScreen.tsx calls useSpaceKey, directly or through useGameKeyboard.
//   8. No leftover tap-sample identifiers (pendingTaps, submitTap, readStateFromEcs) in
//      src/game: the template dropped the sample, and a game that still has them carries
//      dead code that READMEs and tests then pin.
//   9. Every backticked src/ path in a src/game/mygame/**/README.md exists: those READMEs
//      are the game's own map, so they must stay true as the game changes.
//
// What counts as "the template's own files" (and so whether a new game exists) is
// scripts/template-files.txt. In the template repo, regenerate it after adding or
// removing a src/game file:  node scripts/check-agent-surface.mjs --write-template-files
//
// The limits live here. Change a rule in this file, not in a doc.
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLLER_MAX_LINES = 400;
/** This template's own Nucleo slug (wolf-game-kit.json). A new game must not publish under it. */
const TEMPLATE_SLUG = 'aminoecspure';
/** DOM shell folders under src/game/ where DOM and window listeners are allowed:
 *  Solid screens, app wiring, and brand theming (CSS variables + font loading). */
const DOM_ALLOWED = ['src/game/screens/', 'src/game/setup/', 'src/game/brand/'];
const DOM_PATTERN =
  /\bdocument\.|\b(window|document|globalThis)\.(add|remove)EventListener\(|\brequestAnimationFrame\(|\bset(Timeout|Interval)\(/;
/** The template's own src/game files (scripts/template-files.txt). Any other .ts/.tsx
 *  there, or a registered system, means a new game exists. */
const TEMPLATE_FILES_LIST = path.join(root, 'scripts/template-files.txt');
/** Leftover identifiers from the retired tap sample (rule 8). */
const SAMPLE_IDENTIFIERS = /\b(pendingTaps|submitTap|readStateFromEcs)\b/;
/** Paths the recipes tell an agent to create; they need not exist yet. */
const CITED_TO_CREATE = [
  /^src\/game\/mygame\/rules\/?$/,
  /^src\/game\/mygame\/levels\.ts$/,
  /^src\/game\/mygame\/defaultPack\.ts$/,
  /<name>/,
  /^src\/game\/progress\.ts$/,
];

const failures = [];
const fail = (m) => failures.push(m);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
/** Source lines with comments removed (line comments, block comments, JSDoc lines). */
function codeLines(file) {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );
  return text.split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'));
}

const gameFiles = walk(path.join(root, 'src/game'));

// --write-template-files: record the current src/game files as the template's own.
// Only the template (still on its own slug) may do this; a game would hide itself.
if (process.argv.includes('--write-template-files')) {
  const kitFile = path.join(root, 'wolf-game-kit.json');
  const kitSlug = existsSync(kitFile)
    ? JSON.parse(readFileSync(kitFile, 'utf8')).gameSlug
    : undefined;
  if (kitSlug !== TEMPLATE_SLUG) {
    console.error(
      `Refusing: --write-template-files is for the template repo only (gameSlug "${TEMPLATE_SLUG}").`,
    );
    process.exit(1);
  }
  const list = gameFiles
    .map(rel)
    .filter((f) => /\.tsx?$/.test(f))
    .sort();
  writeFileSync(
    TEMPLATE_FILES_LIST,
    `# The template's own src/game files. check-agent-surface.mjs treats any other\n# .ts/.tsx under src/game as a new game. Regenerate in the template repo with:\n#   node scripts/check-agent-surface.mjs --write-template-files\n${list.join('\n')}\n`,
  );
  console.log(`Wrote ${list.length} files to ${rel(TEMPLATE_FILES_LIST)}`);
  process.exit(0);
}
const TEMPLATE_FILES = new Set(
  existsSync(TEMPLATE_FILES_LIST)
    ? readFileSync(TEMPLATE_FILES_LIST, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [],
);
const systemsIndex = path.join(root, 'src/game/mygame/sim/systems/index.ts');
const hasSystems =
  existsSync(systemsIndex) &&
  !/SYSTEM_ORDER[^;]*=\s*\[\s*\]\s*;/.test(readFileSync(systemsIndex, 'utf8'));
const newGame =
  gameFiles.some((f) => !TEMPLATE_FILES.has(rel(f))) ||
  hasSystems ||
  !existsSync(path.join(root, 'src/game/mygame'));

// 1. DOM and timers stay in the shell folders.
for (const f of gameFiles) {
  const r = rel(f);
  if (DOM_ALLOWED.some((d) => r.startsWith(d))) continue;
  codeLines(f).forEach((line, i) => {
    if (DOM_PATTERN.test(line))
      fail(
        `DOM/timer in game code: ${r}:${i + 1}  ${line.trim().slice(0, 80)}  (move it to src/game/screens/)`,
      );
  });
}

// 3. Thin controller. Runs on the skeleton too: the template's own controller is the
//    starting point every game copies, so it must already sit under the cap.
for (const f of gameFiles.filter((f) => f.endsWith('gameController.ts'))) {
  const n = readFileSync(f, 'utf8').split('\n').length;
  if (n > CONTROLLER_MAX_LINES)
    fail(
      `${rel(f)} is ${n} lines (cap ${CONTROLLER_MAX_LINES}) — move code into sibling modules`,
    );
}

// 4. AGENTS.md is the one agent entry point. CLAUDE.md only imports it (Claude Code
//    loads CLAUDE.md, not AGENTS.md), and nothing on install or dev writes agent files.
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const claudeMd = existsSync(path.join(root, 'CLAUDE.md'))
  ? readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')
  : '';
if (!claudeMd.includes('@AGENTS.md'))
  fail('CLAUDE.md must import @AGENTS.md (the router)');
for (const k of ['preinstall', 'postinstall', 'predev']) {
  if (pkg.scripts?.[k])
    fail(
      `package.json "${k}" is set — install and dev must not run setup steps (agent files are tracked, not generated)`,
    );
}

// 5. Cited paths exist.
const docs = [
  'AGENTS.md',
  'README.md',
  'src/game/AGENTS.md',
  'src/game/INDEX.md',
]
  .map((f) => path.join(root, f))
  .filter((f) => existsSync(f));
for (const d of [
  path.join(root, '.agents/recipes'),
  path.join(root, '.agents/skills'),
]) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d, { recursive: true }))
    if (String(f).endsWith('.md')) docs.push(path.join(d, String(f)));
}
for (const doc of docs) {
  for (const [, p] of readFileSync(doc, 'utf8').matchAll(
    /`((?:src|scripts|tests|schemas|docs|\.agents)\/[A-Za-z0-9_./<>-]+)`/g,
  )) {
    const clean = p.replace(/[.,]$/, '');
    if (CITED_TO_CREATE.some((re) => re.test(clean))) continue;
    if (
      !existsSync(path.join(root, clean)) &&
      !(newGame && clean.startsWith('src/game/mygame/'))
    ) {
      fail(`${rel(doc)} cites ${clean}, which does not exist`);
    }
  }
}

// 6. The slug. Always: wolf-game-kit.json has a bare gameSlug (never <slug>_<uuid>, which
//    silently splits publishes from what players load) and projectId equals it. A new
//    game also must not keep the template's slug. The skeleton is the one place the
//    template slug is correct, so only that last part is skipped there.
{
  const kit = path.join(root, 'wolf-game-kit.json');
  const cfg = existsSync(kit) ? JSON.parse(readFileSync(kit, 'utf8')) : {};
  const slug = cfg.gameSlug;
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    fail(
      `wolf-game-kit.json gameSlug ${JSON.stringify(slug)} is not a bare Nucleo slug (lowercase letters, digits, hyphens; never <slug>_<uuid>)`,
    );
  } else if (cfg.projectId !== slug) {
    fail(
      `wolf-game-kit.json projectId ${JSON.stringify(cfg.projectId)} must equal gameSlug "${slug}"`,
    );
  } else if (newGame && slug === TEMPLATE_SLUG) {
    fail(
      `wolf-game-kit.json gameSlug is still the template's ("${TEMPLATE_SLUG}") — set the game's Nucleo slug, or "mygame" for a local-only build (.agents/recipes/new-game.md)`,
    );
  }
}

// 7. Space never reaches the scaffold's pause toggle on the game screen (ENG-4797).
const coreSpaceToggle = path.join(root, 'src/core/systems/pause/keyboard.ts');
const gameScreen = path.join(root, 'src/game/screens/GameScreen.tsx');
const gameKeyboard = path.join(root, 'src/game/screens/useGameKeyboard.ts');
const calls = (file, fn) =>
  existsSync(file) &&
  codeLines(file).some((l) => new RegExp(`\\b${fn}\\(`).test(l));
if (
  existsSync(coreSpaceToggle) &&
  /Space/.test(readFileSync(coreSpaceToggle, 'utf8')) &&
  existsSync(gameScreen) &&
  !calls(gameScreen, 'useSpaceKey') &&
  !(calls(gameScreen, 'useGameKeyboard') && calls(gameKeyboard, 'useSpaceKey'))
) {
  fail(
    `${rel(gameScreen)} must call useSpaceKey() (or useGameKeyboard(), which calls it): the scaffold toggles its pause on every Space press during play (ENG-4797)`,
  );
}

// 8. No leftover tap-sample identifiers.
for (const f of gameFiles) {
  codeLines(f).forEach((line, i) => {
    const m = line.match(SAMPLE_IDENTIFIERS);
    if (m)
      fail(
        `leftover tap-sample identifier \`${m[1]}\` in ${rel(f)}:${i + 1} — the template dropped the tap sample; use the game's own input queue`,
      );
  });
}

// 9. Paths in the game's slot READMEs exist.
const mygameDir = path.join(root, 'src/game/mygame');
const slotReadmes = existsSync(mygameDir)
  ? readdirSync(mygameDir, { recursive: true })
      .map(String)
      .filter((f) => f.split(path.sep).pop() === 'README.md')
      .map((f) => path.join(mygameDir, f))
  : [];
for (const readme of slotReadmes) {
  for (const [, p] of readFileSync(readme, 'utf8').matchAll(
    /`(src\/[A-Za-z0-9_./<>-]+)`/g,
  )) {
    const clean = p.replace(/[.,]$/, '');
    if (CITED_TO_CREATE.some((re) => re.test(clean))) continue;
    if (!existsSync(path.join(root, clean)))
      fail(
        `${rel(readme)} cites ${clean}, which does not exist — fix the README or the path`,
      );
  }
}

if (failures.length) {
  console.error(`FAIL agent surface (${failures.length})`);
  for (const m of failures) console.error(`  - ${m}`);
  process.exit(1);
}
console.log(
  `PASS agent surface${newGame ? ' (new game: own slug, controller thin)' : ' (template skeleton: slug well-formed, controller thin)'}`,
);
