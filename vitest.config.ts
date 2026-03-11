import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const rootNodeModules = new URL('./node_modules', import.meta.url).pathname;

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: [
      {
        find: '@tauri-apps/api/core',
        replacement: new URL('./__tests__/mocks/tauri-core.mock.ts', import.meta.url).pathname,
      },
      {
        find: '@tauri-apps/api/event',
        replacement: new URL('./__tests__/mocks/tauri-event.mock.ts', import.meta.url).pathname,
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
        replacement: new URL('./node_modules/next/navigation.js', import.meta.url).pathname,
      },
      // Mock Tauri APIs for testing
    ],
  },
  test: {
    globals: true,
    setupFiles: ['./__tests__/vitest.setup.ts'],
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
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
        // Default exclusions
        'node_modules/**',
        '.next/**',
        'dist/**',
        'build/**',
        'electron-dist/**',
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
        'middleware.ts',
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
