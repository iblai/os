import { Page, BrowserContext } from '@playwright/test';

import { MENTOR_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { test, expect } from '@iblai/iblai-js/playwright';

const safeNavigate = async (page: Page, url: string) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // await page.waitForLoadState('networkidle', { timeout: 30000 });

    const currentUrl = page.url();
    logger.info(`Current URL after navigation: ${currentUrl}`);

    if (
      currentUrl.includes('/platform/') &&
      currentUrl.endsWith('/ai-mentor')
    ) {
      logger.info('Successfully navigated to the AI mentor page');
    } else {
      logger.info(
        'Not on the expected AI mentor page, might require additional handling'
      );
    }
  } catch (error) {
    console.error('Navigation failed:', error);
  }
};

const browsers = ['chromium', 'firefox', 'webkit'] as const;

browsers.forEach((browserType) => {
  test.describe(`Mentor Dashboard - ${browserType}`, () => {
    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {});

    test.afterAll(async () => {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      if (page && !page.isClosed()) {
        await page.waitForTimeout(500);
        await page.close();
      }
      try {
        await context.close();
      } catch (e) {
        console.log(
          'Context close failed (may be Chromium crash), continuing...'
        );
      }
    });

    test.beforeEach(async ({ browser }) => {
      context = await browser.newContext();
      page = await context.newPage();
      test.setTimeout(60000); // 60 seconds timeout for each test case here
      // await safeNavigate(page, MENTOR_HOST);
      // await waitForNetworkIdle(page);

      const currentUrl = page.url();
      if (
        !currentUrl.includes('/platform/') ||
        !currentUrl.endsWith('/ai-mentor')
      ) {
        logger.info('Not on AI mentor page. Attempting to navigate...');
        await safeNavigate(
          page,
          `${MENTOR_HOST}/platform/ibltesting/ai-mentor`
        );
      }

      const historyContainers = page.locator('.history-container');
      const count = await historyContainers.count();

      logger.info(`Found ${count} .history-container element(s).`);
      if (count > 0) {
        logger.info('History container found. Proceeding with the test.');
      } else {
        logger.info(
          'No history container found. This might be expected in some cases.'
        );
      }
    });

    test('Input message, submit, and verify response', async () => {
      // Type the test message
      const testMessage = 'This is a test message';
      const textbox = page.getByPlaceholder('Enter a Prompt Here');
      console.log('################ textbox ', textbox);
      // await textbox.waitFor({ state: 'visible' });
      await textbox.fill(testMessage);

      await textbox.press('Enter');

      await expect(
        page.getByRole('link', { name: 'Stop Responding' })
      ).toBeVisible();

      // Wait for the submit button to be visible and clickable
      // const submitButton = page
      //   .getByLabel('user-prompt-label')
      //   .getByRole('img')
      //   .nth(2);
      // await submitButton.waitFor({ state: 'visible', timeout: 5000 });

      // // Click the submit button and wait for the network to be idle
      // await submitButton.click();
      // await page.waitForLoadState('networkidle');
      // logger.info('Submit button clicked post prompt');

      // Wait for the response
      const responseElement = await page
        .locator('.ai-response-container')
        .first();
      logger.info('####### Found the response');

      // Verify the response
      expect(responseElement).not.toBeNull();

      // Check if the input field is cleared after submission
      const inputValue = await page
        .getByRole('textbox', { name: 'Enter a Prompt Here' })
        .innerText();
      expect(inputValue).toBe('');

      // wait for the response to be visible
      await page
        .locator('.ai-response-container')
        .first()
        .waitFor({ state: 'visible' });
    });
  });
});
