// bun run check:agent — mechanical checks for the rules recipes can't enforce in prose.
//
//   1. No DOM or timers in game code: nothing under src/game/ outside the DOM shell
//      folders touches document, window/document listeners, requestAnimationFrame,
//      setTimeout or setInterval. Keyboard input is wired in a Solid screen.
//   2. The orb sample is replaced, not left beside the new game: once a new game
//      exists, no file may still carry the sample's names.
//   3. A new game's controller stays thin (CONTROLLER_MAX_LINES).
//   4. The agent surface matches its toggles (package.json "agentSurface").
//   5. Every repo path the router, recipes and skills cite exists (or is a path the
//      recipes tell you to create).
//
// The limits live here. Change a rule in this file, not in a doc.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTROLLER_MAX_LINES = 400;
/** DOM shell folders under src/game/ where DOM and window listeners are allowed. */
const DOM_ALLOWED = ['src/game/screens/', 'src/game/setup/'];
const DOM_PATTERN =
  /\bdocument\.|\b(window|document|globalThis)\.(add|remove)EventListener\(|\brequestAnimationFrame\(|\bset(Timeout|Interval)\(/;
/** Names that exist only in the orb sample (Orbiter/Mover demo). */
const SAMPLE_PATTERN = /\b(Orbiter|orbitSystem|movementSystem|ORBITER_COUNT)\b/;
/** The template's own src/game files. Any other .ts/.tsx there means a new game exists. */
const TEMPLATE_FILES = new Set([
  'src/game/EmbedHook.tsx', 'src/game/asset-manifest.ts', 'src/game/audio/manager.ts',
  'src/game/audio/sounds.ts', 'src/game/config.ts', 'src/game/config/identity.ts',
  'src/game/index.ts', 'src/game/mygame-contract.ts', 'src/game/mygame/demo/config.ts',
  'src/game/mygame/demo/rng.ts', 'src/game/mygame/ecs/agentPlugin.ts',
  'src/game/mygame/ecs/gamePlugin.ts', 'src/game/mygame/ecs/readStateFromEcs.ts',
  'src/game/mygame/ecs/schedule.ts', 'src/game/mygame/ecs/systems/index.ts',
  'src/game/mygame/ecs/systems/inputSystem.ts', 'src/game/mygame/ecs/systems/movementSystem.ts',
  'src/game/mygame/ecs/systems/orbitSystem.ts', 'src/game/mygame/engine/createTickerEngine.ts',
  'src/game/mygame/engine/fixedStep.ts', 'src/game/mygame/engine/index.ts',
  'src/game/mygame/engine/types.ts', 'src/game/mygame/index.ts', 'src/game/mygame/render/textures.ts',
  'src/game/mygame/screens/gameController.ts', 'src/game/mygame/screens/index.ts',
  'src/game/mygame/screens/startView.tsx', 'src/game/mygame/world.ts',
  'src/game/screens/GameScreen.tsx', 'src/game/screens/LoadingScreen.tsx',
  'src/game/screens/PixiBackdrop.ts', 'src/game/screens/ResultsScreen.tsx',
  'src/game/screens/StartScreen.tsx', 'src/game/screens/components/CompletionOverlay.tsx',
  'src/game/screens/components/index.ts', 'src/game/screens/index.ts',
  'src/game/screens/useCompanionDialogue.ts', 'src/game/screens/useGameData.ts',
  'src/game/setup/analytics-service.ts', 'src/game/setup/events.ts', 'src/game/setup/flags.ts',
  'src/game/setup/helper.ts', 'src/game/setup/loading-tracker.ts', 'src/game/setup/session-tracker.ts',
  'src/game/setup/tracking.ts', 'src/game/tuning/index.ts', 'src/game/tuning/types.ts',
]);
/** Paths the recipes tell an agent to create; they need not exist yet. */
const CITED_TO_CREATE = [/^src\/game\/mygame\/rules\/?$/, /^src\/game\/mygame\/levels\.ts$/, /^src\/game\/mygame\/defaultPack\.ts$/, /<name>/, /^src\/game\/progress\.ts$/];

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
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return text.split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'));
}

const gameFiles = walk(path.join(root, 'src/game'));
const newGame = gameFiles.some((f) => !TEMPLATE_FILES.has(rel(f))) || !existsSync(path.join(root, 'src/game/mygame'));

// 1. DOM and timers stay in the shell folders.
for (const f of gameFiles) {
  const r = rel(f);
  if (DOM_ALLOWED.some((d) => r.startsWith(d))) continue;
  codeLines(f).forEach((line, i) => {
    if (DOM_PATTERN.test(line)) fail(`DOM/timer in game code: ${r}:${i + 1}  ${line.trim().slice(0, 80)}  (move it to src/game/screens/)`);
  });
}

if (newGame) {
  // 2. No orb-sample leftovers once a new game exists.
  for (const f of [...gameFiles, ...walk(path.join(root, 'tests'))]) {
    const hits = codeLines(f).map((l, i) => (SAMPLE_PATTERN.test(l) ? i + 1 : 0)).filter(Boolean);
    if (hits.length) fail(`orb-sample code left in ${rel(f)} (lines ${hits.slice(0, 5).join(', ')}) — replace or delete it (.agents/recipes/new-game.md)`);
  }
  // 3. Thin controller.
  for (const f of gameFiles.filter((f) => f.endsWith('gameController.ts'))) {
    const n = readFileSync(f, 'utf8').split('\n').length;
    if (n > CONTROLLER_MAX_LINES) fail(`${rel(f)} is ${n} lines (cap ${CONTROLLER_MAX_LINES}) — move code into sibling modules`);
  }
}

// 4. The agent surface matches its toggles (package.json "agentSurface", applied by
//    scripts/agent-surface.mjs on postinstall/predev). Cortex never runs directly.
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const surface = { recipes: true, cortex: false, systems: false, ...(pkg.agentSurface ?? {}) };
for (const k of ['postinstall', 'predev']) {
  const cmd = pkg.scripts?.[k] ?? '';
  if (cmd.includes('cortex')) fail(`package.json ${k} runs cortex setup directly — use scripts/agent-surface.mjs`);
}
const claudeMd = existsSync(path.join(root, 'CLAUDE.md')) ? readFileSync(path.join(root, 'CLAUDE.md'), 'utf8') : '';
if (surface.recipes !== claudeMd.includes('@AGENTS.md')) fail('CLAUDE.md does not match agentSurface.recipes — run bun run agent:surface');
if (surface.cortex !== claudeMd.includes('@.claude/rules.md')) fail('CLAUDE.md does not match agentSurface.cortex — run bun run agent:surface');
if (!surface.cortex && existsSync(path.join(root, '.claude/rules.md'))) fail('cortex is off but .claude/rules.md exists — run bun run agent:surface');

// 5. Cited paths exist.
const docs = [path.join(root, 'AGENTS.md')].filter((f) => existsSync(f));
for (const d of [path.join(root, '.agents/recipes'), path.join(root, '.agents/skills')]) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d, { recursive: true })) if (String(f).endsWith('.md')) docs.push(path.join(d, String(f)));
}
for (const doc of docs) {
  for (const [, p] of readFileSync(doc, 'utf8').matchAll(/`((?:src|scripts|tests)\/[A-Za-z0-9_./<>-]+)`/g)) {
    const clean = p.replace(/[.,]$/, '');
    if (CITED_TO_CREATE.some((re) => re.test(clean))) continue;
    if (!existsSync(path.join(root, clean)) && !(newGame && clean.startsWith('src/game/mygame/'))) {
      fail(`${rel(doc)} cites ${clean}, which does not exist`);
    }
  }
}

if (failures.length) {
  console.error(`FAIL agent surface (${failures.length})`);
  for (const m of failures) console.error(`  - ${m}`);
  process.exit(1);
}
console.log(`PASS agent surface${newGame ? ' (new game: sample replaced, controller thin)' : ' (template sample)'}`);
