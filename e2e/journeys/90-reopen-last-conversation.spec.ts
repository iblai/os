/**
 * Journey 90 — Reopen last conversation (iblai/iblai-platform#2629)
 *
 * Per-agent `show_last_conversation` (Edit agent › Settings › Capabilities ›
 * "Reopen last conversation"). When on and the chat opens with no session
 * held in memory, the SDK reads the first row of the sidebar's own query
 * `GET .../recent-messages/?limit=10&offset=0&mentor=<id>` (shared by RTK, no
 * dedicated `limit=1` request) and reopens that session instead of minting one
 * (no `POST .../sessions/`).
 * The device cache (`localStorage.session_id`, key `${tenantKey}:${mentorId}`)
 * is cleared before each reload so the lookup is what restores the chat.
 *
 * Checkpoints run in flow order (rlc-09/10 before rlc-05, rlc-08 before
 * rlc-06) so each uses the agent in the state it needs. Two throw-away agents (cheap ibl.ai model, tracked and deleted by
 * `createWithName`) are shared by the serial checkpoints; two real messages
 * are sent in total. rlc-07 is API-level: a member may read public settings
 * but PUT settings is refused.
 */

import type { Page, Request } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import type { ChatPage } from '../page-objects/chat.page';

const FIRST_MESSAGE = 'Reply with the single word: alpha';
const SECOND_MESSAGE = 'Reply with the single word: bravo';
const SHARED_MESSAGE = 'Shared transcript question from the link';
const REOPEN_TIMEOUT = 45_000;

function isRecentMessagesGet(req: Request): boolean {
  return (
    req.method() === 'GET' &&
    new URL(req.url()).pathname.includes('/recent-messages/')
  );
}

// The offset-0 mentor-scoped page the sidebar and the reopen share.
function isReopenLookup(req: Request, mentorId: string): boolean {
  if (!isRecentMessagesGet(req)) return false;
  const params = new URL(req.url()).searchParams;
  return (
    params.get('mentor') === mentorId &&
    (params.get('offset') ?? '0') === '0' &&
    params.get('limit') !== '1'
  );
}

function isLimitOneLookup(req: Request): boolean {
  return (
    isRecentMessagesGet(req) &&
    new URL(req.url()).searchParams.get('limit') === '1'
  );
}

function watchSessionRequests(page: Page, mentorId: string) {
  const lookups: string[] = [];
  const limitOnes: string[] = [];
  const mints: string[] = [];
  page.on('request', (req) => {
    if (isReopenLookup(req, mentorId)) lookups.push(req.url());
    if (isLimitOneLookup(req)) limitOnes.push(req.url());
    if (
      req.method() === 'POST' &&
      /\/sessions\/$/.test(new URL(req.url()).pathname)
    ) {
      mints.push(req.url());
    }
  });
  return { lookups, limitOnes, mints };
}

async function reloadWithoutDeviceSession(
  page: Page,
  chatPage: ChatPage,
  mentorId: string,
): Promise<void> {
  await chatPage.forgetCachedSession(mentorId);
  const browserName = page.context().browser()?.browserType().name();
  await page.reload({
    waitUntil: browserName === 'webkit' ? 'load' : 'domcontentloaded',
    timeout: 60_000,
  });
  await waitForPageReady(page);
}

async function saveShowLastConversation(
  page: Page,
  editMentorPage: EditMentorPage,
  target: boolean,
) {
  await editMentorPage.open('Settings');
  await waitForPageReady(page);
  const saved = await editMentorPage.settings.setShowLastConversation(target);
  expect(saved, `the toggle was not already ${target}`).not.toBeNull();
  expect(saved!.ok, 'the settings save is accepted').toBe(true);
  await editMentorPage.close();
  return saved!;
}

test.describe.serial('Journey 90: Reopen last conversation', () => {
  test.setTimeout(240_000);

  let mentorUrl = '';
  let settingsUrl = '';
  let untouchedMentorUrl = '';
  let firstSessionId = '';

  test.beforeEach(() => {
    if (test.info().title.startsWith('rlc-01')) return;
    test.skip(!mentorUrl, 'rlc-01 setup did not run');
  });

  test('rlc-01: admin turns on "Reopen last conversation" under Settings › Capabilities and Save sends show_last_conversation=true', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
      return;
    }

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    const saved = await saveShowLastConversation(page, editMentorPage, true);
    expect(saved.body).toMatch(
      /name="show_last_conversation"\r?\n\r?\ntrue|"show_last_conversation"\s*:\s*true/,
    );
    settingsUrl = saved.url;

    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.selectSubTab('Capabilities');
    await expect(
      editMentorPage.settings.showLastConversationToggle,
    ).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await editMentorPage.close();
  });

  test('rlc-02: with no session held, reopening the agent reads the first row of the sidebar recent-messages request and shows it without minting a session', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    const { mentorId } = await getPlatformContext(page);

    await chatPage.sendMessage(FIRST_MESSAGE);
    await chatPage.waitForStreamingComplete();
    await chatPage.waitForUserMessage(FIRST_MESSAGE);
    firstSessionId = (await chatPage.getCachedSessionId(mentorId)) ?? '';
    expect(firstSessionId, 'the first conversation has a session').not.toBe('');

    const seen = watchSessionRequests(page, mentorId);
    await reloadWithoutDeviceSession(page, chatPage, mentorId);

    await chatPage.waitForUserMessage(FIRST_MESSAGE, REOPEN_TIMEOUT);
    expect(seen.lookups, 'the offset-0 lookup ran').not.toHaveLength(0);
    expect(seen.limitOnes, 'no dedicated limit=1 request').toEqual([]);
    expect(seen.mints, 'no new session is minted').toEqual([]);
  });

  test('rlc-03: "New Chat" starts a fresh chat with the welcome screen and no old message', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    await chatPage.waitForUserMessage(FIRST_MESSAGE, REOPEN_TIMEOUT);

    await chatPage.startNewChat();
    await expect(chatPage.userMessages).toHaveCount(0, { timeout: 15_000 });
    await expect(chatPage.getComposerTextarea()).toBeVisible();
  });

  test('rlc-04: with two conversations, the newest one reopens', async ({
    page,
    chatPage,
  }) => {
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    const { mentorId } = await getPlatformContext(page);

    await chatPage.startNewChat();
    await expect(chatPage.userMessages).toHaveCount(0, { timeout: 15_000 });
    await chatPage.sendMessage(SECOND_MESSAGE);
    await chatPage.waitForStreamingComplete();
    await chatPage.waitForUserMessage(SECOND_MESSAGE);

    await reloadWithoutDeviceSession(page, chatPage, mentorId);

    await chatPage.waitForUserMessage(SECOND_MESSAGE, REOPEN_TIMEOUT);
    await expect(
      chatPage.userMessages.filter({ hasText: FIRST_MESSAGE }),
    ).toHaveCount(0);
  });

  test('rlc-09: with the setting on, opening a shared chat link shows the shared conversation, not the last one, and mints no session', async ({
    page,
  }) => {
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);

    const sharedId = `e2e-rlc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.route(
      `**/api/ai-mentor/orgs/*/users/*/sessions/${sharedId}/shared/**`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: 2,
            title: 'E2E shared chat',
            is_shared: true,
            proactive_prompt: '',
            mentor_unique_id: mentorId,
            platform_key: tenantKey,
            previous: null,
            next: null,
            results: [
              {
                id: `e2e-msg-h-${Date.now()}`,
                type: 'human',
                content: SHARED_MESSAGE,
                timestamp: new Date().toISOString(),
              },
              {
                id: `e2e-msg-a-${Date.now()}`,
                type: 'ai',
                content: 'shared answer',
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        }),
    );

    const seen = watchSessionRequests(page, mentorId);
    await page.goto(`${MENTOR_NEXTJS_HOST}/share/chat/${sharedId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    await page.waitForURL(/\/platform\//, { timeout: 60_000 });
    await expect(
      page.locator('.chat-user-message-query', { hasText: SHARED_MESSAGE }),
    ).toBeVisible({ timeout: REOPEN_TIMEOUT });
    await expect(
      page.locator('.chat-user-message-query', { hasText: SECOND_MESSAGE }),
    ).toHaveCount(0);
    expect(seen.limitOnes, 'no limit=1 request').toEqual([]);
    expect(seen.mints, 'no session is minted for a shared chat').toEqual([]);
  });

  test('rlc-10: with the setting on, a link carrying a session id opens that conversation, not the latest, and mints no session', async ({
    page,
    chatPage,
  }) => {
    test.skip(!firstSessionId, 'rlc-02 did not capture a session');
    await navigateToMentorApp(page, mentorUrl);
    const { mentorId } = await getPlatformContext(page);

    const seen = watchSessionRequests(page, mentorId);
    await page.goto(
      `${mentorUrl}?chat-action=voice-call&session-id=${firstSessionId}`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 },
    );
    await waitForPageReady(page);

    await chatPage.waitForUserMessage(FIRST_MESSAGE, REOPEN_TIMEOUT);
    await expect(
      chatPage.userMessages.filter({ hasText: SECOND_MESSAGE }),
    ).toHaveCount(0);
    expect(await chatPage.getCachedSessionId(mentorId)).toBe(firstSessionId);
    expect(seen.limitOnes, 'no limit=1 request').toEqual([]);
    expect(seen.mints, 'no session is minted').toEqual([]);
  });

  test('rlc-05: turning the setting off keeps the open chat; the next open is fresh and mints a session', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    const { mentorId } = await getPlatformContext(page);
    await chatPage.waitForUserMessage(SECOND_MESSAGE, REOPEN_TIMEOUT);

    await saveShowLastConversation(page, editMentorPage, false);
    await chatPage.waitForUserMessage(SECOND_MESSAGE, 15_000);

    const seen = watchSessionRequests(page, mentorId);
    await reloadWithoutDeviceSession(page, chatPage, mentorId);

    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    await expect(chatPage.userMessages).toHaveCount(0);
    await expect
      .poll(() => seen.mints.length, { timeout: 30_000 })
      .toBeGreaterThan(0);
    expect(seen.limitOnes, 'no limit=1 request').toEqual([]);
  });

  test('rlc-08: an agent whose setting was never touched opens as before: a new session is minted, composer usable', async ({
    page,
    chatPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    untouchedMentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    const seen = watchSessionRequests(page, mentorId);
    await reloadWithoutDeviceSession(page, chatPage, mentorId);

    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    await expect(chatPage.getComposerTextarea()).toBeEnabled();
    await expect(chatPage.userMessages).toHaveCount(0);
    await expect
      .poll(() => seen.mints.length, { timeout: 30_000 })
      .toBeGreaterThan(0);
    expect(seen.limitOnes, 'no limit=1 request').toEqual([]);
  });

  test('rlc-06: a new agent with the setting on and no history opens the welcome screen without an error', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    test.skip(!untouchedMentorUrl, 'rlc-08 setup did not run');
    await navigateToMentorApp(page, untouchedMentorUrl);
    await waitForPageReady(page);
    const { mentorId } = await getPlatformContext(page);

    await saveShowLastConversation(page, editMentorPage, true);

    const lookup = page.waitForRequest((req) => isReopenLookup(req, mentorId), {
      timeout: 60_000,
    });
    await reloadWithoutDeviceSession(page, chatPage, mentorId);

    await lookup;
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    await expect(chatPage.userMessages).toHaveCount(0);
    await expect(page.getByText(/Sorry about that!/i)).toHaveCount(0);
  });

  test('rlc-07: a member can read the agent public settings but is refused (403) when saving agent settings', async ({
    nonadminPage,
  }) => {
    test.skip(!settingsUrl, 'rlc-01 setup did not run');
    const publicSettings = nonadminPage.waitForRequest(
      (req) =>
        req.method() === 'GET' && req.url().includes('/public-settings/'),
      { timeout: 60_000 },
    );
    await navigateToMentorApp(nonadminPage, mentorUrl);
    const request = await publicSettings;
    const authorization = (await request.allHeaders())['authorization'];
    expect(authorization, 'public settings are read signed-in').toBeTruthy();
    const headers = { authorization };

    const read = await nonadminPage.request.get(request.url(), { headers });
    expect(read.ok()).toBe(true);

    const write = await nonadminPage.request.put(settingsUrl, {
      headers,
      data: { show_last_conversation: true },
    });
    expect(write.status()).toBe(403);
  });
});
