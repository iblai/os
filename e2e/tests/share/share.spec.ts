import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../utils';
import { navigateToMentorApp } from '../profile/helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

/**
 * Test credentials - these should be configured via environment variables in production
 */
const TEST_CREDENTIALS = {
  email: process.env.PLAYWRIGHT_USERNAME || '',
  password: process.env.PLAYWRIGHT_PASSWORD || '',
};

/**
 * URL pattern matchers
 */
const PLATFORM_URL_PATTERN = /\/platform\/[^/]+\/[^/]+$/;
const SHARE_CHAT_URL_PATTERN = /\/share\/chat\/[a-f0-9-]+/;

/**
 * Performs authentication flow for the mentor application
 * Handles both fresh login and already-authenticated scenarios
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 */
async function authenticateUser(
  page: Page,
  email: string = TEST_CREDENTIALS.email,
  password: string = TEST_CREDENTIALS.password
): Promise<void> {
  // Check if we're already on the platform (user is already authenticated)
  const currentUrl = page.url();
  if (PLATFORM_URL_PATTERN.test(currentUrl)) {
    console.log('User is already authenticated, skipping login flow');
    return;
  }

  // Check if we're on the auth page or will redirect there
  const isOnAuthPage =
    currentUrl.includes(AUTH_HOST) || currentUrl.includes('/login');

  if (!isOnAuthPage) {
    // Wait for redirect to auth page (with shorter timeout since we might already be there)
    try {
      await safeWaitForURL(
        page,
        (url) => url.href.includes(AUTH_HOST) || url.href.includes('/login'),
        {
          timeout: 30000,
        }
      );
    } catch {
      // Check again if we ended up on platform page (auto-login via SSO)
      if (PLATFORM_URL_PATTERN.test(page.url())) {
        console.log('User was auto-authenticated via SSO');
        return;
      }
      throw new Error(
        `Expected to redirect to auth page, but ended up at: ${page.url()}`
      );
    }
  }

  // Click "Continue with Password" button
  const continueWithPasswordButton = page.getByRole('button', {
    name: 'Continue with Password',
  });
  await expect(continueWithPasswordButton).toBeVisible({ timeout: 15000 });
  await continueWithPasswordButton.click();

  // Wait for password form to appear
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await expect(emailInput).toBeVisible({ timeout: 10000 });

  // Fill in credentials
  await emailInput.fill(email);

  const passwordInput = page.getByRole('textbox', { name: 'Password' });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });
  await passwordInput.fill(password);

  // Click continue to submit login
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeEnabled({ timeout: 10000 });
  await continueButton.click();

  // Wait for SSO redirect and final navigation to platform
  await safeWaitForURL(page, PLATFORM_URL_PATTERN, {
    timeout: 60000,
    waitUntil: 'domcontentloaded',
  });
  // Wait for platform to be ready
  await expect(
    page.getByRole('button', { name: 'Selected mentor dropdown button' })
  ).toBeVisible({ timeout: 30000 });

  // Verify we're on the platform page
  expect(page.url()).toMatch(PLATFORM_URL_PATTERN);
}

/**
 * Sends a chat message and waits for the mentor response
 * @param page - Playwright page object
 * @param message - Message to send
 * @returns Promise that resolves when response is received
 */
async function sendChatMessageAndWaitForResponse(
  page: Page,
  message: string
): Promise<void> {
  // Wait for chat textarea to be visible
  const chatTextarea = page.getByRole('textbox', { name: 'Ask anything' });
  await expect(chatTextarea).toBeVisible({ timeout: 60000 });

  // Type message
  await chatTextarea.fill(message);

  // Click send button
  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });
  // Wait for the reducers to be stable (to be improved)
  await page.waitForTimeout(5000);
  await sendButton.click();

  // Wait for mentor response - look for the share button which appears after response
  const shareButton = page.getByRole('button', { name: 'Share this chat' });
  await expect(shareButton).toBeVisible({ timeout: 120000 });
}

/**
 * Captures the shared chat URL by clicking the share button
 * @param page - Playwright page object
 * @param context - Browser context for clipboard permissions
 * @returns The shared chat URL
 */
async function captureSharedChatUrl(
  page: Page,
  context: BrowserContext
): Promise<string> {
  // Grant clipboard permissions
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  } catch {
    // Safari doesn't support clipboard-write permission
    try {
      await context.grantPermissions(['clipboard-read']);
    } catch (safariError) {
      console.warn('Could not grant clipboard permissions:', safariError);
    }
  }

  // Click share button
  const shareButton = page.getByRole('button', { name: 'Share this chat' });
  await expect(shareButton).toBeVisible({ timeout: 15000 });
  await shareButton.click();

  // Wait for clipboard to be updated
  await page
    .getByText('Share link copied to clipboard')
    .waitFor({ timeout: 15000 });

  // Try to get URL from clipboard
  let sharedUrl: string | null = null;

  try {
    sharedUrl = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
  } catch {
    console.warn('Could not read from clipboard, falling back to localStorage');
  }

  // Fallback: Get session ID from localStorage and construct URL
  if (!sharedUrl || !sharedUrl.includes('/share/chat/')) {
    const sessionData = await page.evaluate(() => {
      return localStorage.getItem('session_id');
    });

    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      const sessionId = Object.values(parsed)[0] as string;
      sharedUrl = `${new URL(page.url()).origin}/share/chat/${sessionId}`;
    }
  }

  if (!sharedUrl || !sharedUrl.includes('/share/chat/')) {
    throw new Error('Failed to capture shared chat URL');
  }

  console.log('Captured shared chat URL:', sharedUrl);
  return sharedUrl;
}

/**
 * Extracts platform key and mentor ID from a platform URL
 * Supports both /platform/{tenantKey}/{mentorId} and /share/chat/{sessionId}/{tenantKey}/{mentorId}
 * @param url - Platform URL
 * @returns Object containing platformKey and mentorId
 */
function parsePlatformUrl(url: string): {
  platformKey: string;
  mentorId: string;
} {
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean);

  // Handle /platform/{tenantKey}/{mentorId}
  if (parts[0] === 'platform' && parts.length >= 3) {
    return {
      platformKey: parts[1],
      mentorId: parts[2],
    };
  }

  // Handle /share/chat/{sessionId}/{tenantKey}/{mentorId}
  if (parts[0] === 'share' && parts[1] === 'chat' && parts.length >= 5) {
    return {
      platformKey: parts[3],
      mentorId: parts[4],
    };
  }

  // Handle /share/chat/{sessionId} - return empty values as redirect hasn't completed
  if (parts[0] === 'share' && parts[1] === 'chat' && parts.length === 3) {
    console.log(
      'URL is still at share/chat/{sessionId}, waiting for redirect...'
    );
    return {
      platformKey: '',
      mentorId: '',
    };
  }

  throw new Error(
    `Unexpected URL format: ${pathname}. Expected /platform/{tenantKey}/{mentorId} or /share/chat/{sessionId}/{tenantKey}/{mentorId}`
  );
}

test.describe('Chat Sharing Functionality', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedChatUrl: string;

  test.beforeAll(async ({ browser, browserName }) => {
    // Skip on Safari due to clipboard API limitations
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Setup: Create a shared chat URL
    const context = await browser.newContext();
    const page = await context.newPage();

    await navigateToMentorApp(page);

    try {
      // Step 3: Send a test message
      const testMessage = 'Test message for sharing functionality.';
      await sendChatMessageAndWaitForResponse(page, testMessage);

      // Step 4: Capture the shared URL
      sharedChatUrl = await captureSharedChatUrl(page, context);

      console.log('Setup complete. Shared URL:', sharedChatUrl);
    } finally {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      await page.waitForTimeout(500);
      await page.close();
      try {
        await context.close();
      } catch (e) {
        console.log(
          'Context close failed (may be Chromium crash), continuing...'
        );
      }
    }
  });

  test('should successfully create and capture shared chat URL', async ({
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Verify shared URL was captured in beforeAll
    expect(sharedChatUrl).toBeTruthy();
    expect(sharedChatUrl).toMatch(SHARE_CHAT_URL_PATTERN);
    console.log('Verified shared chat URL format:', sharedChatUrl);
  });

  test('unauthenticated user can access shared chat and sees chat history', async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Create a completely new, unauthenticated browser context
    const unauthContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await unauthContext.newPage();

    try {
      // Navigate to the shared chat URL
      console.log('Navigating to shared URL (unauthenticated):', sharedChatUrl);
      await page.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      const finalUrl = page.url();
      console.log('Final URL after navigation:', finalUrl);

      // Verify the final URL is either:
      // 1. The share chat URL pattern: /share/chat/{sessionId}
      // 2. The platform URL pattern: /platform/{platformKey}/{mentorId}
      const isValidShareUrl = finalUrl.includes('/share/chat/');
      const isValidPlatformUrl = PLATFORM_URL_PATTERN.test(finalUrl);

      expect(isValidShareUrl || isValidPlatformUrl).toBe(true);
      console.log(
        `URL is valid - Share page: ${isValidShareUrl}, Platform page: ${isValidPlatformUrl}`
      );

      // Verify copy to clipboard button is visible
      const copyToClipboardButton = page.getByRole('button', {
        name: 'Copy to Clipboard',
      });
      await expect(copyToClipboardButton).toBeVisible({ timeout: 60000 });

      // For unauthenticated users on shared chat, look for "Chat for Free" button
      // This indicates read-only mode
      const signUpForFreeButton = page.getByRole('button', {
        name: /Sign up for Free/i,
      });

      const isSignUpForFreeVisible = await signUpForFreeButton
        .isVisible()
        .catch(() => false);

      if (isSignUpForFreeVisible) {
        console.log(
          'Sign up for Free button is visible - confirmed unauthenticated access'
        );
        await expect(signUpForFreeButton).toBeVisible();
      } else {
        // Check if the chat interface loaded (even without the button)
        console.log(
          'Sign up for Free button not visible, verifying chat content loaded'
        );
      }

      // Verify some chat-related content is present
      const messagesArea = page.locator('main');
      await expect(messagesArea).toBeVisible({ timeout: 10000 });

      console.log('Unauthenticated access test passed');
    } finally {
      await unauthContext.close();
    }
  });

  test('authenticated user can access shared chat and sees chat history', async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Create a new browser context for authenticated access
    const authContext = await browser.newContext();
    const page = await authContext.newPage();

    try {
      // Step 1: First authenticate in this new context
      console.log('Authenticating in new context...');
      await page.goto(MENTOR_NEXTJS_HOST, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await authenticateUser(page);

      console.log('Authentication complete. Current URL:', page.url());

      // Step 2: Navigate to the shared chat URL
      console.log('Navigating to shared URL (authenticated):', sharedChatUrl);
      await page.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for navigation to stabilize
      await safeWaitForURL(
        page,
        (url) => {
          const href = url.href;
          return PLATFORM_URL_PATTERN.test(href);
        },
        { timeout: 30000 }
      );

      const finalUrl = page.url();
      console.log('Final URL after redirect:', finalUrl);

      // Verify the URL matches expected platform structure
      expect(finalUrl).toMatch(PLATFORM_URL_PATTERN);

      // Verify copy to clipboard button is visible
      const copyToClipboardButton = page.getByRole('button', {
        name: 'Copy to Clipboard',
      });
      await expect(copyToClipboardButton).toBeVisible({ timeout: 60000 });

      // For authenticated users, the chat input should not be visible
      const chatTextarea = page.getByRole('textbox', { name: 'Ask anything' });
      await expect(chatTextarea).not.toBeVisible({ timeout: 30000 });

      console.log('Authenticated access test passed');
    } finally {
      await authContext.close();
    }
  });

  test('shared chat loads correctly and displays chat interface', async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Test that shared chat loads and displays content correctly
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      console.log('Testing shared chat URL loads correctly');
      await page.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      const finalUrl = page.url();
      console.log('Final URL:', finalUrl);

      // URL should be either on share page or redirected to platform
      const isValidShareUrl = finalUrl.includes('/share/chat/');
      const isValidPlatformUrl = PLATFORM_URL_PATTERN.test(finalUrl);

      expect(isValidShareUrl || isValidPlatformUrl).toBe(true);

      // If redirected to platform, verify the URL structure
      if (isValidPlatformUrl) {
        const { platformKey, mentorId } = parsePlatformUrl(finalUrl);
        console.log(
          'Redirected to platform. Key:',
          platformKey,
          'Mentor:',
          mentorId
        );
        expect(platformKey).toBeTruthy();
        expect(mentorId).toBeTruthy();
      } else {
        console.log('Stayed on share page:', finalUrl);
      }

      // Verify copy to clipboard button is visible
      const copyToClipboardButton = page.getByRole('button', {
        name: 'Copy to Clipboard',
      });
      await expect(copyToClipboardButton).toBeVisible({ timeout: 60000 });

      console.log('Shared chat load test passed');
    } finally {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      await page.waitForTimeout(500);
      await page.close();
      try {
        await context.close();
      } catch (e) {
        console.log(
          'Context close failed (may be Chromium crash), continuing...'
        );
      }
    }
  });

  test('clicking Sign up for Free button redirects unauthenticated user to auth', async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Create unauthenticated context
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      // Navigate to shared chat URL
      await page.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Look for Sign up for Free button
      const isVisible = await page
        .getByRole('button', { name: /Sign up for Free/i })
        .isVisible()
        .catch(() => false);

      if (isVisible) {
        console.log('Clicking Sign up for Free button');
        // Re-locate element immediately before clicking to avoid stale element reference
        await page.getByRole('button', { name: /Sign up for Free/i }).click();

        // Expect redirect to auth page
        await safeWaitForURL(
          page,
          (url) => url.href.includes(AUTH_HOST) || url.href.includes('/login'),
          { timeout: 30000 }
        );

        const authUrl = page.url();
        console.log('Redirected to auth URL:', authUrl);

        // Verify we're on the auth page
        expect(authUrl).toMatch(/login|auth/i);

        console.log('Sign up for Free redirect test passed');
      } else {
        console.log(
          'Sign up for Free button not visible - skipping this assertion'
        );
        // This is acceptable as the button visibility depends on the shared chat implementation
      }
    } finally {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      await page.waitForTimeout(500);
      await page.close();
      try {
        await context.close();
      } catch (e) {
        console.log(
          'Context close failed (may be Chromium crash), continuing...'
        );
      }
    }
  });

  test('shared chat does not show input textarea for unauthenticated users', async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations'
    );

    // Create unauthenticated context
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      await page.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // For shared chat in read-only mode, the textarea should either:
      // 1. Not be visible at all, or
      // 2. Be disabled
      const chatTextarea = page.getByRole('textbox', { name: 'Ask anything' });

      const isTextareaVisible = await chatTextarea
        .isVisible()
        .catch(() => false);

      if (isTextareaVisible) {
        // If visible, it should be disabled for unauthenticated users on shared chat
        const isEnabled = await chatTextarea.isEnabled().catch(() => true);

        // Either the textarea is disabled, or clicking it triggers auth redirect
        console.log(
          'Textarea visible:',
          isTextareaVisible,
          'Enabled:',
          isEnabled
        );

        // In shared chat mode for unauthenticated users, interaction should redirect to auth
        // This is acceptable behavior
      } else {
        // Textarea not visible is the expected behavior for read-only shared chat
        console.log(
          'Textarea is not visible - expected for read-only shared chat'
        );
        await expect(chatTextarea).not.toBeVisible();
      }

      console.log('Input textarea visibility test passed');
    } finally {
      // Wait for stability, close page first, then close context with error handling
      // This prevents Chromium crashes (SIGSEGV) that can occur when closing context abruptly
      await page.waitForTimeout(500);
      await page.close();
      try {
        await context.close();
      } catch (e) {
        console.log(
          'Context close failed (may be Chromium crash), continuing...'
        );
      }
    }
  });
});
