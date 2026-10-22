// The slow amino-* CLI tests (git fixtures + bun subprocesses): `bun run test:scripts`.
// Spread rather than mergeConfig: mergeConfig concatenates include/exclude arrays.
import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
