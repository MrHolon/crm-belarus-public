import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Role-based integration tests run against a live Supabase instance.
 *
 * Unlike the unit-test suite (happy-dom), these tests:
 *   - log into the real API as each test user,
 *   - exercise RLS, triggers and RPCs end-to-end,
 *   - must run serially so tasks created by one test are visible to the next.
 *
 * Env: `.env` in the repo root supplies `VITE_SUPABASE_URL` + anon key,
 * plus test-only vars documented in `.env.example` (service role, password).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/roles/**/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    env: loadRootEnv(),
  },
});

function loadRootEnv(): Record<string, string> {
  const envDir = path.resolve(__dirname, '..');
  const out: Record<string, string> = {};
  for (const name of ['.env', '.env.local', '.env.test']) {
    const file = path.join(envDir, name);
    try {
      const raw = require('node:fs').readFileSync(file, 'utf8') as string;
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
        if (!m) continue;
        const [, k, v] = m;
        out[k] = v.replace(/^['"]|['"]$/g, '');
      }
    } catch {
      // File optional.
    }
  }
  return out;
}
