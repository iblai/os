/**
 * Journey 94 — Chat download as Text/Excel + sidebar whole-chat Export
 * (iblai/iblai-platform#2713)
 *
 * One shared SDK dialog (`data-testid="chat-download-dialog"`) serves both
 * the reply's Download button ("Download Chat": scope radios + File type) and
 * the sidebar row menu's Export ("Export Chat": File type only). It reads the
 * WHOLE saved session (`GET .../sessions/<id>/`) when it opens, so the old
 * bug — sidebar export saving only the row's first message as `messages.xlsx`
 * — is covered by a real multi-turn chat.
 *
 * Serial: dl-01 creates one throw-away agent (cheap ibl.ai model, tracked and
 * deleted by `createWithName`) and holds a real 3-turn chat; the rest reopen
 * that chat from the sidebar. The canExport rule is already covered by
 * chexp-03/04 (journey 57) and is not repeated here.
 */

import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { readFirstSheet } from '../utils/xlsx';
import type { ChatPage } from '../page-objects/chat.page';
import type { SidebarPage } from '../page-objects/sidebar.page';

const PROMPTS = [
  'Reply with the single word: alpha',
  'Reply with the single word: bravo',
  'Reply with the single word: charlie',
];
const today = () => new Date().toISOString().slice(0, 10);
const SESSION_GET = /\/sessions\/[^/]+\/(\?.*)?$/;

test.describe.serial('Journey 94: chat download Excel + sidebar export', () => {
  test.setTimeout(300_000);

  let chatUrl = '';
  let agentName = '';
  let sessionId = '';

  test.beforeEach(() => {
    if (test.info().title.startsWith('dl-01')) return;
    test.skip(!chatUrl, 'dl-01 setup did not run');
  });

  async function sendTurns(page: Page, chatPage: ChatPage): Promise<void> {
    for (const [i, prompt] of PROMPTS.entries()) {
      await chatPage.sendMessage(prompt);
      await expect(chatPage.aiMessages).toHaveCount(i + 1, { timeout: 90_000 });
      await chatPage.waitForStreamingComplete(120_000);
    }
    await waitForPageReady(page);
  }

  /** Reloads the agent and reopens the saved chat from the sidebar. */
  async function reopenChat(
    page: Page,
    chatPage: ChatPage,
    sidebarPage: SidebarPage,
  ): Promise<void> {
    await page.goto(chatUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);
    // A cold reload can sit on the app's loading screen well past readyState.
    await sidebarPage.ensureExpanded(60_000);
    await sidebarPage.expandChatsSection();
    const row = sidebarPage.getRecentChatRowBySession(sessionId);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    await expect(chatPage.aiMessages).toHaveCount(PROMPTS.length, {
      timeout: 30_000,
    });
  }

  /** Holds the session-history GET until `release()` (or fails it with 500). */
  async function interceptHistory(
    page: Page,
    mode: 'delay' | 'fail',
  ): Promise<{ release: () => void }> {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(SESSION_GET, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      if (mode === 'fail') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"detail":"boom"}',
        });
      }
      await gate;
      return route.continue();
    });
    return { release };
  }

  function expectRows(rows: string[][]): void {
    expect(rows[0]).toEqual(['Time', 'From', 'Message']);
    const body = rows.slice(1);
    expect(body, 'one row per message (3 turns = 6)').toHaveLength(
      PROMPTS.length * 2,
    );
    PROMPTS.forEach((prompt, i) => {
      expect(body[i * 2][1]).toBe('You');
      expect(body[i * 2][2]).toBe(prompt);
      expect(body[i * 2 + 1][1]).toBe(agentName);
      expect(body[i * 2 + 1][2].length).toBeGreaterThan(0);
    });
  }

  test('dl-01: Download dialog defaults to Entire chat + Text, shows the format description, and resets on reopen', async ({
    page,
    createMentorPage,
    chatPage,
  }) => {
    await navigateToMentorApp(page);
    agentName = await createMentorPage.openAndCreate();
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    chatUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    await sendTurns(page, chatPage);
    sessionId = (await chatPage.getCachedSessionId(mentorId)) ?? '';
    expect(sessionId, 'session id cached after sending').toBeTruthy();

    await chatPage.openDownloadDialog();
    await expect(chatPage.downloadScopeChatRadio).toBeChecked();
    await expect(chatPage.downloadScopeMessageRadio).not.toBeChecked();
    await expect(chatPage.downloadFormatSelect).toContainText('Text (.txt)');
    await expect(
      chatPage.exportDialogRoot.getByText('Plain text that opens anywhere.'),
    ).toBeVisible();

    await chatPage.downloadFormatSelect.click();
    await expect(
      page.getByRole('option', { name: /Text \(\.txt\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /Excel \(\.xlsx\)/ }),
    ).toContainText('A spreadsheet with one row per message.');
    await page.getByRole('option', { name: /^Excel/ }).click();
    await expect(chatPage.downloadFormatSelect).toContainText('Excel (.xlsx)');
    await expect(
      chatPage.exportDialogRoot.getByText(
        'A spreadsheet with one row per message.',
      ),
    ).toBeVisible();
    await chatPage.downloadDialog
      .getByText('This message only', { exact: true })
      .click();
    await expect(chatPage.downloadScopeMessageRadio).toBeChecked();

    await page.keyboard.press('Escape');
    await expect(chatPage.downloadDialog).toBeHidden();
    await chatPage.openDownloadDialog();
    await expect(chatPage.downloadScopeChatRadio).toBeChecked();
    await expect(chatPage.downloadFormatSelect).toContainText('Text (.txt)');
  });

  test('dl-02: Download as Text saves chat-<agent>-<date>.txt, and This message only saves message-<agent>-<date>.txt', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await reopenChat(page, chatPage, sidebarPage);

    await chatPage.openDownloadDialog();
    await expect(chatPage.downloadConfirmButton).toBeEnabled({
      timeout: 30_000,
    });
    let downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await chatPage.downloadConfirmButton.click();
    let download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      `chat-${agentName}-${today()}.txt`,
    );
    const whole = await chatPage.readDownloadText(download);
    for (const prompt of PROMPTS) expect(whole).toContain(prompt);

    await chatPage.openDownloadDialog();
    await chatPage.downloadDialog
      .getByText('This message only', { exact: true })
      .click();
    downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await chatPage.downloadConfirmButton.click();
    download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      `message-${agentName}-${today()}.txt`,
    );
    const single = await chatPage.readDownloadText(download);
    expect(single).not.toContain(PROMPTS[0]);
  });

  test('dl-03: Download as Excel saves chat-<agent>-<date>.xlsx with Time/From/Message and one row per message', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await reopenChat(page, chatPage, sidebarPage);

    await chatPage.openDownloadDialog();
    await chatPage.selectDownloadFormat('Excel');
    await expect(chatPage.downloadConfirmButton).toBeEnabled({
      timeout: 30_000,
    });
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await chatPage.downloadConfirmButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(
      `chat-${agentName}-${today()}.xlsx`,
    );
    expectRows(readFirstSheet(await chatPage.readDownloadBuffer(download)));

    // This message only: header + exactly the one reply.
    await chatPage.openDownloadDialog();
    await chatPage.selectDownloadFormat('Excel');
    await chatPage.downloadDialog
      .getByText('This message only', { exact: true })
      .click();
    await expect(chatPage.downloadConfirmButton).toBeEnabled({
      timeout: 15_000,
    });
    const single = page.waitForEvent('download', { timeout: 15_000 });
    await chatPage.downloadConfirmButton.click();
    const singleDownload = await single;
    expect(singleDownload.suggestedFilename()).toBe(
      `message-${agentName}-${today()}.xlsx`,
    );
    const rows = readFirstSheet(
      await chatPage.readDownloadBuffer(singleDownload),
    );
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe(agentName);
  });

  test('dl-04: while the whole chat is being fetched the dialog shows "Getting the whole chat…" and Download stays disabled until it arrives', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await reopenChat(page, chatPage, sidebarPage);
    const gate = await interceptHistory(page, 'delay');

    await chatPage.openDownloadDialog();
    await expect(chatPage.downloadStatus).toHaveText('Getting the whole chat…');
    await expect(
      chatPage.downloadStatus.locator('svg.animate-spin'),
    ).toBeVisible();
    await expect(chatPage.downloadConfirmButton).toBeDisabled();

    gate.release();
    await expect(chatPage.downloadStatus).toBeHidden({ timeout: 15_000 });
    await expect(chatPage.downloadConfirmButton).toBeEnabled();
  });

  test('dl-05: when the whole chat cannot be fetched Entire chat is disabled and This message only still downloads', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await reopenChat(page, chatPage, sidebarPage);
    await interceptHistory(page, 'fail');

    await chatPage.openDownloadDialog();
    await expect(chatPage.downloadStatus).toContainText(
      "We couldn't get the whole chat. You can still download this message.",
      { timeout: 15_000 },
    );
    await expect(chatPage.downloadScopeChatRadio).toBeDisabled();
    await expect(chatPage.downloadScopeMessageRadio).toBeChecked();

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await chatPage.downloadConfirmButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      `message-${agentName}-${today()}.txt`,
    );
  });

  test('ex-01: sidebar Export opens "Export Chat" with only the File type dropdown, and Export is disabled while the whole chat loads', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await page.goto(chatUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);
    await sidebarPage.ensureExpanded(60_000);
    await sidebarPage.expandChatsSection();
    await expect(sidebarPage.getRecentChatRowBySession(sessionId)).toBeVisible({
      timeout: 30_000,
    });
    const gate = await interceptHistory(page, 'delay');

    await sidebarPage.clickExportBySession(sessionId);
    const dialog = page.getByRole('dialog', { name: 'Export Chat' });
    await expect(dialog).toBeVisible();
    await expect(chatPage.exportDialogRoot).toBeVisible();
    await expect(dialog.getByRole('radio')).toHaveCount(0);
    await expect(chatPage.downloadFormatSelect).toContainText('Text (.txt)');
    await expect(chatPage.downloadStatus).toHaveText('Getting the whole chat…');
    const exportButton = dialog.getByRole('button', {
      name: 'Export',
      exact: true,
    });
    await expect(exportButton).toBeDisabled();

    gate.release();
    await expect(exportButton).toBeEnabled({ timeout: 15_000 });
  });

  test('ex-02: sidebar Export as Excel saves EVERY message of a 3-turn chat as chat-<agent>-<date>.xlsx (not messages.xlsx)', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await page.goto(chatUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);
    await sidebarPage.ensureExpanded(60_000);
    await sidebarPage.expandChatsSection();
    await expect(sidebarPage.getRecentChatRowBySession(sessionId)).toBeVisible({
      timeout: 30_000,
    });

    await sidebarPage.clickExportBySession(sessionId);
    await chatPage.selectDownloadFormat('Excel');
    const exportButton = page
      .getByRole('dialog', { name: 'Export Chat' })
      .getByRole('button', { name: 'Export', exact: true });
    await expect(exportButton).toBeEnabled({ timeout: 30_000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await exportButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(
      `chat-${agentName}-${today()}.xlsx`,
    );
    expect(download.suggestedFilename()).not.toBe('messages.xlsx');
    expectRows(readFirstSheet(await chatPage.readDownloadBuffer(download)));
  });

  test('ex-03: sidebar Export as Text saves chat-<agent>-<date>.txt with every message', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await navigateToMentorApp(page);
    await page.goto(chatUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await waitForPageReady(page);
    await sidebarPage.ensureExpanded(60_000);
    await sidebarPage.expandChatsSection();
    await expect(sidebarPage.getRecentChatRowBySession(sessionId)).toBeVisible({
      timeout: 30_000,
    });

    await sidebarPage.clickExportBySession(sessionId);
    const exportButton = page
      .getByRole('dialog', { name: 'Export Chat' })
      .getByRole('button', { name: 'Export', exact: true });
    await expect(exportButton).toBeEnabled({ timeout: 30_000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await exportButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(
      `chat-${agentName}-${today()}.txt`,
    );
    const text = await chatPage.readDownloadText(download);
    for (const prompt of PROMPTS) expect(text).toContain(prompt);
  });
});
