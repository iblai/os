import { test as setup, expect } from '@playwright/test';
import { safeWaitForURL } from '../utils/navigation';
import path from 'path';
import fs from 'fs';

const HOST = process.env.MENTOR_NEXTJS_HOST || '';
const AUTH_HOST = process.env.AUTH_HOST || '';
const USERNAME = process.env.PLAYWRIGHT_USERNAME || '';
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD || '';

setup('authenticate', async ({ page }, testInfo) => {
  setup.setTimeout(200_000);
  const browserKey = testInfo.project.name.replace('setup-', '').toLowerCase();
  // Save to mentorai/playwright/.auth/ — two levels up from e2e/journeys/
  // This matches where pnpm test:e2e pre-creates the stubs and where
  // storageState: 'playwright/.auth/...' in playwright.config.ts resolves
  // when Playwright is invoked from the mentorai/ root (CWD-relative resolution).
  const authFile = path.join(
    __dirname,
    `../../playwright/.auth/user-${browserKey}.json`,
  );
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // ── Step 0: Intercept request-jwt ────────────────────────────────────────
  // web-utils 1.2.5 calls POST /ibl-auth/request-jwt/ synchronously on mount.
  // If the Open edX session cookie is absent, it 401s and AuthProvider
  // immediately redirects away from the app — before we can save storage state.
  // Strategy: pass through if the real request succeeds; otherwise return a
  // stub JWT with no user_id so validateJwtToken skips the mismatch guard.
  await page.route('**/ibl-auth/request-jwt/**', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    try {
      const response = await route.fetch();
      if (response.ok()) {
        console.log(
          `[auth.setup] [${browserKey}] request-jwt: real token received`,
        );
        return route.fulfill({ response });
      }
      console.log(
        `[auth.setup] [${browserKey}] request-jwt: status ${response.status()} → returning stub JWT`,
      );
    } catch (err) {
      console.log(
        `[auth.setup] [${browserKey}] request-jwt: fetch error → returning stub JWT`,
      );
    }
    // Build a minimal JWT with no user_id.
    // validateJwtToken only fails the mismatch check when decodedToken.user_id
    // is truthy, so omitting it causes validateJwtToken to return true.
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const stubPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    const stubJwt = `${header}.${stubPayload}.stub`;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: stubJwt }),
    });
  });

  // ── Step 1: Navigate to the app ──────────────────────────────────────────
  console.log(`[auth.setup] [${browserKey}] Step 1: Navigating to ${HOST}`);
  await page.goto(HOST, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  console.log(`[auth.setup] [${browserKey}] After goto — URL: ${page.url()}`);

  // ── Step 2: Wait for auth host ────────────────────────────────────────────
  console.log(
    `[auth.setup] [${browserKey}] Step 2: Waiting for AUTH_HOST (${AUTH_HOST}) in URL`,
  );
  await safeWaitForURL(page, (url) => url.href.includes(AUTH_HOST), {
    timeout: 120_000,
  });
  console.log(
    `[auth.setup] [${browserKey}] Reached auth host — URL: ${page.url()}`,
  );

  // ── Step 3: Click "Continue with Password" ────────────────────────────────
  console.log(
    `[auth.setup] [${browserKey}] Step 3: Clicking "Continue with Password"`,
  );
  await expect(
    page.getByRole('button', { name: 'Continue with Password' }),
  ).toBeVisible({ timeout: 30_000 });
  await page.click('button:has-text("Continue with Password")');
  console.log(`[auth.setup] [${browserKey}] After click — URL: ${page.url()}`);

  // ── Step 4: Fill credentials ──────────────────────────────────────────────
  console.log(
    `[auth.setup] [${browserKey}] Step 4: Filling credentials for ${USERNAME}`,
  );
  await expect(page.locator('input[type="email"]')).toBeVisible({
    timeout: 10_000,
  });
  await page.fill('input[type="email"]', USERNAME);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Continue")');
  console.log(
    `[auth.setup] [${browserKey}] Credentials submitted — URL: ${page.url()}`,
  );

  // ── Step 5: Poll URL every 2s to trace the full redirect chain ────────────
  console.log(
    `[auth.setup] [${browserKey}] Step 5: Polling URL (80s) waiting for ${HOST}/platform`,
  );
  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline) {
    const current = page.url();
    console.log(`[auth.setup] [${browserKey}] URL: ${current}`);
    if (current.startsWith(HOST + '/platform')) {
      console.log(
        `[auth.setup] [${browserKey}] Reached /platform — stopping poll`,
      );
      break;
    }
    await page.waitForTimeout(10_000);
  }

  const finalUrl = page.url();
  console.log(`[auth.setup] [${browserKey}] Final URL: ${finalUrl}`);

  // ── Step 6: Hard wait for /platform (also catches if poll timed out) ──────
  console.log(
    `[auth.setup] [${browserKey}] Step 6: safeWaitForURL → /platform`,
  );
  await safeWaitForURL(page, (url) => url.href.startsWith(HOST + '/platform'), {
    timeout: 80_000,
  });
  console.log(`[auth.setup] [${browserKey}] On platform — URL: ${page.url()}`);

  // ── Step 7: Verify tokens ─────────────────────────────────────────────────
  const dmToken = await page.evaluate(() => localStorage.getItem('dm_token'));
  const axdToken = await page.evaluate(() => localStorage.getItem('axd_token'));
  console.log(
    `[auth.setup] [${browserKey}] dm_token:  ${dmToken ? 'present' : 'NULL'}`,
  );
  console.log(
    `[auth.setup] [${browserKey}] axd_token: ${axdToken ? 'present' : 'NULL'}`,
  );
  expect(dmToken).not.toBeNull();

  // ── Step 7b: Wait for edx_jwt_token (set async by AuthProvider) ───────────
  // web-utils 1.2.5 validateJwtToken() requires edx_jwt_token in localStorage.
  // AuthProvider calls refreshJwtToken() → POST /ibl-auth/request-jwt/ to get it.
  // We must wait for it before saving storage state, otherwise tests redirect to auth.
  console.log(
    `[auth.setup] [${browserKey}] Step 7b: Waiting up to 30s for edx_jwt_token…`,
  );
  try {
    await page.waitForFunction(
      () => localStorage.getItem('edx_jwt_token') !== null,
      { timeout: 30_000 },
    );
    console.log(`[auth.setup] [${browserKey}] edx_jwt_token: present`);

    // Log user_id from token vs userData to detect mismatches
    const tokenInfo = await page.evaluate(() => {
      try {
        const token = localStorage.getItem('edx_jwt_token') ?? '';
        const userData = localStorage.getItem('userData');
        const payload = JSON.parse(atob(token.split('.')[1]));
        const user = userData ? JSON.parse(userData) : null;
        return {
          tokenUserId: payload.user_id ?? null,
          dataUserId: user?.user_id ?? null,
        };
      } catch {
        return null;
      }
    });
    if (tokenInfo) {
      const match =
        String(tokenInfo.tokenUserId) === String(tokenInfo.dataUserId);
      console.log(
        `[auth.setup] [${browserKey}] edx_jwt_token.user_id=${tokenInfo.tokenUserId}  userData.user_id=${tokenInfo.dataUserId}  match=${match}`,
      );
      if (!match) {
        console.warn(
          `[auth.setup] [${browserKey}] ⚠ user_id MISMATCH — validateJwtToken will fail and trigger request-jwt on each page load`,
        );
      }
    }
  } catch {
    const edxToken = await page.evaluate(() =>
      localStorage.getItem('edx_jwt_token'),
    );
    console.warn(
      `[auth.setup] [${browserKey}] edx_jwt_token: ${edxToken ? 'present' : 'NULL — timed out (request-jwt may have failed or not yet called)'}`,
    );
  }

  // ── Step 8: Save storage state ────────────────────────────────────────────
  await page.context().storageState({ path: authFile });
  console.log(`[auth.setup] [${browserKey}] Storage state saved → ${authFile}`);
});
