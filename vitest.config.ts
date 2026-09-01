import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: [
      {
        find: '@tauri-apps/api/core',
        replacement: new URL(
          './__tests__/mocks/tauri-core.mock.ts',
          import.meta.url,
        ).pathname,
      },
      {
        find: '@tauri-apps/api/event',
        replacement: new URL(
          './__tests__/mocks/tauri-event.mock.ts',
          import.meta.url,
        ).pathname,
      },
      {
        // Vitest + Node ESM resolution needs explicit extension for this SDK import path
        find: 'next/navigation',
        replacement: 'next/navigation.js',
      },
      {
        // The SDK can resolve to a pnpm package-local absolute path that bypasses bare import aliasing.
        // Normalize it to the project-level Next.js navigation entry.
        find: /\/node_modules\/\.pnpm\/@iblai\+web-containers@[^/]+\/node_modules\/next\/navigation$/,
        replacement: new URL(
          './node_modules/next/navigation.js',
          import.meta.url,
        ).pathname,
      },
      {
        // `components/advanced-chart-with-tooltip.tsx` imports a not-yet-built
        // `./detailed-chart-tooltip` placeholder module that does not exist on
        // disk, so Vite's import-analysis cannot resolve it in tests. Point it
        // at a test-only stub so the component is renderable under Vitest.
        find: /^.*\/detailed-chart-tooltip$/,
        replacement: new URL(
          './__tests__/mocks/detailed-chart-tooltip.mock.tsx',
          import.meta.url,
        ).pathname,
      },
      // Mock Tauri APIs for testing
    ],
  },
  test: {
    globals: true,
    setupFiles: ['./__tests__/vitest.setup.ts'],
    environment: 'jsdom',
    // Heavy userEvent/fireEvent interaction tests (e.g. app-sidebar,
    // connector-management) run close to the 5s default per-test ceiling.
    // Under cold Vite caches or CPU contention (CI, the pre-push hook) the
    // extra wall-clock time tips them over and they flake as "timed out in
    // 5000ms". Raising the budget removes the false negatives without hiding
    // real failures — assertion errors still fail immediately and genuine
    // hangs still time out.
    testTimeout: 15000,
    hookTimeout: 15000,
    // `e2e/**` (Playwright) and `e2e-tauri/**` (WebdriverIO, driven by
    // e2e-tauri/wdio.conf.ts) are end-to-end suites that need a real browser /
    // a launched Tauri binary. Vitest would otherwise collect their `.spec.ts`
    // files and fail them for lack of a WebDriver session.
    exclude: [...configDefaults.exclude, 'e2e/**', 'e2e-tauri/**'],
    server: {
      deps: {
        inline: true,
      },
    },
    coverage: {
      provider: 'istanbul',
      // Only check specific directories for coverage
      include: [
        'components/**/*.{ts,tsx}',
        'features/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'contexts/**/*.{ts,tsx}',
        'actions/**/*.{ts,tsx}',
        'app/share/**/*.{ts,tsx}',
      ],
      exclude: [
        // Playwright / WebdriverIO E2E tests (not unit coverage)
        'e2e/**',
        'e2e-tauri/**',

        // Default exclusions
        'node_modules/**',
        '.next/**',
        'dist/**',
        'build/**',
        'offline-shell/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/test-utils/**',

        // Next.js app router (tested via E2E, except share pages which have unit tests)
        'app/api/**',
        'app/create-mentor/**',
        'app/error/**',
        'app/google-oauth-callback/**',
        'app/mobile/**',
        'app/mobile-sso-login/**',
        'app/platform/**',
        'app/provider-association/**',
        'app/sso-login/**',
        'app/sso-login-complete/**',
        'app/uploads/**',
        'app/version/**',

        // Config files
        'instrumentation.ts',
        'next.config.ts',
        'server-wrapper.js',
        'sentry.*.config.*',

        // Scripts and tooling
        'scripts/**',
        'entrypoint.sh',
        'src-tauri/**',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
