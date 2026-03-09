import path from 'path';
import fs from 'fs/promises';

import { Page } from '@playwright/test';

import { AUTH_HOST, MENTOR_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { test, expect } from '@iblai/iblai-js/playwright';
import { loginWithEmailAndPassword } from '../helpers';
import { MailsacClient } from '@iblai/iblai-js/playwright';
import { authRequiresMagicLink } from '../auth/helper';

const password: string = process.env.PLAYWRIGHT_PASSWORD || '';
const username: string = process.env.PLAYWRIGHT_USERNAME || '';

const safeNavigate = async (page: Page, url: string) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

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

test('test an embed must be used by a known user', async ({
  context,
  page,
  step,
}) => {
  test.setTimeout(120000); // set timeout to 120 seconds

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  logger.info('Navigating to AI mentor page');

  const currentUrl = page.url();
  if (
    !currentUrl.includes('/platform/') ||
    !currentUrl.endsWith('/ai-mentor')
  ) {
    logger.info('Not on AI mentor page. Attempting to navigate...');
    await safeNavigate(page, `${MENTOR_HOST}/platform/ibltesting/ai-mentor`);
  }

  await expect(page.getByRole('heading', { name: 'Instructor' })).toBeVisible();

  const checkbox = page.getByAltText('Presentation icon');
  await checkbox.isChecked();

  logger.info('Clicking on the settings dropdown');
  await page.locator('.header-settings-dropdown > .header-action-btn').click();
  await expect(page.getByText('Create Mentor')).toBeVisible();

  logger.info('loading mentors');
  await page.getByTestId('tail-spin-svg').waitFor();

  logger.info('Confirm mentors have loaded');
  await expect(page.getByTestId('tail-spin-svg')).not.toBeVisible({
    timeout: 60000,
  });

  const mentorElements = page.locator(
    '.table-body-row .table-block-big .table-text'
  );
  const count = await mentorElements.count();

  expect(count).toBeGreaterThan(0);

  const firstMentorLink = page
    .locator('.table-body-row')
    .first()
    .locator('.table-text-link');
  await expect(firstMentorLink).toBeEnabled();

  await firstMentorLink.click();

  await expect(page.getByText('Edit Mentor', { exact: true })).toBeVisible();

  await expect(page.getByRole('tab', { name: 'Embed' })).toBeVisible();

  await page.getByRole('tab', { name: 'Embed' }).click();

  const checkboxSelector = page
    .locator('div:nth-child(2) > .user-switcher > .user-switcher-slider')
    .first();

  await expect(checkboxSelector).toBeVisible();

  if (await checkboxSelector.isChecked()) {
    logger.info(
      'check the checkbox to make allow the embed be used anonymously'
    );
    await checkboxSelector.click();
  }

  await expect(checkboxSelector).not.toBeChecked();

  const contextAwareness = page.locator(
    'div:nth-child(9) > .w-layout-vflex > div > .user-row-switcher-embed > .user-switcher > .user-switcher-slider'
  );

  logger.info('Make sure the embed is not context aware');
  await expect(contextAwareness).toBeVisible();

  if (await contextAwareness.isChecked()) {
    await contextAwareness.click();
  }

  await expect(contextAwareness).not.toBeChecked();

  const websiteUrl = 'http://127.0.0.1:5500/assets/embed/index.html';

  await page.getByRole('textbox', { name: 'https://ibl.ai' }).fill(websiteUrl);

  logger.info('Clicking on the Generate Embed button');
  await page.getByRole('link', { name: 'Embed Now' }).click();

  logger.info('Wait for the embed code to show');
  await expect(page.getByRole('link', { name: 'Embed Now' })).toBeVisible();

  logger.info('wait for network to be idle');
  await page.waitForLoadState('networkidle', { timeout: 60000 });

  await page.getByRole('heading', { name: 'Embed Mentor' }).waitFor();

  logger.info('Copy the embed code');
  await page.getByText('Copy Script', { exact: true }).click();

  logger.info('Embed code copied to clipboard');
  await page.getByText('Copied to clipboard', { exact: true }).waitFor();

  const clipboardContent = await page.evaluate(() => {
    return navigator.clipboard.readText();
  });

  logger.info('Write embed code to file');

  const htmlFile = path.join(__dirname, '../../assets/embed/index.html');

  await fs.writeFile(htmlFile, '');
  await fs.writeFile(htmlFile, clipboardContent);

  await page.goto(websiteUrl);

  logger.info('wait for page to load');
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });

  await page.waitForURL((url) => url.href.includes(AUTH_HOST));

  logger.info('wait to be redirected to the auth page');
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

  if (await authRequiresMagicLink(page)) {
    logger.info('Magic link required for authentication');

    logger.info('Fill the email address field');
    await page.getByPlaceholder('Email').click();
    await page.getByPlaceholder('Email').fill('ibltestuser@mailsac.com');

    logger.info('Click the Continue button');
    await page.getByLabel('Continue').click();

    await page.getByText(/Enter it below/i).waitFor({ timeout: 5000 });

    logger.info('Check for the magic link email');
    await page.waitForTimeout(5000);

    const apiKey = 'k_GZgb33koIUEPRRqciDzn6c21bZnNBit0GBQaV0a905hwwc832';
    const mailsac = new MailsacClient(apiKey);
    const emailInbox = 'ibltestuser';

    const emails = await mailsac.getEmails(emailInbox);

    const magicLinkEmail = emails.find(
      (e) => e.subject === 'Verify your email to sign in for ibl'
    );

    if (!magicLinkEmail) {
      throw new Error('Magic link email not found');
    }

    const emailContent = await mailsac.getEmailById(
      emailInbox,
      magicLinkEmail._id
    );

    const matches = emailContent.match(/\b\d{6}\b/);
    const signInCode = matches ? matches[0] : '';

    await page.keyboard.press(signInCode[0]);
    await page.keyboard.press(signInCode[1]);
    await page.keyboard.press(signInCode[2]);
    await page.keyboard.press(signInCode[3]);
    await page.keyboard.press(signInCode[4]);
    await page.keyboard.press(signInCode[5]);
  } else {
    await loginWithEmailAndPassword(
      page,
      step,
      username,
      password,
      websiteUrl,
      AUTH_HOST
    );
  }

  await page.waitForURL((url) => url.href.includes(websiteUrl));

  await page.waitForTimeout(10000);

  logger.info('open the mentor chat widget');
  await page.getByRole('img').click();

  const stopResponding = page
    .locator('iframe')
    .contentFrame()
    .getByRole('link', { name: 'Stop Responding' });

  logger.info('Check if the stop responding button is visible');
  await expect(stopResponding).not.toBeVisible({ timeout: 15000 });

  const chatInput = page
    .locator('iframe')
    .contentFrame()
    .getByPlaceholder('Enter a Prompt Here');

  logger.info('Check if the chat input is editable');
  await expect(chatInput).toBeEditable();

  logger.info('Write a message to the chat input');
  await chatInput.fill('Tell me about the fibonacci sequence');

  await chatInput.press('Enter');

  await stopResponding.waitFor();

  logger.info('Check if the stop responding button is visible');
  await expect(stopResponding).not.toBeVisible({ timeout: 15000 });

  logger.info('Check if the second ai response is visible');
  const initialAiResponse = page
    .locator('iframe')
    .contentFrame()
    .locator('.ai-response-container')
    .first();
  await expect(initialAiResponse).toBeVisible();

  logger.info('Empty the html file');
  await fs.writeFile(htmlFile, '');
});

// this test adds context awareness to the embed
test('test an embed must be used by a known user and embed has context awareness to it', async ({
  context,
  page,
  step,
}) => {
  test.setTimeout(120000); // set timeout to 120 seconds

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  logger.info('Navigating to AI mentor page');

  const currentUrl = page.url();
  if (
    !currentUrl.includes('/platform/') ||
    !currentUrl.endsWith('/ai-mentor')
  ) {
    logger.info('Not on AI mentor page. Attempting to navigate...');
    await safeNavigate(page, `${MENTOR_HOST}/platform/ibltesting/ai-mentor`);
  }

  await expect(page.getByRole('heading', { name: 'Instructor' })).toBeVisible();

  const checkbox = page.getByAltText('Presentation icon');
  await checkbox.isChecked();

  logger.info('Clicking on the settings dropdown');
  await page.locator('.header-settings-dropdown > .header-action-btn').click();
  await expect(page.getByText('Create Mentor')).toBeVisible();

  logger.info('loading mentors');
  await page.getByTestId('tail-spin-svg').waitFor();

  logger.info('Confirm mentors have loaded');
  await expect(page.getByTestId('tail-spin-svg')).not.toBeVisible({
    timeout: 60000,
  });

  const mentorElements = page.locator(
    '.table-body-row .table-block-big .table-text'
  );
  const count = await mentorElements.count();

  expect(count).toBeGreaterThan(0);

  const firstMentorLink = page
    .locator('.table-body-row')
    .first()
    .locator('.table-text-link');
  await expect(firstMentorLink).toBeEnabled();

  await firstMentorLink.click();

  await expect(page.getByText('Edit Mentor', { exact: true })).toBeVisible();

  await expect(page.getByRole('tab', { name: 'Embed' })).toBeVisible();

  await page.getByRole('tab', { name: 'Embed' }).click();

  const checkboxSelector = page
    .locator('div:nth-child(2) > .user-switcher > .user-switcher-slider')
    .first();

  await expect(checkboxSelector).toBeVisible();

  if (await checkboxSelector.isChecked()) {
    logger.info(
      'check the checkbox to make allow the embed be used anonymously'
    );
    await checkboxSelector.click();
  }

  await expect(checkboxSelector).not.toBeChecked();

  let contextAwareness = page
    .locator('label')
    .filter({ hasText: 'Context Aware is disabled' })
    .locator('span')
    .first();

  logger.info('Make sure the embed is not context aware');
  await expect(contextAwareness).toBeVisible();

  if (!(await contextAwareness.isChecked())) {
    await contextAwareness.click();
  }

  contextAwareness = page
    .locator('label')
    .filter({ hasText: 'Context Aware is enabled' })
    .locator('span')
    .first();

  await expect(contextAwareness).toBeChecked();

  const websiteUrl = 'http://127.0.0.1:5500/assets/embed/index.html';

  await page.getByRole('textbox', { name: 'https://ibl.ai' }).fill(websiteUrl);

  logger.info('Clicking on the Generate Embed button');
  await page.getByRole('link', { name: 'Embed Now' }).click();

  logger.info('Wait for the embed code to show');
  await expect(page.getByRole('link', { name: 'Embed Now' })).toBeVisible();

  logger.info('wait for network to be idle');
  await page.waitForLoadState('networkidle', { timeout: 60000 });

  await page.getByRole('heading', { name: 'Embed Mentor' }).waitFor();

  logger.info('Copy the embed code');
  await page.getByText('Copy Script', { exact: true }).click();

  logger.info('Embed code copied to clipboard');
  await page.getByText('Copied to clipboard', { exact: true }).waitFor();

  const clipboardContent = await page.evaluate(() => {
    return navigator.clipboard.readText();
  });

  logger.info('Write embed code to file');

  const htmlFile = path.join(__dirname, '../../assets/embed/index.html');
  const contextFile = path.join(__dirname, '../../assets/embed/context.txt');
  const contextFileContent = await fs.readFile(contextFile, 'utf-8');

  await fs.writeFile(htmlFile, '');
  await fs.writeFile(htmlFile, `${contextFileContent}\n${clipboardContent}`);

  await page.goto(websiteUrl);

  logger.info('wait for page to load');
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });

  await page.waitForURL((url) => url.href.includes(AUTH_HOST));

  logger.info('wait to be redirected to the auth page');
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

  if (await authRequiresMagicLink(page)) {
    logger.info('Magic link required for authentication');

    logger.info('Fill the email address field');
    await page.getByPlaceholder('Email').click();
    await page.getByPlaceholder('Email').fill('ibltestuser@mailsac.com');

    logger.info('Click the Continue button');
    await page.getByLabel('Continue').click();

    await page.getByText(/Enter it below/i).waitFor({ timeout: 5000 });

    logger.info('Check for the magic link email');
    await page.waitForTimeout(5000);

    const apiKey = 'k_GZgb33koIUEPRRqciDzn6c21bZnNBit0GBQaV0a905hwwc832';
    const mailsac = new MailsacClient(apiKey);
    const emailInbox = 'ibltestuser';

    const emails = await mailsac.getEmails(emailInbox);

    const magicLinkEmail = emails.find(
      (e) => e.subject === 'Verify your email to sign in for ibl'
    );

    if (!magicLinkEmail) {
      throw new Error('Magic link email not found');
    }

    const emailContent = await mailsac.getEmailById(
      emailInbox,
      magicLinkEmail._id
    );

    const matches = emailContent.match(/\b\d{6}\b/);
    const signInCode = matches ? matches[0] : '';

    await page.keyboard.press(signInCode[0]);
    await page.keyboard.press(signInCode[1]);
    await page.keyboard.press(signInCode[2]);
    await page.keyboard.press(signInCode[3]);
    await page.keyboard.press(signInCode[4]);
    await page.keyboard.press(signInCode[5]);
  } else {
    await loginWithEmailAndPassword(
      page,
      step,
      username,
      password,
      websiteUrl,
      AUTH_HOST
    );
  }

  await page.waitForURL((url) => url.href.includes(websiteUrl));

  await page.waitForTimeout(10000);

  logger.info('open the mentor chat widget');
  await page.getByRole('img').click();

  const stopResponding = page
    .locator('iframe')
    .contentFrame()
    .getByRole('link', { name: 'Stop Responding' });

  logger.info('Check if the stop responding button is visible');
  await expect(stopResponding).not.toBeVisible({ timeout: 15000 });

  const chatInput = page
    .locator('iframe')
    .contentFrame()
    .getByPlaceholder('Enter a Prompt Here');

  logger.info('Check if the chat input is editable');
  await expect(chatInput).toBeEditable();

  logger.info('Write a message to the chat input');

  const questionAboutTheContext = "What's the name of the detective?";
  await chatInput.fill(questionAboutTheContext);

  await chatInput.press('Enter');

  await stopResponding.waitFor();

  logger.info('Check if the stop responding button is visible');
  await expect(stopResponding).not.toBeVisible({ timeout: 15000 });

  logger.info('Check if the second ai response is visible');
  const initialAiResponse = page
    .locator('iframe')
    .contentFrame()
    .locator('.ai-response-container')
    .first();
  await expect(initialAiResponse).toBeVisible();

  const aiResponseAfterFirstQuestionText = await initialAiResponse.innerText();

  logger.info('Check if ai got the context of the page');
  expect(aiResponseAfterFirstQuestionText).toContain('Elias Carter');

  logger.info('Empty the html file');
  await fs.writeFile(htmlFile, '');
});
