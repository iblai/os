import path from 'path';
import fs from 'fs/promises';

import { Page } from '@playwright/test';

import { MENTOR_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { test, expect } from '@iblai/iblai-js/playwright';

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

test('document training works well', async ({ page }) => {
  test.setTimeout(120000); // set timeout to 120 seconds

  logger.info('Navigating to AI mentor page');

  const currentUrl = page.url();
  if (
    !currentUrl.includes('/platform/') ||
    !currentUrl.endsWith('/ai-mentor')
  ) {
    logger.info('Not on AI mentor page. Attempting to navigate...');
    await safeNavigate(page, `${MENTOR_HOST}/platform/ibltesting/ai-mentor`);
  }

  logger.info('User has successfully navigated to the AI mentor page');

  const model = 'GPT-4o Mini';
  logger.info(`Check if user is using is using ${model} model`);
  await expect(
    page.getByRole('button', { name: `${model} View your profile` })
  ).toBeVisible();
  await expect(page.locator('#w-dropdown-toggle-10')).toContainText(model);

  await expect(page.getByRole('heading', { name: 'Instructor' })).toBeVisible();

  const checkbox = page.getByAltText('Presentation icon');
  await checkbox.isChecked();

  logger.info('Clicking on the settings dropdown');
  await page.locator('.header-settings-dropdown > .header-action-btn').click();
  await expect(page.getByText('Create Mentor')).toBeVisible();

  logger.info('loading mentors');
  await page.getByTestId('tail-spin-svg').waitFor();

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

  await expect(page.getByRole('tab', { name: 'Datasets' })).toBeVisible();

  await page.getByRole('tab', { name: 'Datasets' }).click();

  await expect(page.getByText('Add Resource').first()).toBeVisible();

  await page.getByText('Add Resource').first().click();

  const fileName = 'ibl-ai-about.txt';
  const originalFilePath = path.join(__dirname, `../../assets/${fileName}`);

  const newFileName = `ibl-ai-about-${Date.now()}.txt`;
  const newFilePath = path.join(__dirname, newFileName);

  const fileContents = await fs.readFile(originalFilePath, 'utf8');

  // Write contents to new file
  await fs.writeFile(newFilePath, fileContents);
  console.log(`Created temporary file: ${newFileName}`);

  await page.locator('div:nth-child(2) > div:nth-child(7)').first().click();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Click here to select or drag').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(
    path.join(__dirname, 'attention-is-all-you-need-paper.pdf')
  );

  await page.getByRole('link', { name: 'Submit' }).click();

  await expect(page.getByText('Resource has been submitted')).toBeVisible({
    timeout: 60000,
  });

  await fs.unlink(newFilePath);
  console.log(`Deleted temporary file: ${newFileName}`);
});
