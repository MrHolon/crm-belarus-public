import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * End-to-end tests that drive the real UI (Vite dev server) against the
 * local Supabase stack. See `e2e/fixtures/auth.ts` for the role-based
 * login helper.
 *
 * Run locally: `npm run e2e`.
 * Run against a remote preview: `BASE_URL=https://... npm run e2e`.
 */

// Reuse root-level env for VITE_* + TEST_USER_PASSWORD so the e2e helpers
// can read them without a custom dotenv dep.
loadRootEnv();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Europe/Minsk',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

function loadRootEnv(): void {
  const envDir = path.resolve(__dirname, '..');
  for (const name of ['.env', '.env.local', '.env.test']) {
    const file = path.join(envDir, name);
    try {
      const raw = fs.readFileSync(file, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
        if (!m) continue;
        const [, k, v] = m;
        if (!process.env[k]) {
          process.env[k] = v.replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {
      // optional
    }
  }
}
