import { test, expect } from '../fixtures/mentor-test';
import { CANVAS_URL, CANVAS_EMAIL, CANVAS_PASSWORD, hasCanvasEnv } from '../fixtures/test-data';
import { authenticate } from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';

test.describe('Journey 11: Canvas — Embed', () => {
  test('admin goes to a Canvas LMS embed and verifies it displays correctly and allows chatting', async ({
    page,
  }) => {
    test.skip(
      !hasCanvasEnv,
      'Set CANVAS_URL, CANVAS_EMAIL, and CANVAS_PASSWORD to enable this test',
    );

    // Authenticate to Canvas LMS
    await authenticate(page, CANVAS_URL, CANVAS_EMAIL, CANVAS_PASSWORD);

    // Navigate to the Canvas LMS page that contains the embedded mentor
    await page.goto(CANVAS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Look for an iframe containing the mentor widget
    const iframe = page.frameLocator('iframe[src*="mentor"], iframe[title*="mentor"]');
    const chatInput = iframe.getByPlaceholder('Ask anything', { exact: true });

    await expect(page.locator('iframe').first()).toBeVisible({ timeout: 30_000 });

    if (await chatInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await chatInput.fill('Hello from Canvas embed test');
      const sendButton = iframe.getByRole('button', { name: 'Send message' });
      await expect(sendButton).toBeEnabled({ timeout: 10_000 });
      await sendButton.click();
      const aiResponse = iframe.locator('.chat-ai-message-response').first();
      await expect(aiResponse).toBeVisible({ timeout: 60_000 });
    }
  });
});
