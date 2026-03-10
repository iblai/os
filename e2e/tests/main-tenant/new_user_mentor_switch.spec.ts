import test, { BrowserContext, expect, Page } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { checkAdminStatus } from '../utils';
import {
  waitForMentorResponse,
  selectRandomMentorFromMyMentors,
  sendMessage,
  openMyMentorsDialog,
  verifyMentorSwitch,
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
    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(AUTH_HOST + '/login'),
      {
        timeout: 60000,
      }
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

    await safeWaitForURL(
      page,
      (url) => url.href.startsWith(AUTH_HOST + '/account'),
      {
        timeout: 60000,
      }
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
      timeout: 120000,
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

  test('Test Suite 1: Newly created user should be able to switch mentor via Explore Mentors', async () => {
    // get current mentor name
    const currentMentorName = (await page.locator('h1').innerText()).trim();
    await expect(currentMentorName).toBeTruthy();
    logger.info(`Current mentor: ${currentMentorName.trim()}`);

    logger.info('Test Suite 15: User can switch mentor via Explore Mentors');
    const mentors = page.getByRole('button', { name: 'Mentors', exact: true });
    await expect(mentors).toBeVisible({ timeout: 10000 });
    await mentors.click();
    // Wait for the Explore Mentors page to load
    await safeWaitForURL(page, (url) => url.pathname.includes('/explore'), {
      timeout: 60000,
    });

    // Wait for mentor card list to be visible - indicates page is ready
    const mentorCardList = page.getByTestId('all-mentors-card-list');
    await expect(mentorCardList.first()).toBeVisible({ timeout: 60_000 });

    logger.info('✓ Mentor cards visible');
    const numberOfMentorCard = mentorCardList.getByRole('listitem');
    const count = await numberOfMentorCard.count();

    let switched = false;

    for (let i = 0; i < count; i++) {
      const mentor = numberOfMentorCard.nth(i);
      const name = (await mentor.locator('h3').innerText()).trim();

      if (name !== currentMentorName) {
        await mentor.click();
        await verifyMentorSwitch(page, name.trim());
        switched = true;
        break;
      }
    }

    expect(switched).toBeTruthy();

    logger.info('✓ Test Suite 1 passed');
  });

  test.describe('Test Suite 2: Newly created user can switch mentor', () => {
    test.skip(
      // test behaves differently on safari
      //when a user sends a message the users message div isnt seen but works fine on other browser
      // this happens on the CI and works fine locally
      // added waitfor page ready to ensure the page is fully loaded before interacting with the elements on the page and also increased time out for the user message to be visible
      //But the user div inst still visible thats why this test has been skipped for safari
      ({ browserName }) => browserName === 'webkit',
      'Skipped on Safari'
    );

    test('Test Suite 2: Newly created user can switch mentor and continue chatting', async ({}) => {
      logger.info('Test Suite 2: User can switch mentor and continue chatting');

      await sendMessage(page, 'hello');
      await waitForMentorResponse(page);

      logger.info('✓ Mentor responded');

      // explicitly wait for 10 seconds before switching mentors
      await page.waitForTimeout(10_000);

      await openMyMentorsDialog(page);
      const selectedMentorName = await selectRandomMentorFromMyMentors(page);
      logger.info(`Selected mentor: ${selectedMentorName}`);

      await verifyMentorSwitch(page, selectedMentorName);

      await sendMessage(page, 'hello again');
      await waitForMentorResponse(page);

      logger.info('✓ Test Suite 2 passed');
    });
  });

  test('Test Suite 3: Newly created user should be able to switch mentor via My Mentors dialog', async () => {
    logger.info('Test Suite 3: User can switch mentor via My Mentors dialog');

    await openMyMentorsDialog(page);
    const selectedMentorName = await selectRandomMentorFromMyMentors(page);
    logger.info(`Selected mentor: ${selectedMentorName}`);

    await verifyMentorSwitch(page, selectedMentorName);

    logger.info('✓ Test Suite 3 passed');
  });
});
