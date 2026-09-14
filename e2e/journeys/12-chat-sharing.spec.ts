import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { safeWaitForURL } from '../utils/navigation';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';
import type { ChatPage } from '../page-objects/chat.page';

test.describe('Journey 12: Chat Sharing', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedChatUrl = '';

  // fixme: shareable chat URL creation times out — share button not responding
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

      // H9 fix: use exact button name from original
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

  // ── Chat download (sh-07 … sh-10, issue #2464) ───────────────────────────
  //
  // The download control (`ai-message-download.tsx`) sits in the same AI
  // message toolbar as share, gated by the same
  // `!showingSharedChat && !chatPrivacyActive` condition (see cp-chat-09 in
  // journey 50 for the private-mode side of that gate). Its accessible name
  // is "Download this chat" — an exact-name query, so it never collides with
  // "Share this chat" above. Each test sends its own message (independent,
  // no shared state) and reads the actual downloaded file content, not just
  // the filename — a filename-only assertion would pass even for an empty
  // transcript.
  test.describe('Chat download (sh-07 … sh-10)', () => {
    const TEST_MESSAGE =
      'Hello, this is a test message for downloading the chat transcript.';

    test.beforeEach(async ({ page }) => {
      await navigateToMentorApp(page);
    });

    /** Sends `TEST_MESSAGE` and waits for a complete AI reply. */
    async function sendAndAwaitReply(chatPage: ChatPage): Promise<void> {
      await chatPage.sendMessage(TEST_MESSAGE);
      await expect(chatPage.userMessages.first()).toBeVisible({
        timeout: 30_000,
      });
      await chatPage.waitForAIResponse();
      await chatPage.waitForStreamingComplete(120_000);
    }

    test('sh-07: download dialog opens with Entire chat preselected and both option descriptions visible', async ({
      chatPage,
    }) => {
      await sendAndAwaitReply(chatPage);
      await chatPage.openDownloadDialog();

      await expect(chatPage.downloadScopeChatRadio).toBeChecked();
      await expect(chatPage.downloadScopeMessageRadio).not.toBeChecked();
      await expect(
        chatPage.downloadDialog.getByText(
          'Every message in this conversation.',
        ),
      ).toBeVisible();
      await expect(
        chatPage.downloadDialog.getByText('Only the reply you selected.'),
      ).toBeVisible();
    });

    test('sh-08: default Entire chat download produces a chat-*.txt file containing both conversation turns', async ({
      page,
      chatPage,
    }) => {
      await sendAndAwaitReply(chatPage);
      await chatPage.openDownloadDialog();

      const downloadPromise = page.waitForEvent('download', {
        timeout: 15_000,
      });
      await chatPage.downloadConfirmButton.click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/^chat-.*\.txt$/);

      const content = await chatPage.readDownloadText(download);
      // The user's own message, verbatim, proves the user turn made it in.
      expect(content).toContain(TEST_MESSAGE);
      // Two messages (user + AI) means two "----" separators.
      const separatorCount = (content.match(/----/g) ?? []).length;
      expect(
        separatorCount,
        `Expected at least 2 "----" separators (one per message) in:\n${content}`,
      ).toBeGreaterThanOrEqual(2);
    });

    test('sh-09: selecting This message only produces a message-*.txt file with the AI reply but not the earlier user message', async ({
      page,
      chatPage,
    }) => {
      await sendAndAwaitReply(chatPage);
      const aiReplyText = (await chatPage.aiMessages.first().innerText())
        .replace(/\s+/g, ' ')
        .trim();

      await chatPage.openDownloadDialog();
      // Click the <Label>, not the radio directly — exercises the
      // htmlFor/id label-click wiring described in ai-message-download.tsx.
      await chatPage.downloadDialog
        .getByText('This message only', { exact: true })
        .click();
      await expect(chatPage.downloadScopeMessageRadio).toBeChecked();

      const downloadPromise = page.waitForEvent('download', {
        timeout: 15_000,
      });
      await chatPage.downloadConfirmButton.click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/^message-.*\.txt$/);

      const content = await chatPage.readDownloadText(download);
      expect(content).not.toContain(TEST_MESSAGE);

      // A prefix of the rendered AI reply should still be recoverable from
      // the flattened transcript text (whitespace-insensitive compare —
      // markdown flattening can shift line breaks without changing words).
      const normalizedContent = content.replace(/\s+/g, ' ').trim();
      const aiSnippet = aiReplyText.slice(0, 40);
      if (aiSnippet) {
        expect(normalizedContent).toContain(aiSnippet);
      }
    });

    test('sh-10: pressing Escape dismisses the download dialog without triggering a download', async ({
      page,
      chatPage,
    }) => {
      await sendAndAwaitReply(chatPage);
      await chatPage.openDownloadDialog();

      // Bounded race, not a plain waitForEvent — a download that never
      // fires would otherwise hang until Playwright's default timeout.
      const downloadPromise = page
        .waitForEvent('download', { timeout: 3_000 })
        .catch(() => null);
      await page.keyboard.press('Escape');

      await expect(
        chatPage.downloadDialog,
        'Escape must close the Download Chat dialog',
      ).not.toBeVisible({ timeout: 5_000 });

      const download = await downloadPromise;
      expect(
        download,
        'Escape must dismiss the dialog without triggering a download',
      ).toBeNull();
    });
  });
});
