import { logger } from '@iblai/iblai-js/playwright';
import { test, expect } from '@iblai/iblai-js/playwright';
import { MENTOR_HOST } from '../utils';

const ALL_MENTOR_TABS: string[] = [
  'New Chat',
  'Settings',
  'LLM',
  'Prompts',
  'Tools',
  'Safety',
  'Flow',
  'History',
  'Datasets',
  'Embed',
  'Analytics',
] as const;

test('Test that mentor tabs are visible', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  for (const item of ALL_MENTOR_TABS) {
    logger.info(`Checking if ${item} is not visible`);

    await expect(
      page.getByRole('menuitem', { name: item }).locator('div').first()
    ).not.toBeVisible();
  }

  const mentorDropdownIcon = page.locator('.image-48');

  logger.info('Clicking on the mentor dropdown icon');
  await mentorDropdownIcon.click();

  for (const item of ALL_MENTOR_TABS) {
    logger.info(`Checking if ${item} is visible`);

    await expect(
      page.getByRole('menuitem', { name: item }).locator('div').first()
    ).toBeVisible();
  }
});
