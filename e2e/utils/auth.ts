import { Page, Locator, expect } from '@playwright/test';
import { safeWaitForURL } from './navigation';
import { waitForPageReady } from './resilient';
import { logger } from '@iblai/iblai-js/playwright';

const MENTOR_NEXTJS_HOST = process.env.MENTOR_NEXTJS_HOST || '';
const AUTH_HOST = process.env.AUTH_HOST || '';
const TEST_EMAIL = process.env.PLAYWRIGHT_USERNAME || '';
const TEST_PASSWORD = process.env.PLAYWRIGHT_PASSWORD || '';

/**
 * Full login flow: navigate to the mentor app, handle auth redirect if needed,
 * and wait until the platform is ready and stable.
 */
export async function navigateToMentorApp(
  page: Page,
  url?: string,
  locator?: Locator,
): Promise<void> {
  const mentorAppUrl = url || MENTOR_NEXTJS_HOST;
  const startingUrl = url || MENTOR_NEXTJS_HOST + '/platform';

  await page.goto(mentorAppUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  // Wait for platform URL or auth redirect
  await safeWaitForURL(
    page,
    (u) =>
      u.href.startsWith(startingUrl) ||
      (!!AUTH_HOST && u.href.includes(AUTH_HOST)),
    { timeout: 120_000 },
  );

  // If redirected to auth, re-authenticate inline
  if (AUTH_HOST && page.url().includes(AUTH_HOST)) {
    await reAuthenticate(page, startingUrl);
  }

  if (!page.url().startsWith(startingUrl)) {
    await safeWaitForURL(
      page,
      (u) => u.href.startsWith(startingUrl),
      { timeout: 120_000 },
    );
  }

  // Caller-provided locator overrides default readiness check
  if (locator) {
    await expect(locator).toBeVisible({ timeout: 120_000 });
    return;
  }

  // Default readiness: wait for mentor dropdown to be visible
  await expect(
    page.getByRole('button', { name: 'Selected mentor dropdown button' }),
  ).toBeVisible({ timeout: 120_000 });
}

/**
 * Full login flow from scratch (navigates to initialUrl and logs in).
 */
export async function authenticate(
  page: Page,
  initialUrl: string = '/',
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
  navigateToAuthPage = true,
): Promise<void> {
  if (navigateToAuthPage) {
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: 'Continue with Password' }),
    ).toBeVisible({ timeout: 30_000 });
  }

  const currentUrl = page.url();

  if (AUTH_HOST && currentUrl.includes(AUTH_HOST)) {
    await page.click('button:has-text("Continue with Password")');
    await expect(page.locator('input[type="email"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Continue")');

    await safeWaitForURL(page, `${AUTH_HOST}/login/complete`, {
      timeout: 60_000,
    });
    logger.info('Waiting for SSO redirect...');
    await safeWaitForURL(page, '**/sso-login-complete?data=*', {
      timeout: 60_000,
    });
    logger.info('Waiting for platform redirect...');
    await safeWaitForURL(page, '**/platform/*/*', { timeout: 60_000 });
    await expect(
      page.getByRole('button', { name: 'Selected mentor dropdown button' }),
    ).toBeVisible({ timeout: 30_000 });
    logger.info('Authentication completed successfully');
  }
}

/**
 * Re-authenticate when tokens have expired mid-run.
 * Does not assert intermediate SSO redirect URLs.
 */
export async function reAuthenticate(
  page: Page,
  platformUrl: string,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
): Promise<void> {
  logger.info('[reAuthenticate] Tokens expired – re-authenticating…');
  await page.click('button:has-text("Continue with Password")');
  await expect(page.locator('input[type="email"]')).toBeVisible({
    timeout: 10_000,
  });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Continue")');
  await safeWaitForURL(page, (u) => u.href.startsWith(platformUrl), {
    timeout: 80_000,
  });
  logger.info('[reAuthenticate] Re-authentication completed');
}

/**
 * Returns true if the currently authenticated user is an admin,
 * by inspecting the current_tenant key in localStorage.
 */
export async function checkAdminStatus(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => window.localStorage.getItem('current_tenant') !== null,
      { timeout: 10_000 },
    );
    return await page.evaluate(() => {
      const raw = window.localStorage.getItem('current_tenant');
      if (!raw) return false;
      try {
        return JSON.parse(raw).is_admin === true;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Waits for the platform to be fully loaded and returns the
 * current tenantKey and mentorId from the URL.
 */
export async function getPlatformContext(
  page: Page,
): Promise<{ tenantKey: string; mentorId: string }> {
  await waitForPageReady(page);
  const url = page.url();
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  if (parts[0] !== 'platform' || parts.length < 3) {
    throw new Error(`Not on a platform URL: ${url}`);
  }
  return { tenantKey: parts[1], mentorId: parts[2] };
}
