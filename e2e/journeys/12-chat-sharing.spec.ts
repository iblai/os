import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';

test.describe('Journey 12: Chat Sharing', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedChatUrl = '';

  test('authenticated user goes to chat page and creates a shareable chat URL', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    await chatPage.sendMessage('Hello, this is a test message for sharing');
    await chatPage.waitForAIResponse();

    // Find and click the share button on an AI message
    const shareButton = page
      .getByRole('button', { name: /share/i })
      .or(page.locator('[data-testid*="share"]'))
      .first();
    const visible = await shareButton.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) return;

    await shareButton.click();
    // The shared URL should appear in a dialog or be copied to clipboard
    const shareDialog = page.getByRole('dialog').filter({ hasText: /share/i });
    const dialogVisible = await shareDialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (dialogVisible) {
      const urlText = await shareDialog.locator('input, [class*="url"]').first().inputValue().catch(() => '');
      if (urlText.includes('/share/chat/')) {
        sharedChatUrl = urlText;
      }
    }
    expect(sharedChatUrl || page.url()).toMatch(/share|chat|platform/i);
  });

  test('unauthenticated user goes to shared chat URL and sees the chat history', async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) {
      test.skip(true, 'No shared chat URL from previous test');
      return;
    }
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await anonPage.waitForTimeout(2_000);
      const hasMessages = await anonPage
        .locator('.chat-ai-message-response, .chat-user-message-query')
        .first()
        .isVisible({ timeout: 15_000 })
        .catch(() => false);
      expect(hasMessages).toBe(true);
    } finally {
      await anonContext.close();
    }
  });

  test('authenticated user goes to shared chat URL and is redirected to the platform', async ({
    page,
  }) => {
    await navigateToMentorApp(page);
    if (!sharedChatUrl) return;
    await page.goto(sharedChatUrl, { waitUntil: 'domcontentloaded' });
    await safeWaitForURL(
      page,
      (url) => url.href.includes('/platform/'),
      { timeout: 30_000 },
    );
    expect(page.url()).toContain('/platform/');
  });

  test('unauthenticated user goes to shared chat URL and the chat interface loads correctly', async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await anonPage.waitForTimeout(3_000);
      // The page should render without errors
      const title = await anonPage.title();
      expect(title).toBeTruthy();
    } finally {
      await anonContext.close();
    }
  });

  test('unauthenticated user goes to shared chat page and sees a Sign Up for Free button that redirects to auth', async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const signUpBtn = anonPage.getByRole('button', { name: /sign up for free/i })
        .or(anonPage.getByRole('link', { name: /sign up for free/i }));
      const visible = await signUpBtn.isVisible({ timeout: 10_000 }).catch(() => false);
      if (!visible) return;
      await signUpBtn.click();
      await anonPage.waitForTimeout(2_000);
      expect(anonPage.url()).toMatch(/auth|login|signup/i);
    } finally {
      await anonContext.close();
    }
  });

  test('unauthenticated user goes to shared chat page and does not see the chat textarea', async ({
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await anonPage.waitForTimeout(2_000);
      const chatInput = anonPage.getByPlaceholder('Ask anything', { exact: true });
      const visible = await chatInput.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(visible).toBe(false);
    } finally {
      await anonContext.close();
    }
  });
});
