import { test, expect } from '@playwright/test';

import { CANVAS_EMAIL, CANVAS_PASSWORD, CANVAS_URL } from '../../utils';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Canvas embed', () => {
  test.skip(true, 'Skipping canvas embed test');
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await page.goto(CANVAS_URL);
    // Wait for 10 seconds
    await page.waitForTimeout(10_000);
  });

  test('testing the canvas embed ensuring it display properly and  users are capable of chatting with the mentor', async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === 'mentornextjs-desktop-safari') {
      test.skip(true, 'Skipping on Safari (WebKit)');
    }
    // Authenticating user

    await page.locator('#pseudonym_session_unique_id').fill(CANVAS_EMAIL);
    await page.locator('#pseudonym_session_password').fill(CANVAS_PASSWORD);
    await page.locator('input[name="commit"]').click();

    //Home Page
    const mentorCard = page.getByLabel('mentorAI', { exact: true });
    await mentorCard.waitFor({ state: 'visible', timeout: 60_000 });
    await mentorCard.click();

    // Using the exact title attribute
    const moduleItem = mentorCard
      .locator('ul:first-child li:first-child a:first-child')
      .first();
    // const moduleItem = page.getByRole('link', {
    //   name: 'AI Assessment Creator',
    //   exact: true,
    // });
    await expect(moduleItem).toBeVisible();
    await moduleItem.click();

    // Wait for the mentor AI wrapper to appear
    const mentorAIWrapper = page.locator('#mentor-ai-wrapper');
    const mentorAIWrapperIsVisible = await mentorAIWrapper.isVisible({
      timeout: 60000,
    });
    if (mentorAIWrapperIsVisible) {
      const mentorAIWrapperInnerFrame = mentorAIWrapper.frameLocator('iframe');

      const widget = mentorAIWrapperInnerFrame.locator(
        '#ibl-chat-widget-container'
      );
      await expect(widget).toBeVisible({ timeout: 60000 });
      const iblIframe = widget.frameLocator('iframe').first();

      // Step 7: Validate elements inside the iframe
      const navName = iblIframe.locator('nav h1');
      await expect(navName).toBeVisible({ timeout: 60000 });
      const closeButton = iblIframe.getByRole('button', {
        name: /close chat/i,
      });
      await expect(closeButton).toBeVisible();
      const img = iblIframe.locator('img[data-slot="avatar-image"]').first();
      await expect(img).toBeVisible();

      const isLoaded = await img.evaluate(
        (imgEl: HTMLImageElement) => imgEl.naturalWidth > 0
      );
      expect(isLoaded).toBeTruthy();

      logger.info(' Chat loaded and text content verified');

      const text = 'hello whats IBL all about?';

      const textArea = iblIframe.locator(
        'textarea[placeholder]:not([placeholder=""])'
      );
      await expect(textArea).toBeVisible();
      await expect(textArea).toHaveAttribute('placeholder', /.+/);
      const sendButton = iblIframe.getByRole('button', {
        name: /send message/i,
      });

      await textArea.fill(text);
      await expect(sendButton).toBeEnabled();
      // Wait for the reducers to be stable (to be improved)
      await page.waitForTimeout(5000);
      await sendButton.click();

      const userMessage = iblIframe.locator('.chat-user-message-query', {
        hasText: text,
      });
      const mentorResponse = iblIframe.locator('.chat-ai-message-response');
      await userMessage.waitFor();
      await mentorResponse.waitFor();

      // 5. Check user message layout
      const userLayout = await userMessage.evaluate((el) => {
        const elem = el as HTMLElement;
        return {
          scrollWidth: elem.scrollWidth,
          clientWidth: elem.clientWidth,
          height: elem.offsetHeight,
          overflows: elem.scrollWidth > elem.clientWidth,
        };
      });

      expect(userLayout.overflows).toBe(false);
      expect(userLayout.height).toBeGreaterThan(10);

      // 6. Check mentor message layout
      const mentorLayout = await mentorResponse.evaluate((el) => {
        const elem = el as HTMLElement;
        return {
          scrollWidth: elem.scrollWidth,
          clientWidth: elem.clientWidth,
          height: elem.offsetHeight,
          overflows: elem.scrollWidth > elem.clientWidth,
        };
      });

      expect(mentorLayout.overflows).toBe(false);
      expect(mentorLayout.height).toBeGreaterThan(10);
    }
  });
});
