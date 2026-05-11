import { test, expect } from '../fixtures/mentor-test';
import {
  CANVAS_PATH_WITH_LTI_MENTOR,
  CANVAS_URL,
  hasCanvasEnv,
} from '../fixtures/test-data';
import { authenticateToCanvas } from '../utils/auth';

test.describe('Journey 11: Canvas — Embed', () => {
  // fixme: authenticate() uses the mentor app auth flow (IBL SSO) which does not work
  // for Canvas LMS. Canvas has its own auth system at instructure.com. The test needs
  // a Canvas-specific login helper to authenticate before checking the embed.
  test('admin goes to a Canvas LMS embed and verifies it displays correctly and allows chatting', async ({
    page,
  }) => {
    test.skip(
      !hasCanvasEnv,
      'Set CANVAS_URL, CANVAS_EMAIL, and CANVAS_PASSWORD to enable this test',
    );

    // Authenticate to Canvas LMS
    await authenticateToCanvas(page);

    // Navigate to the Canvas LMS page that contains the embedded mentor
    await page.goto(CANVAS_PATH_WITH_LTI_MENTOR, { timeout: 60_000 });

    // Structure: Canvas page → xblock iframe → <mentor-ai> (shadow DOM)
    //   → div#ibl-chat-widget-container + inner iframe (the mentor app)

    // Wait for the xblock iframe to load
    const xblockIframeEl = page.locator('div#content iframe.tool_launch');
    await expect(xblockIframeEl).toBeVisible({ timeout: 30_000 });
    const xblockIframe = page.frameLocator('div#content iframe.tool_launch');

    // Wait for the mentor-ai widget inside the xblock iframe to load
    const mentorAi = xblockIframe.locator('mentor-ai');
    const widgetContainer = mentorAi.locator('div#ibl-chat-widget-container');
    await expect(widgetContainer).toBeVisible({ timeout: 30_000 });

    // The mentor app iframe lives inside the <mentor-ai> shadow root
    const mentorIframe = mentorAi.frameLocator('iframe');
    const chatInput = mentorIframe.getByPlaceholder('Ask anything', {
      exact: true,
    });

    await chatInput.isVisible({ timeout: 120_000 });
    await chatInput.fill('Hello from Canvas embed test');
    const sendButton = mentorIframe.getByRole('button', {
      name: 'Send message',
    });
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });
    await sendButton.click();
    const aiResponse = mentorIframe
      .locator('.chat-ai-message-response')
      .first();
    await expect(aiResponse).toBeVisible({ timeout: 60_000 });
  });
});
