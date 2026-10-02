import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Use the built CommonJS bundle; its ESM build imports argon2's wasm in a way only bundlers understand.
    alias: {
      'skiff-crypto': path.resolve(__dirname, '../libs/skiff-crypto/dist/cjs/index.js'),
      // One graphql instance for tests and for the CommonJS server code (graphql-tools, Apollo).
      graphql: path.resolve(__dirname, '../node_modules/graphql/index.js')
    }
  },
  test: {
    testTimeout: 60_000,
    pool: 'forks'
  }
});
