import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // Stubs the browser CacheStorage API that @adobe/data expects at import
    // time — required for headless ECS tests in Node.
    setupFiles: ['tests/vitest.setup.ts'],
  },
  resolve: {
    // Exact-match aliases: a bare "solid-js" prefix alias also rewrites
    // "solid-js/web" to ".../dist/solid.js/web", which does not exist.
    alias: [
      { find: /^~\//, replacement: `${path.resolve(__dirname, 'src')}/` },
      // The "node" condition resolves solid-js to its non-reactive server build.
      {
        find: /^solid-js$/,
        replacement: path.resolve(
          __dirname,
          'node_modules/solid-js/dist/solid.js',
        ),
      },
      {
        find: /^solid-js\/web$/,
        replacement: path.resolve(
          __dirname,
          'node_modules/solid-js/web/dist/web.js',
        ),
      },
    ],
  },
});
