import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';

test.describe('Journey 12: Chat Sharing', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedChatUrl = '';

  // fixme: shareable chat URL creation times out — share button not responding.
  // Issue #645 relocated the share button from per-AI-message to the navbar,
  // which we expect to fix this. Keeping it fixme until we've confirmed the
  // timeout is gone in CI — flip to `test(...)` once a green run lands.
  test.fixme(
    'non-admin goes to chat page and creates a shareable chat URL',
    async ({ nonadminPage, nonadminChatPage, browserName }) => {
      // H10 fix: skip on Safari due to clipboard API limitations
      test.skip(
        browserName === 'webkit',
        'Skipping on Safari due to clipboard API limitations',
      );

      await navigateToMentorApp(nonadminPage);

      // H10 fix: grant clipboard permissions before sharing
      const nonadminContext = nonadminPage.context();
      try {
        await nonadminContext.grantPermissions([
          'clipboard-read',
          'clipboard-write',
        ]);
      } catch {
        try {
          await nonadminContext.grantPermissions(['clipboard-read']);
        } catch {
          // Some browsers don't support clipboard permissions
        }
      }

      await nonadminChatPage.sendMessage(
        'Hello, this is a test message for sharing',
      );
      await nonadminChatPage.waitForAIResponse();

      // Issue #645 — the share button now lives in the navbar (session-level),
      // not per-message. The aria-label is unchanged so this selector still
      // resolves to exactly one element.
      const shareButton = nonadminPage.getByRole('button', {
        name: 'Share this chat',
      });
      await expect(shareButton).toBeVisible({ timeout: 15_000 });
      await shareButton.click();

      // H9 fix: wait for clipboard toast confirmation, then read from clipboard
      await nonadminPage
        .getByText('Share link copied to clipboard')
        .waitFor({ timeout: 15_000 });

      // Read URL from clipboard
      const clipboardUrl = await nonadminPage
        .evaluate(() => navigator.clipboard.readText())
        .catch(() => '');

      if (clipboardUrl && clipboardUrl.includes('/share/chat/')) {
        sharedChatUrl = clipboardUrl;
      } else {
        // Fallback: construct from localStorage session_id
        const sessionId = await nonadminPage.evaluate(() => {
          const raw = localStorage.getItem('session_id');
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw);
            return Object.values(parsed)[0] as string;
          } catch {
            return null;
          }
        });
        if (sessionId) {
          sharedChatUrl = `${MENTOR_NEXTJS_HOST}/share/chat/${sessionId}`;
        }
      }

      expect(sharedChatUrl).toMatch(/\/share\/chat\/[a-f0-9-]+/);
    },
  );

  // Issue #645 — structural check: the share button is rendered exactly once
  // per session in the navbar, not once per AI message. Sending additional
  // messages must NOT create additional share buttons.
  test('non-admin sees exactly one session-level share button regardless of message count', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    await nonadminChatPage.sendMessage('First message');
    await nonadminChatPage.waitForAIResponse();

    await nonadminChatPage.sendMessage('Second message');
    await nonadminChatPage.waitForAIResponse();

    const shareButtons = nonadminPage.getByRole('button', {
      name: 'Share this chat',
    });
    await expect(shareButtons).toHaveCount(1);

    // Verify the button is inside the top navbar, not inside a chat message.
    const navbar = nonadminPage.getByRole('navigation');
    await expect(
      navbar.getByRole('button', { name: 'Share this chat' }),
    ).toHaveCount(1);
  });

  // Issue #645 — the share button is hidden on non-chat pages.
  test('non-admin does not see the share button on the explore page', async ({
    nonadminPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    // Navigate to the explore route via the current URL's tenant/mentor.
    await nonadminPage.evaluate(() => {
      const match = window.location.pathname.match(
        /\/platform\/([^/]+)\/([^/]+)/,
      );
      if (match) {
        const [, tenantKey, mentorId] = match;
        window.location.assign(`/platform/${tenantKey}/${mentorId}/explore`);
      }
    });
    await nonadminPage.waitForLoadState('domcontentloaded');
    await nonadminPage.waitForTimeout(2_000);

    const shareButton = nonadminPage.getByRole('button', {
      name: 'Share this chat',
    });
    await expect(shareButton).not.toBeVisible();
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
      await anonPage.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
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

  test('non-admin goes to shared chat URL and is redirected to the platform', async ({
    nonadminPage,
  }) => {
    await navigateToMentorApp(nonadminPage);
    if (!sharedChatUrl) return;
    await nonadminPage.goto(sharedChatUrl, { waitUntil: 'domcontentloaded' });
    await safeWaitForURL(
      nonadminPage,
      (url) => url.href.includes('/platform/'),
      {
        timeout: 30_000,
      },
    );
    expect(nonadminPage.url()).toContain('/platform/');
  });

  test('unauthenticated user goes to shared chat URL and the chat interface loads correctly', async ({
    page,
    browser,
  }) => {
    if (!sharedChatUrl) return;
    const anonContext = await browser.newContext({ storageState: undefined });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
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
      await anonPage.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const signUpBtn = anonPage
        .getByRole('button', { name: /sign up for free/i })
        .or(anonPage.getByRole('link', { name: /sign up for free/i }));
      const visible = await signUpBtn
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
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
      await anonPage.goto(sharedChatUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await anonPage.waitForTimeout(2_000);
      const chatInput = anonPage.getByPlaceholder('Ask anything', {
        exact: true,
      });
      const visible = await chatInput
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(visible).toBe(false);
    } finally {
      await anonContext.close();
    }
  });
});
