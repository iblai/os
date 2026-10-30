import path from 'path';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { parsePlatformUrl } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { ChatPage } from '../page-objects/chat.page';
import { MentorTracker } from '../utils/mentor-cleanup';

/**
 * Journey 97: Shareable-link chat frame carries its own token field
 * (iblai/iblai-platform#2743)
 *
 * Before the fix, opening `/platform/<tenant>/<agent>?token=<share token>`
 * made `useChat` (`@iblai/web-utils`) send the link in the chat frame's
 * `token` field with `token_type: "link"`, REPLACING the user's own
 * credential. Now the frame carries `shareable_link_token: <link>` and
 * `token` stays the user's own axd token (empty for an anonymous visitor);
 * no `token_type` is sent. A frame with no link has no `shareable_link_token`
 * key at all.
 *
 * The chat socket is mocked with `ChatPage.mockChatWebSocket()` so the
 * outbound frame can be asserted regardless of the backend deploy state. The
 * agent and its shareable link are real (created through the Embed tab, as
 * journey 64 does) so the page's own shareable-token lookup agrees with the
 * `?token=` in the URL.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Journey 97: Shareable-link chat frame token', () => {
  const tracker = new MentorTracker();
  let platformKey = '';
  let mentorId = '';
  let shareToken = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const ctx = await browser.newContext({ storageState: authFile });
    const setupPage = await ctx.newPage();
    try {
      await navigateToMentorApp(setupPage);
      await new CreateMentorPage(setupPage).openAndCreate(
        `E2E Share Frame ${Date.now()}`,
      );
      ({ platformKey, mentorId } = parsePlatformUrl(setupPage.url()));
      tracker.add(mentorId);

      const edit = new EditMentorPage(setupPage);
      await edit.open('Settings');
      await waitForPageReady(setupPage);
      await edit.settings.setVisibilityAnyone();
      await edit.settings.setChatAccessAnyone();
      await edit.settings.saveConfirmingAdminVisibility();

      await edit.navigateToTab('Embed');
      await waitForPageReady(setupPage);
      await edit.embed.enableShareableLink();
      shareToken = await edit.embed.getShareableLinkToken();
      expect(shareToken.length).toBeGreaterThan(0);
      await edit.close();
    } finally {
      await setupPage.close();
      await ctx.close();
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  const chatUrl = (withToken: boolean) =>
    `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}${
      withToken ? `?token=${encodeURIComponent(shareToken)}` : ''
    }`;

  async function openAndSend(chatPage: ChatPage, url: string, text: string) {
    const ws = await chatPage.mockChatWebSocket();
    await chatPage.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 60_000,
    });
    await chatPage.sendMessage(text);
    const frame = await ws.waitForClientMessage();
    expect(frame.prompt).toBe(text);
    return { ws, frame };
  }

  async function replyAndAssertRendered(
    chatPage: ChatPage,
    ws: Awaited<ReturnType<ChatPage['mockChatWebSocket']>>,
    frame: Record<string, unknown>,
    reply: string,
  ) {
    const sid = String(frame.session_id ?? '');
    ws.send({ generation_id: 'gen-97', session_id: sid });
    ws.send({ data: reply, session_id: sid });
    ws.send({ eos: true, session_id: sid });
    await expect(
      chatPage.page.locator('.chat-ai-message-response').filter({
        hasText: reply,
      }),
    ).toBeVisible({ timeout: 30_000 });
  }

  // slf-01: signed-in user keeps their own token; the link rides separately.
  test('signed-in user opens a shareable link and the chat frame carries shareable_link_token with their own token', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    const axd = await page.evaluate(() => localStorage.getItem('axd_token'));
    expect(axd, 'signed-in user must have an axd_token').toBeTruthy();

    const { frame } = await openAndSend(
      chatPage,
      chatUrl(true),
      'share link signed-in',
    );
    expect(frame.shareable_link_token).toBe(shareToken);
    expect(frame.token).toBe(axd);
    expect(frame.token).not.toBe(shareToken);
    expect(frame.token_type).not.toBe('link');
  });

  // slf-02: anonymous visitor sends the link in its own field, token empty.
  test.describe('anonymous visitor', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('anonymous visitor opens a shareable link and the chat frame carries shareable_link_token with no user token', async ({
      chatPage,
    }) => {
      const { ws, frame } = await openAndSend(
        chatPage,
        chatUrl(true),
        'share link anonymous',
      );
      expect(frame.shareable_link_token).toBe(shareToken);
      expect(frame.token ?? '').toBe('');
      expect(frame.token_type).not.toBe('link');
      await replyAndAssertRendered(
        chatPage,
        ws,
        frame,
        'Anonymous mocked reply 97',
      );
    });
  });

  // slf-03: no link, no shareable_link_token key.
  test('signed-in user chats without a shareable link and the frame has no shareable_link_token', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    const axd = await page.evaluate(() => localStorage.getItem('axd_token'));
    const { ws, frame } = await openAndSend(
      chatPage,
      chatUrl(false),
      'plain chat no link',
    );
    expect(frame).not.toHaveProperty('shareable_link_token');
    expect(frame.token).toBe(axd);
    await replyAndAssertRendered(chatPage, ws, frame, 'Plain mocked reply 97');
  });
});
