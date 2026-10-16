// bun run check:agent — mechanical checks for the rules recipes can't enforce in prose.
//
//   1. No DOM or timers in game code: nothing under src/game/ outside the DOM shell
//      folders touches document, window/document listeners, requestAnimationFrame,
//      setTimeout or setInterval. Keyboard input is wired in a Solid screen.
//   2. (retired: the template ships a skeleton, not a sample game to replace)
//   3. A new game's controller stays thin (CONTROLLER_MAX_LINES).
//   4. AGENTS.md is the one agent entry point: CLAUDE.md imports it, and nothing runs
//      on install or dev to write agent files.
//   5. Every repo path the router, recipes and skills cite exists (or is a path the
//      recipes tell you to create).
//   6. A new game does not keep the template's slug: wolf-game-kit.json gameSlug is the
//      CDN and Dynamic Data namespace, so a game left on it publishes as the template.
//
// The limits live here. Change a rule in this file, not in a doc.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
/** The template's own src/game files. Any other .ts/.tsx there, or a registered system,
 *  means a new game exists. */
// Regenerate when the template's own src/game files change:
//   git ls-files 'src/game/*.ts' 'src/game/*.tsx'
const TEMPLATE_FILES = new Set([
  'src/game/content/served-mode.ts',
  'src/game/screens/components/titleFrame.ts',
  'src/game/screens/skipStartScreen.ts',
  'src/game/screens/useSpaceKey.ts',
  'src/game/setup/edition-analytics.ts',
  'src/game/setup/progress.ts',
  'src/game/setup/served-session.ts',
  'src/game/EmbedHook.tsx',
  'src/game/asset-manifest.ts',
  'src/game/audio/manager.ts',
  'src/game/audio/sounds.ts',
  'src/game/brand/defaults.ts',
  'src/game/brand/fonts.ts',
  'src/game/brand/index.ts',
  'src/game/brand/load.ts',
  'src/game/brand/merge.ts',
  'src/game/brand/theme.ts',
  'src/game/config.ts',
  'src/game/content/active-pack.ts',
  'src/game/content/assemble.ts',
  'src/game/content/catalog.ts',
  'src/game/content/content-pack.ts',
  'src/game/content/dynamic-client.ts',
  'src/game/content/index.ts',
  'src/game/content/level.ts',
  'src/game/content/load.ts',
  'src/game/index.ts',
  'src/game/lib/sentry-client.ts',
  'src/game/mygame-contract.ts',
  'src/game/mygame/agent/agentPlugin.ts',
  'src/game/mygame/config.ts',
  'src/game/mygame/engine/createTickerEngine.ts',
  'src/game/mygame/engine/fixedStep.ts',
  'src/game/mygame/engine/index.ts',
  'src/game/mygame/engine/types.ts',
  'src/game/mygame/index.ts',
  'src/game/mygame/input/pointer.ts',
  'src/game/mygame/render/textures.ts',
  'src/game/mygame/screens/gameController.ts',
  'src/game/mygame/screens/index.ts',
  'src/game/mygame/screens/startView.tsx',
  'src/game/mygame/sim/plugin.ts',
  'src/game/mygame/sim/readStateFromEcs.ts',
  'src/game/mygame/sim/rng.ts',
  'src/game/mygame/sim/schedule.ts',
  'src/game/mygame/sim/systems/index.ts',
  'src/game/mygame/world.ts',
  'src/game/screens/GameScreen.tsx',
  'src/game/screens/LoadingScreen.tsx',
  'src/game/screens/PixiBackdrop.ts',
  'src/game/screens/ResultsScreen.tsx',
  'src/game/screens/StartScreen.tsx',
  'src/game/screens/components/CompletionOverlay.tsx',
  'src/game/screens/components/GameSettingsMenu.tsx',
  'src/game/screens/components/IntroSting.tsx',
  'src/game/screens/components/index.ts',
  'src/game/screens/index.ts',
  'src/game/screens/useCompanionDialogue.ts',
  'src/game/screens/useGameData.ts',
  'src/game/settingsOpen.ts',
  'src/game/settingsTheme.ts',
  'src/game/setup/content.ts',
  'src/game/setup/events.ts',
  'src/game/setup/flags.ts',
  'src/game/setup/loading-tracker.ts',
  'src/game/setup/session-tracker.ts',
  'src/game/setup/tracking.ts',
  'src/game/setup/vault-content.tsx',
  'src/game/tuning/index.ts',
  'src/game/tuning/types.ts',
]);
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

if (newGame) {
  // 3. Thin controller.
  for (const f of gameFiles.filter((f) => f.endsWith('gameController.ts'))) {
    const n = readFileSync(f, 'utf8').split('\n').length;
    if (n > CONTROLLER_MAX_LINES)
      fail(
        `${rel(f)} is ${n} lines (cap ${CONTROLLER_MAX_LINES}) — move code into sibling modules`,
      );
  }
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
const docs = [path.join(root, 'AGENTS.md')].filter((f) => existsSync(f));
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
    /`((?:src|scripts|tests)\/[A-Za-z0-9_./<>-]+)`/g,
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

// 6. A new game has its own slug.
if (newGame) {
  const kit = path.join(root, 'wolf-game-kit.json');
  const slug = existsSync(kit)
    ? JSON.parse(readFileSync(kit, 'utf8')).gameSlug
    : undefined;
  if (slug === TEMPLATE_SLUG) {
    fail(
      `wolf-game-kit.json gameSlug is still the template's ("${TEMPLATE_SLUG}") — set the game's Nucleo slug, or "mygame" for a local-only build (.agents/recipes/new-game.md)`,
    );
  }
}

if (failures.length) {
  console.error(`FAIL agent surface (${failures.length})`);
  for (const m of failures) console.error(`  - ${m}`);
  process.exit(1);
}
console.log(
  `PASS agent surface${newGame ? ' (new game: own slug, controller thin)' : ' (template skeleton)'}`,
);
