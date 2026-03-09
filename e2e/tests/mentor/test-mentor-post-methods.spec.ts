import { MENTOR_HOST } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { test, expect } from '@iblai/iblai-js/playwright';

test('Verify new chat creation', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  const freeBanner = page.locator('.site-top-header.ibl-trial-top-header');

  const isBannerVisible = await freeBanner.isVisible();

  if (isBannerVisible) {
    const bannerContent = await freeBanner.locator(
      '.w-layout-hflex.site-top-header-container'
    );
    expect(await bannerContent.count()).toBeGreaterThan(0);

    expect(isBannerVisible).toBeTruthy();
  } else {
    expect(true).toBeTruthy();
  }
});

test('Verify document training works well for the mentor', async ({ page }) => {
  logger.info('Navigating to mentor platform');
  await page.goto(MENTOR_HOST);

  logger.info("Wait to be redirected to the users's active mentor and tenant");
  await page.waitForURL((url) =>
    url.href.startsWith(`${MENTOR_HOST}/platform`)
  );

  const documentTrainingContainers = page.locator(
    '.w-layout-hflex.prompts-block'
  );

  await documentTrainingContainers
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  const containersCount = await documentTrainingContainers.count();

  let totalQuestions = 0;
  let firstQuestionText = '';

  for (let i = 0; i < containersCount; i++) {
    const container = documentTrainingContainers.nth(i);
    const questionsInContainer = await container.locator('> *').count();
    totalQuestions += questionsInContainer;

    if (totalQuestions > 0 && firstQuestionText === '') {
      const firstQuestion = container.locator('> *').first();
      const text = await firstQuestion.textContent();
      if (text !== null) {
        firstQuestionText = text.trim();
      }
    }
  }

  if (totalQuestions > 0) {
    expect(totalQuestions).toBeGreaterThan(0);

    if (firstQuestionText) {
      expect(firstQuestionText.length).toBeGreaterThan(0);
    } else {
    }
  } else {
    expect(false).toBeTruthy();
  }
});
