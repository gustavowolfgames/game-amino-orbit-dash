import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/app.tsx',
    'src/core/index.ts',
    'src/game/index.ts',
    // Template starter surface — exported API the next game builds on, not dead code.
    'src/game/mygame/sim/plugin.ts',
    'src/game/mygame/sim/events.ts',
    'src/game/mygame/sim/rng.ts',
    'src/game/mygame/agent/agentPlugin.ts',
    'src/game/mygame/agent/createAgentService.ts',
    'src/game/mygame/screens/cues.ts',
    'src/game/mygame/screens/gameAudio.ts',
    // Seam barrels: each index.ts is a module's documented public API (header comment /
    // README), so what a game may import from it is not dead because this game doesn't yet.
    'src/game/mygame/index.ts', // setupGame contract + its types
    'src/game/mygame/engine/index.ts',
    'src/game/content/index.ts',
    'src/game/brand/index.ts',
    'src/game/tuning/index.ts',
    'src/integrations/vault/index.ts',
    // Analytics schema catalog: the standard level_*/chapter_* events a game wires into
    // tracking.ts when it has levels or chapters (.agents/recipes/analytics.md).
    'src/game/setup/events.ts',
    'scripts/*.{ts,mjs}',
    'tests/**/*.test.ts',
    'tests/**/*.spec.ts',
  ],
  // scripts/ is in the project so the deps its helpers import count as used. CSS is in
  // it so the compiler below can follow `@import "tailwindcss"` in src/app.css.
  project: ['src/**/*.{ts,tsx,css}', 'scripts/**/*.{ts,mjs}'],
  ignoreExportsUsedInFile: true,
  ignoreIssues: {
    // src/core/ is the upstream-managed, read-only scaffold (synced from template-amino).
    // Its files and exports are its public surface for games; we do not trim them here.
    'src/core/**': ['files', 'exports', 'types'],
  },
  compilers: {
    // Follow CSS @imports (src/app.css pulls in tailwindcss).
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
  ignoreDependencies: [
    // Types-only: tweakpane's .d.ts files import from @tweakpane/core; without it
    // `bun run typecheck` fails. Nothing imports it by name.
    '@tweakpane/core',
  ],
  // Both come from @wolfgames/dev, installed per machine (not a template dependency);
  // the scripts that call them skip when they are missing (see `prebuild`).
  ignoreBinaries: ['wolf-dev', 'nucleo'],
};

export default config;
