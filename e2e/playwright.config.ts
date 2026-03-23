import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

const root = path.resolve(__dirname, ".");
dotenv.config({ path: path.join(root, ".env.local"), override: true });
dotenv.config({ path: path.join(root, ".env") });

const testTimeout = process.env.TEST_TIMEOUT
  ? parseInt(process.env.TEST_TIMEOUT, 10)
  : process.env.CI
    ? 120_000
    : 60_000;

const testRetries = process.env.TEST_RETRIES
  ? parseInt(process.env.TEST_RETRIES, 10)
  : process.env.CI
    ? 2
    : 1;

export default defineConfig({
  testDir: "./journeys",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: testRetries,
  workers: process.env.CI ? 1 : undefined,
  timeout: testTimeout,
  reporter: [
    ["html", { open: "never" }],
    process.env.CI ? ["list", { printSteps: true }] : ["list"],
    ["json", { outputFile: "test-results.json" }],
  ],
  use: {
    baseURL: process.env.MENTOR_NEXTJS_HOST || "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
    screenshot: process.env.CI ? "only-on-failure" : "off",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // ── Admin auth setup: runs once per browser, saves storage state ──────────
    {
      name: "setup-chrome",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-firefox",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "setup-safari",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "setup-edge",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Edge"] },
    },

    // ── Non-admin auth setup: runs once per browser ──────────────────────────
    {
      name: "setup-nonadmin-chrome",
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-nonadmin-firefox",
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "setup-nonadmin-safari",
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "setup-nonadmin-edge",
      testMatch: /auth-nonadmin\.setup\.ts/,
      use: { ...devices["Desktop Edge"] },
    },

    // ── Test projects: each depends on admin + non-admin setup ───────────────
    {
      name: "mentor-desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user-chrome.json",
      },
      dependencies: ["setup-chrome", "setup-nonadmin-chrome"],
    },
    {
      name: "mentor-desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "playwright/.auth/user-firefox.json",
      },
      dependencies: ["setup-firefox", "setup-nonadmin-firefox"],
    },
    {
      name: "mentor-desktop-safari",
      use: {
        ...devices["Desktop Safari"],
        storageState: "playwright/.auth/user-safari.json",
      },
      dependencies: ["setup-safari", "setup-nonadmin-safari"],
    },
    {
      name: "mentor-desktop-edge",
      use: {
        ...devices["Desktop Edge"],
        storageState: "playwright/.auth/user-edge.json",
      },
      dependencies: ["setup-edge", "setup-nonadmin-edge"],
    },
  ],
  webServer: process.env.MENTOR_NEXTJS_HOST
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
