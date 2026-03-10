import test, { BrowserContext, expect, Page } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { checkAdminStatus } from '../utils';
import {
  verifyStripeDialog,
  openMoreOptionsMenu,
  openSidebar,
} from './helpers';
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
    await page.goto(MENTOR_NEXTJS_HOST);
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

  test('Test Suite 1: Newly created user should be able to click on the select dropdown menu', async () => {
    logger.info('Test Suite 1: User can click select dropdown menu');

    const dropdownButton = page.getByRole('button', {
      name: /selected mentor dropdown button/i,
    });
    await expect(dropdownButton).toBeVisible({ timeout: 10000 });
    await dropdownButton.click();
    logger.info('✓ Dropdown button clicked');

    const newChatMenuItem = page.getByRole('menuitem', { name: 'New chat' });
    await expect(newChatMenuItem).toBeVisible();
    logger.info('✓ New chat menu item visible');

    const menuItemCount = await page.getByRole('menuitem').count();
    expect(menuItemCount).toBeLessThanOrEqual(2);

    logger.info('✓ Test Suite 1 passed');
  });

  test('Test Suite 2: Newly created user should see correct UI elements (disabled features)', async () => {
    logger.info('Test Suite 2: User sees correct UI elements');

    await expect(page.getByRole('button', { name: 'New Chat' })).toBeVisible();
    logger.info('✓ New Chat button visible');

    await expect(
      page.getByRole('button', { name: 'My Mentors' })
    ).toBeVisible();
    logger.info('✓ My Mentors button visible');

    const toggle = page.getByRole('switch', { name: /learner mode/i });
    await expect(toggle).not.toBeVisible();
    logger.info(
      '✓ Learner/instructor toggle not visible (as expected for non-admin)'
    );

    logger.info('✓ Test Suite 2 passed');
  });

  test('Test Suite 3: Newly created user can see the various options on the profile dropdown', async () => {
    logger.info('Test Suite 3: User can see profile dropdown options');

    const menuModal = await openMoreOptionsMenu(page);

    await expect(
      menuModal.getByRole('menuitem', { name: /profile/i })
    ).toBeVisible();
    logger.info('✓ Profile item visible');

    await expect(
      menuModal.getByRole('menuitem', { name: /help/i })
    ).toBeVisible();
    logger.info('✓ Help item visible');

    await expect(
      menuModal.getByRole('menuitem', { name: /log out/i })
    ).toBeVisible();
    logger.info('✓ Logout item visible');

    const menuItemCount = await menuModal.getByRole('menuitem').count();
    expect(menuItemCount).toBe(3);
    logger.info('✓ Only 3 menu items visible (Profile, Help, Logout)');

    logger.info('✓ Test Suite 3 passed');
  });

  test('Test Suite 4: Newly created user should see correct elements in the sidebar', async () => {
    logger.info('Test Suite 4: User sees correct sidebar elements');
    const sidebar = await openSidebar(page);
    const sidebarButtons = [
      { name: /settings/i, role: 'button' },
      { name: /analytics/i, role: 'button' },
      { name: /new project/i, role: 'button' },
      { name: /invite users/i, role: 'button' },
      { name: /new mentor/i, role: 'button' },
    ];
    for (const buttonConfig of sidebarButtons) {
      const button = sidebar.getByRole(buttonConfig.role as any, {
        name: buttonConfig.name,
      });
      await expect(button).toBeVisible({ timeout: 10000 });
      logger.info(`✓ ${buttonConfig.name} button visible`);
      await button.click();
      logger.info(`✓ ${buttonConfig.name} button clicked`);
      await verifyStripeDialog(page);
    }
    logger.info('✓ Test Suite 4 passed');
  });
});
