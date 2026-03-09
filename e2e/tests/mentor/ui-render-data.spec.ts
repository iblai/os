import { Page } from '@playwright/test';

import { MENTOR_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { test, expect } from '@iblai/iblai-js/playwright';

test('Verify featured mentors are available', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  logger.info('Get the mentor url');
  const platformUrl = page.url();

  const exploreMentorsLink = page.getByRole('button', { name: 'Explore' });

  logger.info('navigate to the explore mentors page');
  await exploreMentorsLink.click();

  await page.waitForURL((url) => url.href.endsWith('/explore'));

  logger.info('Get the explore url');
  const exploreUrl = page.url();

  logger.info('Check if the platform url is different from the explore url');
  expect(platformUrl).not.toEqual(exploreUrl);

  logger.info('Check if the featured mentors title is visible');
  await expect(
    page.getByText('Curated top picks from this week', { exact: true })
  ).toBeVisible();

  await expect(
    page.getByText('Featured Mentors', { exact: true })
  ).toBeVisible();

  logger.info('Check if all mentors are visible too');
  await expect(
    page.getByText('All available mentors', { exact: true })
  ).toBeVisible();

  await expect(page.getByText('All Mentors', { exact: true })).toBeVisible();
});

test('Verify guided questions are available', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  const guidedQuestionsContainer = page.locator(
    '.w-layout-hflex.prompts-block'
  );

  logger.info('Waiting for guided questions container to be visible');
  await guidedQuestionsContainer
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  const guidedQuestions = page.locator('.w-layout-vflex.prompt');

  const count = await guidedQuestions.count();
  console.log('Guided Questions Count: ', count);

  expect(count).toBeGreaterThan(0);
});

test('Verify suggested prompts are available', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  const suggestedPromptsButton = page
    .getByLabel('user-prompt-label')
    .getByText('Suggested Prompts');

  const suggestedPromptsContainer = page.locator(
    '.dropdown-list-2 > .w-layout-vflex'
  );

  await expect(suggestedPromptsContainer).not.toBeVisible();

  logger.info('Clicking on the suggested prompts button');
  await suggestedPromptsButton.click();

  await testSuggestedPrompts(page);
});

async function testSuggestedPrompts(page: Page) {
  try {
    // First attempt: Try to find the element using the first selector pattern
    const firstSelector = await page
      .locator('div')
      .filter({ hasText: /^'No suggested prompts$/ })
      .first()
      .isVisible();

    if (firstSelector) {
      logger.info('Found element using first selector pattern');
      return;
    }

    // Second attempt: Try the alternative approach
    logger.info('First selector not found, trying second approach');
    const suggestedPromptsContainer = page.locator(
      '.copilot-suggestion-container'
    );
    const suggestedPromptsButton = page.locator('.copilot-suggestion-button');

    // Verify container is not initially visible
    await expect(suggestedPromptsContainer).not.toBeVisible();

    // Click the button to show prompts
    logger.info('Clicking on the suggested prompts button');
    await suggestedPromptsButton.click();

    // Wait for container to become visible
    logger.info('Waiting for the suggested prompts container to be visible');
    await expect(suggestedPromptsContainer).toBeVisible();

    // Check for prompts
    const suggestedPrompts = page.locator('.copilot-suggestion-prompt-element');
    const count = await suggestedPrompts.count();
    expect(count).toBeGreaterThan(0);

    logger.info(`Found ${count} suggested prompts`);
    return count;
  } catch (error) {
    logger.error('Error in testSuggestedPrompts:', error);
    throw new Error('Failed to test suggested prompts: ' + error.message);
  }
}
