import { defineConfig, devices } from '@playwright/test';

// Dedicated ports so the suite never collides with an already-running dev server.
const port = Number(process.env.E2E_PORT ?? 5199);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// Game Packs run against a dev server WITH the game slug: Dynamic Data paths are keyed by it, and
// without one the SDK refuses to build a path and the game plays its bundled content — the
// fallback, not the feature. Kept on its own server so the default smoke run stays slug-less.
const packsPort = port - 1;
const packsURL = `http://localhost:${packsPort}`;
const GAME_SLUG = process.env.VITE_GAME_KIT_PROJECT_ID ?? 'aminoecspure';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /game-packs\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL },
    },
    {
      name: 'game-packs',
      testMatch: /game-packs\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: packsURL },
    },
  ],
  webServer: [
    {
      command: `bun run dev -- --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `bun run dev -- --port ${packsPort} --strictPort`,
      url: packsURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_GAME_KIT_PROJECT_ID: GAME_SLUG },
    },
  ],
});
