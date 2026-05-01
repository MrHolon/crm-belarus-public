import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Unit / component test config.
 *
 * Role-based integration tests live in `tests/roles/` and require a live
 * Supabase instance + service-role key; they are run via the dedicated
 * `vitest.roles.config.ts` (`npm run test:roles`). We explicitly exclude
 * them here so `npm test` stays fast and hermetic.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'tests/**', 'e2e/**'],
  },
});
