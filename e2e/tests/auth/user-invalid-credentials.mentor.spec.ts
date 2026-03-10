import { expect } from '@playwright/test';

import { AUTH_HOST, MENTOR_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { retry, test, safeWaitForURL } from '@iblai/iblai-js/playwright';
import { authRequiresMagicLink } from './helper';

const username: string = process.env.PLAYWRIGHT_USERNAME || '';

const HOST = MENTOR_HOST;

test('user can not log in with invalid credentials', async ({
  browser,
  step,
}) => {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
  });
  test.setTimeout(60000); // 60 seconds
  const page = await context.newPage();
  // Log network responses

  page.on('request', (request) => {
    logger.info(`>> Request: ${request.method()}, ${request.url()}`);
  });
  page.on('response', (response) => {
    logger.info(`<< Response: ${response.status()}, ${response.url()}`);
  });

  await page.goto(HOST);

  await safeWaitForURL(page, (url) =>
    url.href.includes(`/login?app=mentor&redirect-to=${MENTOR_HOST}`)
  );

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 });
  } catch (error) {
    logger.error(`############# Networkidle timeout for auth page`);
  }

  if (await authRequiresMagicLink(page)) {
    logger.info('Magic link required');
    return;
  }

  logger.info('Checking for email input field');
  const emailInput = page.locator('input[placeholder="Email or Username"]');
  await emailInput.waitFor({ state: 'visible' });

  await step('Input username or email', async () => {
    await emailInput.fill(username);
  });
  logger.info('Email input field ', await emailInput.innerHTML());

  const continueButton = page.locator('.auth-submit-btn');
  await continueButton.waitFor({ state: 'visible' });
  await continueButton.click();

  logger.info('Checking for password input field');
  const passwordInput = page.locator('input[placeholder="Password"]');

  retry(
    async () =>
      await passwordInput.waitFor({ state: 'visible', timeout: 5000 }),
    'Failed to log out',
    5
  );
  logger.info('Password input visible');
  await step('Input password', async () => {
    retry(
      async () =>
        await passwordInput.fill('test-wrong-password', { timeout: 5000 }),
      'Failed to log out',
      5000
    );
  });

  logger.info('Password input field ', await passwordInput.innerHTML());
  await page.waitForTimeout(5000);

  await step('Clicking continue button to login', async () => {
    await continueButton.click();
  });

  await step('verify credentials incorrect is visible', async () => {
    await expect(page.getByText('Credentials incorrect')).toBeVisible();
  });
});
