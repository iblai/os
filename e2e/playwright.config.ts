import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

const root = path.resolve(__dirname, '.');
dotenv.config({ path: path.join(root, '.env.local'), override: true });
dotenv.config({ path: path.join(root, '.env') });

const testTimeout = process.env.TEST_TIMEOUT
  ? parseInt(process.env.TEST_TIMEOUT, 10)
  : process.env.CI
    ? 120_000
    : 120_000;

const testRetries = process.env.TEST_RETRIES
  ? parseInt(process.env.TEST_RETRIES, 10)
  : process.env.CI
    ? 2
    : 1;

const config = defineConfig({
  testDir: './journeys',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: testRetries,
  workers: process.env.CI ? 1 : 4,
  timeout: testTimeout,
  reporter: [
    ['html', { open: 'never' }],
    process.env.CI ? ['list', { printSteps: true }] : ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ...(process.env.PLAYWRIGHT_VIDEO ? [['./video-reporter.ts'] as const] : []),
  ],
  use: {
    baseURL: process.env.MENTOR_NEXTJS_HOST || 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // ── Admin auth setup: runs once per browser, saves storage state ──────────
    {
      name: 'setup-chrome',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-firefox',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    // Safari/WebKit disabled: Next.js chunks fail to load in Playwright's WebKit engine
    // causing ChunkLoadError timeouts. See: https://mentorai.iblai.org/_next/static/chunks/
    // Re-enable once the app's WebKit chunk-loading compatibility is resolved.
    {
      name: 'setup-safari',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'setup-edge',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Edge'] },
    },

    // ── Non-admin auth setup: runs once per browser ──────────────────────────
    {
      name: 'setup-nonadmin-chrome',
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-nonadmin-firefox',
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'setup-nonadmin-safari',
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'setup-nonadmin-edge',
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices['Desktop Edge'] },
    },

    // ── Test projects: each depends on admin + non-admin setup ───────────────
    {
      name: 'mentor-desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user-chrome.json',
      },
      dependencies: ['setup-chrome', 'setup-nonadmin-chrome'],
    },
    {
      name: 'mentor-desktop-firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user-firefox.json',
      },
      dependencies: ['setup-firefox', 'setup-nonadmin-firefox'],
    },
    {
      name: 'mentor-desktop-safari',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user-safari.json',
      },
      dependencies: ['setup-safari', 'setup-nonadmin-safari'],
    },
    {
      name: 'mentor-desktop-edge',
      use: {
        ...devices['Desktop Edge'],
        storageState: 'playwright/.auth/user-edge.json',
      },
      dependencies: ['setup-edge', 'setup-nonadmin-edge'],
    },
  ],
  webServer: process.env.MENTOR_NEXTJS_HOST
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

// Enable video recording when PLAYWRIGHT_VIDEO env var is set
if (process.env.PLAYWRIGHT_VIDEO && config.projects) {
  config.projects = config.projects.map((project) => {
    // Only add video to non-setup projects
    if (!project.name?.startsWith('setup')) {
      return {
        ...project,
        use: {
          ...project.use,
          video: 'on' as const,
        },
      };
    }
    return project;
  });
}

export default config;
