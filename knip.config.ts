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
    'scripts/*.ts',
    'tests/**/*.test.ts',
    'tests/**/*.spec.ts',
  ],
  project: ['src/**/*.{ts,tsx}'],
};

export default config;
