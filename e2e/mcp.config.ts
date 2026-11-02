import { defineConfig, devices } from '@playwright/test';

// Config for the `playwright-test` MCP server only (see .mcp.json), which lets
// an agent drive a real browser. Unlike the e2e suite, that browser can be sent
// to pages we do not control (a link in an issue, a search result), so the
// Chromium sandbox — which Playwright leaves off by default — is forced on here
// everywhere. It runs on developer machines, not the root CI container, so the
// sandbox initializes normally.
//
// Deliberately minimal: no webServer, no auth setup, no global teardown, so the
// server starts a plain browser without booting the app or running the suite.
export default defineConfig({
  testDir: './.mcp-scratch',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { chromiumSandbox: true },
      },
    },
  ],
});
