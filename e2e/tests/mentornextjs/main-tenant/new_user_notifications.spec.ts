import test, { BrowserContext, expect, Page } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../../utils';
import { checkAdminStatus } from '../utils';
import { openSidebar } from './helpers';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

test.describe('Newly Created User Test Suites', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    logger.info('BeforeEach: Starting sign-up flow');

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(-8);
    const email = `playwright+${timestamp}_${randomSuffix}@example.com`;
    const password = 'ibledu_2024';
    logger.info(`Generated test email: ${email}`);

    context = await browser.newContext({ storageState: undefined });
    page = await context.newPage();

    logger.info(`Navigating to ${MENTOR_NEXTJS_HOST}`);
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await safeWaitForURL(page, (url) =>
      url.href.startsWith(AUTH_HOST + '/login')
    );

    logger.info('✓ Redirected to login page');

    await expect(
      page.getByRole('heading', { name: 'Create Your Own Agent' })
    ).toBeVisible({ timeout: 120_000 });
    logger.info('✓ Landing page heading visible');

    const signUpBtn = page.getByRole('button', { name: 'Sign up' });
    await expect(signUpBtn).toBeVisible();
    await signUpBtn.click();
    logger.info('✓ Sign up button clicked');

    // expect we are redirected to the sign up page

    await safeWaitForURL(page, (url) =>
      url.href.startsWith(AUTH_HOST + '/account')
    );

    const signUpWithPassword = page.getByRole('button', {
      name: 'Continue with Password',
    });
    await expect(signUpWithPassword).toBeVisible();
    await signUpWithPassword.click();
    logger.info('✓ Continue with Password clicked');

    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill(password);
    await page.getByPlaceholder('Confirm Password').fill(password);
    logger.info('✓ Sign-up form filled');

    const createAccountBtn = page.getByRole('button', {
      name: /create account/i,
    });
    await expect(createAccountBtn).toBeVisible();
    await createAccountBtn.click();
    logger.info('✓ Create account button clicked');

    await safeWaitForURL(page, (url) => url.href.includes('/platform'), {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    expect(page.url()).toContain('main');
    logger.info(`✓ URL validated: ${page.url()}`);

    const adminStatus = await checkAdminStatus(page);
    expect(adminStatus).toBeFalsy();
    logger.info('✓ Admin status verified (student)');

    await expect(
      page.getByRole('heading', { name: 'Explore Mentors' })
    ).toBeVisible({ timeout: 120_000 });
    logger.info('wait for page to be full loaded');

    const newChatButton = page.getByRole('button', { name: 'New Chat' });
    await expect(newChatButton).toBeVisible({ timeout: 10000 });
    logger.info('✓ New Chat button visible');
    logger.info('BeforeEach: Sign-up flow completed successfully');
  });

  test.afterEach(async () => {
    if (context) {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      if (page && !page.isClosed()) {
        await page.waitForTimeout(500);
        await page.close();
      }
      try {
        await context.close();
        logger.info('✓ Context closed in afterEach');
      } catch (e) {
        logger.info(
          'Context close failed (may be Chromium crash), continuing...'
        );
      }
    }
  });

  test('Test Suite 1: Newly created user can see notifications from sidebar', async () => {
    logger.info('Test Suite 1: User can see notifications from sidebar');

    const sidebarDialog = await openSidebar(page);

    const notificationButton = sidebarDialog.getByRole('button', {
      name: /notification/i,
    });
    await expect(notificationButton).toBeVisible({ timeout: 10000 });
    await notificationButton.click();
    logger.info('✓ Notification button clicked');

    await safeWaitForURL(page, (url) =>
      url.pathname.includes('/notifications')
    );
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/platform\/[^/]+\/[^/]+\/notifications/);
    logger.info(`✓ URL verified: ${currentUrl}`);

    const noNotificationsText = page.getByText(/no notifications found/i);
    const hasNotifications = await page
      .getByRole('listitem')
      .or(page.locator('[data-testid*="notification"]'))
      .first()
      .isVisible()
      .catch(() => false);

    if (hasNotifications) {
      logger.info('✓ Notifications are visible');
    } else {
      await expect(noNotificationsText).toBeVisible({ timeout: 10000 });
      logger.info('✓ "No notifications found" text visible');
    }

    logger.info('✓ Test Suite 1 passed');
  });

  test('Test Suite 2: Newly created user can see notification from the navbar', async () => {
    logger.info('Test Suite 2: User can see notifications from navbar');

    const navbar = page.getByRole('navigation');
    const notificationButton = navbar.getByRole('button', {
      name: /notification/i,
    });
    await expect(notificationButton).toBeVisible({ timeout: 10000 });
    await notificationButton.click();
    logger.info('✓ Notification button clicked');

    const notificationMenu = page
      .getByRole('menu', { name: /notification/i })
      .or(page.getByRole('dialog'));
    await expect(notificationMenu).toBeVisible({ timeout: 5000 });
    logger.info('✓ Notification menu visible');

    await expect(
      notificationMenu.getByText('Notifications', { exact: true })
    ).toBeVisible();
    logger.info('✓ "Notifications" text visible');

    const viewAllButton = notificationMenu.getByRole('button', {
      name: /view all/i,
    });
    await expect(viewAllButton).toBeVisible();
    logger.info('✓ "View all" button visible');

    const hasNewNotifications = await notificationMenu
      .getByRole('listitem')
      .first()
      .isVisible()
      .catch(() => false);

    if (hasNewNotifications) {
      logger.info('✓ New notifications are visible');
    } else {
      await expect(
        notificationMenu.getByText(/no new notifications/i)
      ).toBeVisible({ timeout: 5000 });
      logger.info('✓ "No new notifications" text visible');
    }

    await viewAllButton.click();
    logger.info('✓ View all button clicked');

    await safeWaitForURL(page, (url) =>
      url.pathname.includes('/notifications')
    );
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/platform\/[^/]+\/[^/]+\/notifications/);
    logger.info(`✓ URL verified: ${currentUrl}`);

    logger.info('✓ Test Suite 2 passed');
  });
});
