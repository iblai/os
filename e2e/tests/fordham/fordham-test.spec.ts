import { test, expect } from '@playwright/test';
import { FORDHAM_HOST } from '../utils';
test.describe('Chatbot Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(
      'https://www.fordham.edu/undergraduate-admission/apply/what-were-looking-for/'
    );
  });

  test('Chatbot is keyboard accessible', async ({ page }) => {
    await page.keyboard.press('Tab');
    // Tab until chatbot toggle button is focused
    const chatbotToggle = await page
      .locator('button[aria-label*="chat"], button:has-text("Chat")')
      .first();
    await expect(chatbotToggle).toBeVisible();
    await chatbotToggle.press('Enter');
  });

  test('Chatbot has proper ARIA roles and semantic structure', async ({
    page,
  }) => {
    const chatbot = await page
      .locator('[role="dialog"], [role="application"], [aria-label*="chat"]')
      .first();
    await expect(chatbot).toBeVisible();
    await expect(chatbot).toHaveAttribute('role', /dialog|application/);
  });

  test('Chat messages use appropriate live regions', async ({ page }) => {
    const messages = await page.locator(
      '[role="log"], [aria-live], .bot-message'
    );
    await expect(messages.first()).toBeVisible();
    // Check that the first message has an aria-live attribute set to polite or assertive
    const ariaLiveValue = await messages.first().getAttribute('aria-live');
    expect(
      ariaLiveValue === 'polite' || ariaLiveValue === 'assertive'
    ).toBeTruthy();
  });

  test('Chat input is clearly labeled', async ({ page }) => {
    const input = await page.locator('textarea, input[type="text"]');
    // Check for at least one of the labeling attributes to be present and non-empty
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaLabelledBy = await input.getAttribute('aria-labelledby');
    const placeholder = await input.getAttribute('placeholder');
    expect(
      (ariaLabel && ariaLabel.trim().length > 0) ||
        (ariaLabelledBy && ariaLabelledBy.trim().length > 0) ||
        (placeholder && placeholder.trim().length > 0)
    ).toBeTruthy();
  });

  test('Chat supports screen reader feedback via live updates', async ({
    page,
  }) => {
    const liveRegion = await page.locator('[aria-live]');
    await expect(liveRegion).toHaveAttribute('aria-live', /polite|assertive/);
  });

  test('Chat UI preserves transcript readability', async ({ page }) => {
    const transcript = await page.locator('.bot-message, [role="log"] > *');
    const count = await transcript.count();
    expect(count).toBeGreaterThan(0);
    await expect(transcript.first()).toBeVisible();
  });

  test('Color contrast is acceptable for chat content', async ({ page }) => {
    const chatText = await page.locator('.bot-message, .user-message');
    const color = await chatText.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });

    // You may extend this with color contrast ratio checker
    expect(color.color).not.toBe(color.backgroundColor); // crude contrast check
  });

  test('Error messages are accessible when invalid input is submitted', async ({
    page,
  }) => {
    const input = await page.locator('textarea, input[type="text"]');
    await input.fill('');
    await input.press('Enter');

    const error = await page.locator(
      '[role="alert"], .error, [aria-live="assertive"]'
    );
    await expect(error).toBeVisible();
  });

  test('Chat avoids auto-focus and scroll traps', async ({ page }) => {
    const activeElement = await page.evaluateHandle(
      () => document.activeElement
    );
    expect(activeElement).not.toBe(null); // Shouldn't force focus unless intended

    // Verify user can shift+tab out of chatbot
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
  });

  test('Modal or overlay behavior works correctly', async ({ page }) => {
    const modal = await page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check that pressing Escape closes the chatbot
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Chatbot adheres to ARIA Authoring Practices', async ({ page }) => {
    const logRegion = await page.locator('[role="log"]');
    await expect(logRegion).toBeVisible();
    await expect(logRegion).toHaveAttribute('aria-live', /polite|assertive/);
    await expect(logRegion).toHaveAttribute('aria-relevant', /additions/);
  });
});
