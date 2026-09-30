import type { Page } from '@playwright/test';
import path from 'path';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { ChatPage } from '../page-objects/chat.page';

/**
 * Journey 77: SDK Chat Migration — Stage 1 (issue #2586)
 *
 * The chat surface (`app/platform/[tenantKey]/[mentorId]/mentor-page-content.tsx`)
 * now renders the SDK `Chat` component (`@iblai/iblai-js/web-containers/next`)
 * via `components/chat/sdk-chat.tsx`, instead of OS's own
 * `components/chat/index.tsx` + `components/chat-input-form/*`. This journey
 * is the Tier 1 contract suite for that migration: the composer's attach
 * menu, session tools, the raw WebSocket send/stop/disconnect contract, and
 * single-session creation (see journey 02's nav-08/nav-09 for the latter).
 *
 * Live model replies are NOT available in this environment (the shared
 * ibl.ai free-tier model used by new e2e agents is currently rate-limited:
 * `TooManyRequestsResponseError: Rate limit exceeded:
 * free-models-per-day-high-balance`), so every test here scripts the chat
 * WebSocket via `ChatPage.mockChatWebSocket()` /
 * `mockStopGenerationWebSocket()` rather than waiting on a real reply — the
 * same technique journeys 68/70/73 already established. Frame shapes and
 * endpoints were confirmed by reading `@iblai/web-utils`'s `use-chat-v2.ts`
 * and `use-mentor-tools.ts`, and `@iblai/web-containers`'s
 * `upload-menu.tsx` / `file-attachments-list.tsx` / `web-search-button.tsx`
 * directly (source, not the bundled `dist/`).
 *
 * Like journey 73, all tests share one mentor (created once, in the first
 * test) via the serial-mode + cached-platform-context pattern — each test
 * still gets Playwright's default fresh page/context, so per-test WS/REST
 * mocks never leak across tests.
 */
test.describe('Journey 77: SDK Chat Migration — Stage 1', () => {
  test.describe.configure({ mode: 'serial' });

  let tenantKey = '';
  let mentorId = '';

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    if (!tenantKey || !mentorId) {
      await navigateToMentorApp(page);
      // createMentorPage.openAndCreate() already pins the mentor to the
      // suite-wide cheap ibl.ai model (see CreateMentorPage.pinLlm) and
      // registers it for run-level cleanup (resource-tracker.ts) — no extra
      // tracking needed here.
      await createMentorPage.openAndCreate();
      await waitForPageReady(page);
      ({ tenantKey, mentorId } = await getPlatformContext(page));

      // The Web Search composer chip only renders when the mentor-level
      // "Web Search" tool is enabled (Tools tab) — see journey 52's 1.5,
      // which asserts the opposite (no tool enabled -> chip absent).
      await editMentorPage.open('Tools');
      await waitForPageReady(page);
      await editMentorPage.tools.enableTool('Web Search');
      await editMentorPage.close();
    }
  });

  /** Navigates to the (cached) mentor's chat page and waits for the shell. */
  async function gotoReadyChat(page: Page, chatPage: ChatPage) {
    await chatPage.gotoChat(MENTOR_NEXTJS_HOST, tenantKey, mentorId);
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
  }

  const FILES_DIR = path.resolve(__dirname, '../../e2e/files/testing_folder');
  const ATTACHMENT_FILE = path.join(FILES_DIR, 'acessibility png.png');
  const ATTACHMENT_FILE_SIZE = 175_487; // bytes — see e2e/files/testing_folder

  // scm-01: the composer's Attach-file dropdown exposes both implemented
  // upload paths.
  test('admin opens the composer attach menu and sees Upload File and Camera options', async ({
    page,
    chatPage,
  }) => {
    await gotoReadyChat(page, chatPage);
    await chatPage.openAttachMenu();
    await expect(chatPage.getAttachMenuItem('Upload File')).toBeVisible();
    await expect(chatPage.getAttachMenuItem('Camera')).toBeVisible();
  });

  // scm-02: enabling/disabling a session tool (Web Search) flips the chip's
  // aria-pressed state and PUTs the tools array to the session-update REST
  // endpoint. Per `use-chat-v2.ts`'s `sendMessage`, enabled tools are NOT
  // resent in the outgoing WS frame — they're session-scoped, read back by
  // the backend from this same PUT per `session_id` — so this is a REST-only
  // contract, not a WS one.
  test('admin enables and disables the Web Search tool, PUTting the session tools list both ways', async ({
    page,
    chatPage,
  }) => {
    await gotoReadyChat(page, chatPage);

    // A session can inherit the mentor's currently-enabled tool set as its
    // initial active tools, and there can be a brief delay before that
    // inherited default settles — so a fresh session isn't reliably (or
    // immediately) "off". Retry disabling until it actually sticks, rather
    // than asserting a single-shot baseline, so a late-arriving default
    // sync doesn't silently undo a disable issued just before it landed.
    await expect(async () => {
      if (await chatPage.isToolActive('Web Search')) {
        await chatPage.disableTool('Web Search');
      }
      expect(await chatPage.isToolActive('Web Search')).toBe(false);
    }).toPass({ timeout: 30_000 });

    // Timeouts here exceed enableTool/disableTool's own ~20s
    // click-until-it-holds retry budget (see `setToolState`) — that budget
    // can legitimately spend several click cycles settling, and a shorter
    // wait here could time out before a real (delayed) matching PUT lands.
    const [enableBody] = await Promise.all([
      chatPage.waitForSessionToolsUpdate(25_000, (body) =>
        (body.tools ?? []).includes('web-search'),
      ),
      chatPage.enableTool('Web Search'),
    ]);
    expect(enableBody.tools).toContain('web-search');
    expect(await chatPage.isToolActive('Web Search')).toBe(true);

    const [disableBody] = await Promise.all([
      chatPage.waitForSessionToolsUpdate(
        25_000,
        (body) => !(body.tools ?? []).includes('web-search'),
      ),
      chatPage.disableTool('Web Search'),
    ]);
    expect(disableBody.tools ?? []).not.toContain('web-search');
    expect(await chatPage.isToolActive('Web Search')).toBe(false);
  });

  // scm-03: attaching a file and sending carries it in the outgoing WS frame
  // as `file_references`, alongside the prompt and session_id — the exact
  // shape `use-chat-v2.ts`'s `sendMessage` builds (`createFileReference`):
  // `{file_id, file_key, file_name, content_type, file_size}`. No separate
  // `attachments`/`files` field exists on the wire.
  test('admin attaches a file and sends — the outgoing WS frame carries the prompt, session id, and file reference', async ({
    page,
    chatPage,
  }) => {
    const { fileId, fileKey } = await chatPage.mockFileUpload('success', 0);
    const ws = await chatPage.mockChatWebSocket();

    await gotoReadyChat(page, chatPage);

    await chatPage.attachFile(ATTACHMENT_FILE);
    // Wait for the upload to settle (retry absent = not in error state, chip
    // present = attached) before sending.
    await expect(chatPage.attachmentChip.first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(chatPage.getRetryFileButton()).toHaveCount(0, {
      timeout: 10_000,
    });

    await chatPage.sendMessage('Here is a file for you');
    const clientFrame = await ws.waitForClientMessage();

    expect(clientFrame.prompt).toBe('Here is a file for you');
    // The frame's own session_id must match what the app has cached for this
    // mentor — by now (a message has been sent) session creation has long
    // since completed, so the race that would exist checking this pre-send
    // does not apply here.
    expect(clientFrame.session_id).toBe(
      await chatPage.getCachedSessionId(mentorId),
    );
    expect(Array.isArray(clientFrame.file_references)).toBe(true);
    const fileReferences = clientFrame.file_references as Array<
      Record<string, unknown>
    >;
    expect(fileReferences).toHaveLength(1);
    expect(fileReferences[0]).toMatchObject({
      file_id: fileId,
      file_key: fileKey,
      file_name: 'acessibility png.png',
      content_type: 'image/png',
      file_size: ATTACHMENT_FILE_SIZE,
    });
  });

  // scm-04: the file chip visibly transitions uploading -> done (spinner
  // clears, no retry affordance, Remove is available).
  test('admin attaches a file and the chip transitions from uploading to done', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockFileUpload('success', 2_000);
    await gotoReadyChat(page, chatPage);

    await chatPage.attachFile(ATTACHMENT_FILE);
    const chip = chatPage.attachmentChip.first();
    await expect(chip).toBeVisible({ timeout: 10_000 });

    // Uploading: spinner overlay visible, Remove disabled.
    await expect(chatPage.getAttachmentSpinner(chip)).toBeVisible({
      timeout: 5_000,
    });

    // Done: spinner clears, no retry affordance, Remove is available.
    await expect(chatPage.getAttachmentSpinner(chip)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(chatPage.getRetryFileButton()).toHaveCount(0);
    await expect(chatPage.getRemoveFileButton().first()).toBeEnabled({
      timeout: 5_000,
    });
  });

  // scm-05: a failed upload (mocked 500 on the presigned-URL POST) drives the
  // chip to its error/retry state instead of silently vanishing.
  test('admin attaches a file and a failed upload shows the error/retry affordance', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockFileUpload('upload-url-error');
    await gotoReadyChat(page, chatPage);

    await chatPage.attachFile(ATTACHMENT_FILE);
    await expect(chatPage.getRetryFileButton()).toBeVisible({
      timeout: 15_000,
    });
    // The spinner must be gone — a failed upload is not "still uploading".
    await expect(
      chatPage.getAttachmentSpinner(chatPage.attachmentChip.first()),
    ).toHaveCount(0);
  });

  // scm-06: clicking Stop mid-stream opens the dedicated stop-generation
  // socket, sends the matching generation_id, and — once that socket replies
  // — leaves the streaming state and re-enables the composer. A frame sent
  // on the (now-paused) main socket immediately after Stop must never
  // render, proving the pause takes effect rather than merely hiding the
  // stop button.
  test('admin clicks Stop mid-stream: streaming ends, composer re-enables, and the stop frame is sent', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    const stopWs = await chatPage.mockStopGenerationWebSocket();

    await gotoReadyChat(page, chatPage);
    await chatPage.sendMessage('Tell me a long story');
    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id as string;

    const generationId = `e2e-gen-${Date.now()}`;
    ws.send({ generation_id: generationId, session_id: sessionId });
    ws.send({
      data: 'Once upon a time, ',
      session_id: sessionId,
    });

    await expect(chatPage.stopStreamingButton).toBeVisible({
      timeout: 15_000,
    });
    await chatPage.stopStreamingButton.click();

    const stopFrame = await stopWs.waitForClientMessage();
    expect(stopFrame.generation_id).toBe(generationId);

    // A frame arriving on the main socket right after Stop (before the stop
    // socket even replies) must be silently ignored — `isWebSocketPaused` is
    // set synchronously when Stop is clicked.
    ws.send({
      data: 'a stray token that must never render',
      session_id: sessionId,
    });
    await expect(
      page.getByText('a stray token that must never render'),
    ).toHaveCount(0);

    // The stop socket replying is what actually re-enables the composer.
    stopWs.send({ detail: 'Stopped' });

    await expect(chatPage.stopStreamingButton).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(chatPage.getComposerTextarea()).toBeEnabled({
      timeout: 10_000,
    });
  });

  // scm-07: the server closing the socket mid-stream (no eos/error frame —
  // exactly how a real backend error surfaces per `use-chat-v2.ts`) must not
  // leave the UI stuck "thinking" forever — the composer re-enables and a
  // new message can still be sent (which re-opens a fresh mocked socket).
  test('server drops the WebSocket mid-stream: the UI leaves the streaming state and the user can send again', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();

    await gotoReadyChat(page, chatPage);
    await chatPage.sendMessage('Start a reply then vanish');
    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id as string;

    ws.send({ generation_id: `e2e-gen-${Date.now()}`, session_id: sessionId });
    ws.send({ data: 'Partial reply before the drop', session_id: sessionId });
    await expect(chatPage.stopStreamingButton).toBeVisible({
      timeout: 15_000,
    });

    ws.close();

    // Leaves the streaming state: the stop button disappears and the
    // composer becomes usable again, without any eos/error frame ever
    // arriving.
    await expect(chatPage.stopStreamingButton).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(chatPage.getComposerTextarea()).toBeEnabled({
      timeout: 15_000,
    });

    // The user can still send another message — `sendMessage()` transparently
    // reconnects, so the mocked route (page-scoped, not one-shot) fires again
    // for the fresh connection.
    await chatPage.sendMessage('Are you still there?');
    const secondFrame = await ws.waitForClientMessage();
    expect(secondFrame.prompt).toBe('Are you still there?');
  });
});
