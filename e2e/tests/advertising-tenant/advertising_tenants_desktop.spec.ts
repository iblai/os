import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import {
  configureMentorSettings,
  enablePublicRegistration,
  ensureSidebarOpen,
  performLogin,
  switchToAdvertisingTenant,
  verifyAdminStatus,
  verifyAdvancedFeaturesPromo,
  verifyVisibleButtons,
} from './helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

const password: string = process.env.PLAYWRIGHT_PASSWORD || '';
const username: string = process.env.PLAYWRIGHT_USERNAME || '';

test.describe('Advertising Tenant Tests', () => {
  let mentorUrl = '';
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes(AUTH_HOST)) {
      await performLogin(page);
      await verifyAdminStatus(page);
    } else {
      await safeWaitForURL(
        page,
        (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
        { timeout: 60000 }
      );
    }

    await switchToAdvertisingTenant(page);
    await enablePublicRegistration(page);
    await configureMentorSettings(page);

    mentorUrl = page.url();
    logger.info(`Mentor URL captured: ${mentorUrl}`);

    // Wait for stability, close page first, then close context with error handling
    // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
    await page.waitForTimeout(500);
    await page.close();
    try {
      await context.close();
    } catch (e) {
      logger.info(
        'Context close failed (may be Chromium crash), continuing...'
      );
    }
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test.describe('Test Suite 1: user can access this mentor', () => {
    test('User can access mentor without login', async ({ browser }) => {
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();

      expect(mentorUrl).toBeTruthy();
      await page.goto(mentorUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 80000,
      });

      // Wait for page to be ready by checking for a visible button
      await expect(page.getByRole('button', { name: /Log in/i })).toBeVisible({
        timeout: 60_000,
      });

      await verifyVisibleButtons(page, [
        { name: /Log in/i },
        { name: /Sign up for free/i },
        { name: /Invite user/i },
        { name: /New mentor/i },
        { name: 'Mentors', exact: true },
        { name: /New chat/i },
        { name: /Notifications/i },
        { name: /Analytics/i },
        { name: /Settings/i },
      ]);

      await ensureSidebarOpen(page);
      await verifyAdvancedFeaturesPromo(page);

      await page?.close();
      await context?.close();
    });
  });

  // awaiting fix for this test suite : when the user is created theres an invalid uuid error thats pops up due to session id issue

  // test.describe('Test Suite 2: user can login to this mentor', () => {
  //   test.use({ storageState: undefined });

  //   test.skip('User can login to mentor', async ({ browser }) => {
  //     const context = await browser.newContext({ storageState: undefined });
  //     const page = await context.newPage();

  //     expect(mentorUrl).toBeTruthy();
  //     await page.goto(mentorUrl, {
  //       waitUntil: 'networkidle',
  //       timeout: 60000,
  //     });
  //     await waitForPageReady(page);

  //     await clickButton(page, /Log in/i);
  //     await page.waitForURL((url) => url.href.includes('/login'), {
  //       timeout: 60000,
  //     });

  //     await verifyLoginPage(page);
  //     await navigateToSignUp(page);
  //     await createNewAccount(page);

  //     await page.waitForURL(
  //       (url) => /\/platform\/[^/]+\/[^/]+$/.test(url.href),
  //       { timeout: 60000 }
  //     );
  //     await waitForPageReady(page);

  //     const isAdmin = await checkAdminStatus(page);
  //     expect(isAdmin).toBe(false);

  //     await sendMessageAndVerifyResponse(page, 'hello');
  //   });
  // });
});
