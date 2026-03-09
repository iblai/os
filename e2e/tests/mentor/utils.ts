import { Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { StepFn } from '@iblai/iblai-js/playwright';

export const safeNavigate = async (page: Page, url: string) => {
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

export const waitForNetworkIdle = async (page: Page, timeout = 10000) => {
  await page.waitForLoadState('networkidle', { timeout });
};

export const browsers = ['chromium', 'firefox', 'webkit'] as const;

export async function logoutOfMentorService(page: Page, step: StepFn) {
  logger.info('wait for auth service to fully load');
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 });

    logger.info('auth service loaded');
  } catch (error) {
    logger.info(`############# Networkidle timeout for auth page`);
  }

  logger.info('Logging out of mentor service');

  const dropdown = page.locator('.ibl-user-profile-container');

  await dropdown.waitFor({ state: 'attached', timeout: 1200000 });

  await step('Clicking user avatar dropdown', async () => {
    await dropdown.click();
  });

  logger.info('Clicking log out button');
  const logoutButton = page.getByText('Log Out');
  await logoutButton.waitFor({ state: 'visible' });

  await logoutButton.click();
}
