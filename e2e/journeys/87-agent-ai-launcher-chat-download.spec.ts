import { test, expect } from '../fixtures/mentor-test';
import type { FrameLocator, Page } from '@playwright/test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import type { ChatPage } from '../page-objects/chat.page';
import { EMBED_HARNESS_URL, MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

/**
 * Journey 87: `<agent-ai>` launcher — chat export (iblai-platform#2680)
 *
 * Chrome silently blocks a download (no error, no console message) started
 * from a sandboxed iframe whose `sandbox` lacks `allow-downloads`. The
 * `<agent-ai>` web component (`@iblai/agent-ai`, vendored in the Chrome
 * extension) rendered its chat iframe without it, so "Download this chat" did
 * nothing in launcher embeds. Journey 82 covers the OS-generated snippet,
 * which does not use agent-ai, so this is its own journey: it loads the
 * VENDORED bundle (e2e/fixtures copy) through the harness's `/agent-ai` page (second origin).
 *
 * Uses the tenant's default agent with a mocked chat WebSocket, so nothing
 * is created and nothing needs cleaning up.
 */

// The sandbox string agent-ai shipped before the fix.
const OLD_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
const USER_MESSAGE = 'Please export this launcher chat as a transcript.';
const AI_REPLY = 'Scripted launcher reply for the export test';

type ChatSocket = Awaited<ReturnType<ChatPage['mockChatWebSocket']>>;

const HOST_SESSION_KEYS = [
  'axd_token',
  'dm_token',
  'tenants',
  'tenant',
  'current_tenant',
  'userData',
  'edx_jwt_token',
  'axd_token_expires',
  'dm_token_expires',
];

async function openLauncher(page: Page): Promise<void> {
  const { tenantKey, mentorId } = await getPlatformContext(page);
  // With no session of its own on the harness origin, agent-ai redirects to
  // the login page; authrelyonhost makes it read the host's localStorage.
  const session = await page.evaluate((keys) => {
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }, HOST_SESSION_KEYS);
  await page.addInitScript(
    ({ origin, entries }) => {
      if (location.origin !== origin) return;
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    },
    { origin: EMBED_HARNESS_URL, entries: session },
  );
  const params = new URLSearchParams({
    mentorurl: MENTOR_NEXTJS_HOST,
    tenant: tenantKey,
    mentor: mentorId,
    authrelyonhost: '1',
  });
  await page.goto(`${EMBED_HARNESS_URL}/agent-ai?${params}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
}

function launcherFrame(page: Page): FrameLocator {
  return page.frameLocator('agent-ai iframe');
}

async function chatAndOpenDownloadDialog(
  page: Page,
  ws: ChatSocket,
): Promise<FrameLocator> {
  const frame = launcherFrame(page);
  const input = frame.locator('#chat-input-textarea');
  await expect(input).toBeVisible({ timeout: 60_000 });
  await input.fill(USER_MESSAGE);
  await frame.getByRole('button', { name: 'Send message' }).click();

  const clientFrame = await ws.waitForClientMessage();
  const sessionId = clientFrame.session_id;
  ws.send({ generation_id: `e2e-aa-${Date.now()}`, session_id: sessionId });
  ws.send({ data: AI_REPLY, session_id: sessionId });
  ws.send({ eos: true, session_id: sessionId });
  await expect(
    frame.locator('.chat-ai-message-response').filter({ hasText: AI_REPLY }),
  ).toBeVisible({ timeout: 15_000 });

  await frame
    .getByRole('button', { name: 'Download this chat' })
    .first()
    .click();
  await expect(
    frame.getByRole('dialog', { name: 'Download Chat' }),
  ).toBeVisible({
    timeout: 10_000,
  });
  return frame;
}

test.describe('Journey 87: agent-ai launcher chat download', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // aa-01: the launcher's chat iframe is sandboxed WITH allow-downloads, and
  // exporting the chat from inside it produces the transcript file.
  test('user opens the agent-ai launcher, downloads the chat and gets the transcript', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    await openLauncher(page);

    const sandbox = await page
      .locator('agent-ai iframe')
      .getAttribute('sandbox');
    expect(sandbox).toContain('allow-downloads');

    const frame = await chatAndOpenDownloadDialog(page, ws);
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await frame
      .getByRole('dialog', { name: 'Download Chat' })
      .getByRole('button', { name: 'Download', exact: true })
      .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^chat-.*\.txt$/);
    const content = await chatPage.readDownloadText(download);
    expect(content).toContain(USER_MESSAGE);
    expect(content).toContain(AI_REPLY);
  });

  // aa-02: negative control — the pre-fix sandbox string makes Chrome drop
  // the download silently; proves aa-01 would catch a regression.
  test('negative control: the pre-fix sandbox without allow-downloads yields no download', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    await openLauncher(page);

    // sandbox only applies on navigation, so reload the frame under the old value.
    await page.locator('agent-ai iframe').evaluate((el, oldSandbox) => {
      const iframe = el as HTMLIFrameElement;
      iframe.setAttribute('sandbox', oldSandbox);
      iframe.src = iframe.src;
    }, OLD_SANDBOX);
    expect(await page.locator('agent-ai iframe').getAttribute('sandbox')).toBe(
      OLD_SANDBOX,
    );

    const frame = await chatAndOpenDownloadDialog(page, ws);
    const downloads: unknown[] = [];
    page.on('download', (d) => downloads.push(d));
    await frame
      .getByRole('dialog', { name: 'Download Chat' })
      .getByRole('button', { name: 'Download', exact: true })
      .click();
    // The block is silent, so the only observable is the absence of a download.
    await page.waitForTimeout(5_000);
    expect(downloads).toHaveLength(0);
  });
});
