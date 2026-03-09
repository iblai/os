import path from 'path';

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

test('create a mentor', async ({ page }) => {
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

  await page.waitForLoadState('networkidle', { timeout: 60000 });

  logger.info('Clicking on Create Mentor');
  await page.getByText('Create Mentor').click();

  logger.info('Wait for Next link to show');
  await page.getByRole('link', { name: 'Next' }).isDisabled();

  const mentorName = `test mentor ${Date.now()}`;

  logger.info('Filling mentor name');
  await page.getByPlaceholder('Mentor Name').fill(mentorName);

  logger.info('Filling mentor description');
  await page
    .getByPlaceholder('Mentor Description')
    .fill(`test mentor ${Date.now()} description`);

  await page.locator('#field-11').selectOption({ label: 'Technology' });

  const imagePage = path.join(__dirname, '../../assets/avatar.jpg');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('div.w-layout-hflex.mentor-image-uploader.empty').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(imagePage);

  await page.getByRole('link', { name: 'Next' }).isEnabled();

  await page.getByRole('link', { name: 'Next' }).click();

  await expect(page.getByRole('link', { name: 'Save' })).toBeVisible();

  await page.getByRole('link', { name: 'Save' }).click();

  await expect(
    page.getByText('Mentor has been successfully created', { exact: true })
  ).toBeVisible({ timeout: 60000 });
});
