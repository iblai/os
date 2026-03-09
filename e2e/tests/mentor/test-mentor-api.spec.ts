import { expect, test } from '@iblai/iblai-js/playwright';
import { logger } from '@iblai/iblai-js/playwright';
import { MENTOR_HOST } from '../utils';

test('test user can create and delete an api', async ({ page }) => {
  await page.goto(MENTOR_HOST, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 30000 });

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

  await expect(page.getByRole('tab', { name: 'API' })).toBeVisible();

  await page.getByRole('tab', { name: 'API' }).click();

  await expect(page.getByText('Create New', { exact: true })).toBeVisible();

  await page.getByText('Create New', { exact: true }).click();

  // create a new api with no expiration date
  const currentDate = new Date();

  // Add one day to get tomorrow
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(currentDate.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(tomorrow.getDate()).padStart(2, '0');

  const formattedDate = `${year}-${month}-${day}`;

  const apiName = `Test-API-${formattedDate}`;
  await page.getByRole('textbox', { name: 'API Key Name' }).fill(apiName);

  await page
    .getByRole('textbox', { name: 'Expiration Date' })
    .fill(formattedDate);

  await page.getByRole('link', { name: 'Submit' }).click();

  await expect(page.getByRole('link', { name: 'Saving...' })).toBeVisible();

  await expect(page.getByText('API key created successfully')).toBeVisible();

  await page
    .locator('.api-action-icon-container > .api-action-icon')
    .first()
    .click();

  await expect(page.getByText('Are you sure to delete API')).toBeVisible();

  await page.getByTestId('delete-api-key').click();

  await expect(page.getByText('Are you sure to delete API')).not.toBeVisible();

  await expect(page.getByText('API key deleted successfully')).toBeVisible();
});
