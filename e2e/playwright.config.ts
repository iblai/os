import { createPlaywrightConfig } from "@iblai/iblai-js/playwright";
import { type PlaywrightTestConfig } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: path.resolve(__dirname, envFile) });

const testTimeout = process.env.TEST_TIMEOUT
  ? parseInt(process.env.TEST_TIMEOUT, 10)
  : process.env.CI
    ? 120_000
    : 60_000;

const base = createPlaywrightConfig({
  testDir: ".",
  platforms: [
    { name: "auth", dependencies: [], otherTestMatch: ["**auth/*/*.spec.ts"] },
    {
      name: "mentor",
      dependencies: ["setup"],
      otherTestMatch: ["tests/!(auth)/**/*.spec.ts", "*.common.spec.ts"],
    },
  ],
  extraProjects: [
    {
      name: "mentor-cleanup",
      dependencies: ["mentor"],
      testMatch: ["**cleanup.mentornextjs.cleanup.ts"],
    },
    {
      name: "mentor-public-views",
      dependencies: ["mentor"],
      testMatch: ["**mentor-viewable-by-anyone.spec.ts"],
    },
  ],
});

const config: PlaywrightTestConfig = {
  ...base,
  timeout: testTimeout,
  reporter: process.env.CI
    ? base.reporter
    : [
        ["list"],
        ["./custom-reporter.ts"],
        ["html", { outputFolder: "playwright-report", open: "on-failure" }],
      ],
};

export default config;
