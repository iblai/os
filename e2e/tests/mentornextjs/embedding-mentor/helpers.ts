import { expect, FrameLocator, Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

// Helper functions for better reliability
export async function waitForIframeReady(
  iframe: FrameLocator,
  timeout = 30000
) {
  // Wait for critical elements that indicate full load
  await iframe.locator('textarea[placeholder]').waitFor({
    state: 'visible',
    timeout,
  });
  await iframe.locator('button[aria-label*="Send"]').waitFor({
    state: 'visible',
    timeout,
  });
  // Wait for any loading indicators to disappear
  await iframe
    .locator('[data-loading="true"]')
    .waitFor({
      state: 'hidden',
      timeout: 5000,
    })
    .catch(() => {}); // Optional - ignore if doesn't exist
}

export async function waitForChatReady(iframe: FrameLocator) {
  // Ensure textarea is not disabled (often disabled during connection)
  const textArea = iframe.locator('textarea[placeholder]');
  await expect(textArea).toBeEnabled({ timeout: 30000 });

  // Optional: Check for any "connecting..." or offline indicators
  await iframe
    .locator('[data-status="connecting"]')
    .waitFor({
      state: 'hidden',
      timeout: 10000,
    })
    .catch(() => {}); // Ignore if element doesn't exist
}

export async function sendMessageWithRetry(
  iframe: FrameLocator,
  text: string,
  maxRetries = 2
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const textArea = iframe.locator(
        'textarea[placeholder]:not([placeholder=""])'
      );
      await textArea.fill('');
      await textArea.fill(text);

      const sendButton = iframe.getByRole('button', { name: /send message/i });
      await expect(sendButton).toBeEnabled({ timeout: 15000 });
      await sendButton.click();

      // Verify message appears
      const userMessage = iframe.locator('.chat-user-message-query', {
        hasText: text,
      });
      await expect(userMessage).toBeVisible({ timeout: 10000 });

      logger.info(`✅ Message sent successfully on attempt ${i + 1}`);
      return; // Success
    } catch (error) {
      if (i === maxRetries - 1) {
        logger.error(`Failed to send message after ${maxRetries} attempts`);
        throw error;
      }
      logger.warn(`⚠️ Send attempt ${i + 1} failed, retrying...`);
    }
  }
}

export async function waitForMentorResponse(
  iframe: FrameLocator,
  timeout = 150000
) {
  // Wait for any "thinking" or "typing" indicator first
  await iframe
    .locator('[data-ai-status="responding"]')
    .waitFor({
      state: 'visible',
      timeout: 10000,
    })
    .catch(() => logger.info('No typing indicator found, continuing...'));

  // Now wait for actual response
  const mentorResponse = iframe
    .locator('div.flex.items-start >> div:has(p)')
    .last();

  try {
    await expect(mentorResponse).toBeVisible({ timeout });
    logger.info('✅ Mentor response received');

    return mentorResponse;
  } catch (error) {
    // Enhanced debugging on failure
    logger.error(' Mentor failed to respond within timeout');

    // Log iframe content for debugging
    const iframeContent = await iframe
      .locator('body')
      .innerHTML()
      .catch(() => 'Could not get iframe content');
    logger.error(
      'Iframe content when response failed:',
      iframeContent.substring(0, 500)
    );

    throw new Error(
      `Mentor failed to respond after ${timeout}ms. Original error: ${error.message}`
    );
  }
}

export async function removeChatBubbleIfExists(page: Page) {
  const existingChatBubble = page.locator('.ibl-chat-bubble');
  const chatBubbleCount = await existingChatBubble.count();
  if (chatBubbleCount > 0) {
    logger.info(
      `Found ${chatBubbleCount} existing chat bubble(s), removing them`
    );
    await existingChatBubble.evaluateAll((elements) => {
      elements.forEach((element) => element.remove());
    });
    await page.waitForTimeout(2000); // Wait for removal to complete
  }
}

export async function openChatWidget(page: Page) {
  await page.waitForSelector('.ibl-chat-bubble', { timeout: 20000 });
  const chatButton = page.getByRole('button', {
    name: 'Open chat assistant',
  });
  await chatButton.scrollIntoViewIfNeeded();
  await expect(chatButton).toBeVisible();
  await expect(chatButton).toBeEnabled();

  // Use JavaScript click to bypass pointer event interception
  await chatButton.evaluate((element) => (element as HTMLElement).click());
  logger.info('✅ Chat button clicked');

  // Wait for chat widget to appear
  await page.waitForTimeout(3000);
}
