import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';

/**
 * Journey 104 — A blocked message shows the agent's saved response
 * (iblai/iblai-platform#2883).
 *
 * When moderation or safety blocks a prompt the server sends one websocket
 * frame `{error, kind: "innappropriate_prompt", target_system, status_code,
 * reason, appropriate: false}` and closes the socket. `error` is the agent's
 * saved Moderation Response (a string) or Safety Response (wrapped in a
 * list). The chat must show it as a normal agent reply: no error toast, the
 * internal `reason` never visible, and the next message still sends on a new
 * socket. Only the websocket is mocked; the saved responses are written
 * through the real Safety tab on a throwaway agent.
 */

const REASON = 'REASON-CANARY classifier flagged category self-harm';
const STAMP = Date.now();
const MODERATION_TEXT = `Moderation reply ${STAMP}: please keep it respectful.`;
const SAFETY_TEXT = `Safety reply ${STAMP}: I cannot help with that request.`;

type MockSocket = {
  connections: () => number;
  nextClientMessage: () => Promise<Record<string, unknown>>;
  send: (frame: Record<string, unknown>) => void;
  closeFromServer: () => void;
};

async function mockChatSocket(page: Page): Promise<MockSocket> {
  let current: WebSocketRoute | undefined;
  let count = 0;
  const queue: Record<string, unknown>[] = [];
  const waiters: Array<(m: Record<string, unknown>) => void> = [];
  await page.routeWebSocket('**/ws/langflow/**', (ws) => {
    current = ws;
    count += 1;
    ws.onMessage((raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const waiter = waiters.shift();
        if (waiter) waiter(parsed);
        else queue.push(parsed);
      } catch {
        // not a JSON frame
      }
    });
  });
  return {
    connections: () => count,
    nextClientMessage: () =>
      queue.length
        ? Promise.resolve(queue.shift()!)
        : new Promise((resolve) => waiters.push(resolve)),
    send: (frame) => {
      if (!current) throw new Error('chat socket not open yet');
      current.send(JSON.stringify(frame));
    },
    closeFromServer: () => current?.close(),
  };
}

function blockFrame(
  target: 'moderation' | 'safety',
  error: string | string[],
): Record<string, unknown> {
  return {
    error,
    kind: 'innappropriate_prompt',
    target_system: target,
    status_code: 400,
    reason: REASON,
    appropriate: false,
  };
}

test.describe.configure({ mode: 'serial', timeout: 240_000 });

test.describe('Journey 104: Blocked message shows the saved response', () => {
  const tracker = new MentorTracker();
  let agentUrl = '';

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  async function openChat(page: Page): Promise<MockSocket> {
    const ws = await mockChatSocket(page);
    await page.goto(agentUrl, { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    return ws;
  }

  async function expectCleanReply(
    page: Page,
    chatPage: { getLastAiMessage: () => ReturnType<Page['locator']> },
    expected: string,
    partial?: string,
  ): Promise<void> {
    const reply = chatPage.getLastAiMessage();
    await expect(reply).toHaveText(expected, { timeout: 20_000 });
    if (partial) await expect(reply).not.toContainText(partial);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('REASON-CANARY');
  }

  test('sfr-01: admin saves Moderation and Safety responses on a new agent and the Safety tab shows them', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);
    agentUrl = page.url();

    await editMentorPage.open('Safety');
    await editMentorPage.safety.setModerationResponse(MODERATION_TEXT);
    await editMentorPage.safety.setSafetyResponse(SAFETY_TEXT);
    await editMentorPage.safety.expectModerationResponse(MODERATION_TEXT);
    await editMentorPage.safety.expectSafetyResponse(SAFETY_TEXT);
    await editMentorPage.close();
  });

  test('sfr-02: a moderation block shows the saved Moderation Response as the agent reply, with no toast and no reason', async ({
    page,
    chatPage,
  }) => {
    const ws = await openChat(page);
    await chatPage.sendMessage('moderated prompt');
    await ws.nextClientMessage();
    ws.send(blockFrame('moderation', MODERATION_TEXT));
    ws.closeFromServer();
    await expectCleanReply(page, chatPage, MODERATION_TEXT);
  });

  test('sfr-03: a safety block shows the saved Safety Response (list-wrapped on the wire) as the agent reply, with no toast and no reason', async ({
    page,
    chatPage,
  }) => {
    const ws = await openChat(page);
    await chatPage.sendMessage('unsafe prompt');
    await ws.nextClientMessage();
    ws.send(blockFrame('safety', [SAFETY_TEXT]));
    ws.closeFromServer();
    await expectCleanReply(page, chatPage, SAFETY_TEXT);
  });

  test('sfr-04: after a block the next message goes out on a new socket and is answered normally', async ({
    page,
    chatPage,
  }) => {
    const ws = await openChat(page);
    await chatPage.sendMessage('blocked first');
    await ws.nextClientMessage();
    ws.send(blockFrame('moderation', MODERATION_TEXT));
    ws.closeFromServer();
    await expectCleanReply(page, chatPage, MODERATION_TEXT);
    const before = ws.connections();

    await chatPage.sendMessage('a friendly follow-up');
    const second = await ws.nextClientMessage();
    expect(second.prompt).toBe('a friendly follow-up');
    expect(ws.connections()).toBeGreaterThan(before);

    const sid = second.session_id as string;
    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    ws.send({ data: 'Happy to help with that.', session_id: sid });
    ws.send({ eos: true, session_id: sid });
    await expect(chatPage.getLastAiMessage()).toHaveText(
      'Happy to help with that.',
      { timeout: 20_000 },
    );
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
  });

  test('sfr-05: a block arriving mid-stream replaces the partial answer with the saved response', async ({
    page,
    chatPage,
  }) => {
    const ws = await openChat(page);
    await chatPage.sendMessage('prompt that goes bad midway');
    const msg = await ws.nextClientMessage();
    const sid = msg.session_id as string;
    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sid });
    ws.send({ data: 'PARTIAL-ANSWER being streamed', session_id: sid });
    await expect(chatPage.getLastAiMessage()).toContainText('PARTIAL-ANSWER', {
      timeout: 15_000,
    });
    ws.send(blockFrame('safety', [SAFETY_TEXT]));
    ws.closeFromServer();
    await expectCleanReply(page, chatPage, SAFETY_TEXT, 'PARTIAL-ANSWER');
  });
});
