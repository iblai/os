import { test as setup, expect } from "@playwright/test";
import { safeWaitForURL } from "../utils/navigation";
import path from "path";
import fs from "fs";

const HOST = process.env.MENTOR_NEXTJS_HOST || "";
const AUTH_HOST = process.env.AUTH_HOST || "";
const USERNAME = process.env.PLAYWRIGHT_NONADMIN_USERNAME || "";
const PASSWORD = process.env.PLAYWRIGHT_NONADMIN_PASSWORD || "";

setup.setTimeout(200_000);

setup("authenticate non-admin", async ({ page }, testInfo) => {
  const browserKey = testInfo.project.name
    .replace("setup-nonadmin-", "")
    .toLowerCase();
  // Save to mentorai/playwright/.auth/ — two levels up from e2e/journeys/
  const authFile = path.join(
    __dirname,
    `../../playwright/.auth/nonadmin-${browserKey}.json`,
  );
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // ── Step 1: Navigate to the app ──────────────────────────────────────────
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Step 1: Navigating to ${HOST}`,
  );
  await page.goto(HOST, { waitUntil: "domcontentloaded", timeout: 60_000 });
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] After goto — URL: ${page.url()}`,
  );

  // ── Step 2: Wait for auth host ────────────────────────────────────────────
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Step 2: Waiting for AUTH_HOST (${AUTH_HOST}) in URL`,
  );
  await safeWaitForURL(page, (url) => url.href.includes(AUTH_HOST), {
    timeout: 60_000,
  });
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Reached auth host — URL: ${page.url()}`,
  );

  // ── Step 3: Click "Continue with Password" ────────────────────────────────
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Step 3: Clicking "Continue with Password"`,
  );
  await expect(
    page.getByRole("button", { name: "Continue with Password" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.click('button:has-text("Continue with Password")');
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] After click — URL: ${page.url()}`,
  );

  // ── Step 4: Fill credentials ──────────────────────────────────────────────
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Step 4: Filling credentials for ${USERNAME}`,
  );
  await expect(page.locator('input[type="email"]')).toBeVisible({
    timeout: 10_000,
  });
  await page.fill('input[type="email"]', USERNAME);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Continue")');
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Credentials submitted — URL: ${page.url()}`,
  );

  // ── Step 5: Poll URL every 10s to trace the full redirect chain ───────────
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Step 5: Polling URL (80s) waiting for ${HOST}/platform`,
  );
  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline) {
    const current = page.url();
    console.log(`[auth-nonadmin.setup] [${browserKey}] URL: ${current}`);
    if (current.startsWith(HOST + "/platform")) {
      console.log(
        `[auth-nonadmin.setup] [${browserKey}] Reached /platform — stopping poll`,
      );
      break;
    }
    await page.waitForTimeout(10_000);
  }

  const finalUrl = page.url();
  console.log(`[auth-nonadmin.setup] [${browserKey}] Final URL: ${finalUrl}`);

  // ── Step 6: Hard wait for /platform ───────────────────────────────────────
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Step 6: safeWaitForURL → /platform`,
  );
  await safeWaitForURL(page, (url) => url.href.startsWith(HOST + "/platform"), {
    timeout: 80_000,
  });
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] On platform — URL: ${page.url()}`,
  );

  // ── Step 7: Verify tokens ─────────────────────────────────────────────────
  const dmToken = await page.evaluate(() => localStorage.getItem("dm_token"));
  const axdToken = await page.evaluate(() => localStorage.getItem("axd_token"));
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] dm_token:  ${dmToken ? "present" : "NULL"}`,
  );
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] axd_token: ${axdToken ? "present" : "NULL"}`,
  );
  expect(dmToken).not.toBeNull();

  // ── Step 8: Save storage state ────────────────────────────────────────────
  await page.context().storageState({ path: authFile });
  console.log(
    `[auth-nonadmin.setup] [${browserKey}] Storage state saved → ${authFile}`,
  );
});
