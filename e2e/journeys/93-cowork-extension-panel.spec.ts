import { test, expect } from '../fixtures/mentor-test';
import type { FrameLocator, Page, WebSocketRoute } from '@playwright/test';
import { navigateToMentorApp } from '../utils/auth';
import { EMBED_HARNESS_URL } from '../fixtures/test-data';
import { openLauncher } from '../utils/embed-harness-client';

/**
 * Journey 93: Cowork in the Chrome extension's side panel — the app half.
 *
 * No journey loads the extension itself. The panel declares itself with
 * `enable-cowork=true` on the app's iframe URL (`<agent-ai enablecowork>`,
 * read by `hooks/use-in-extension-panel.ts`) and everything else goes over
 * `postMessage` (`hooks/use-browse-run.ts`), so the harness's `/agent-ai` page
 * (second origin, journey 89) stands in for it: opened with that attribute,
 * with an init script that records every `MENTOR:BROWSE_RUN` it is sent and
 * can post worker frames back into the iframe exactly as
 * `extensions/chrome/src/browse-bridge.ts` does. It still answers a
 * `MENTOR:BROWSE_HELLO` — the handshake an extension older than the flag
 * uses — and cw-01 checks that a flagged app never sends one. The worker's own
 * behaviour (snapshots, real clicks, the picture, the cap) is unit-tested
 * under `extensions/chrome/src/__tests__`.
 *
 * Chrome-only: the surface is a Chrome extension.
 */

const GOAL = 'Open the billing page for me.';
const REPLY = 'Done: the billing page is open.';
const NOTE =
  'I stopped here: that’s as long as I work in one go. Send “continue” and I’ll pick up where I left off, as long as this panel stays open.';
// The app numbers each row and names it after its action, so the chat's
// header counts the actions and each row is that one line.
const ROWS = [
  'Read page app.acme.com',
  'Typed into [2] textbox "Name"',
  'Click — Didn’t work.',
];

interface FakePanelWindow extends Window {
  __browseRuns?: unknown[];
  __browseHellos?: unknown[];
  __browseEmit?: (payload: unknown) => void;
}

/**
 * The panel's half of the bridge protocol, as the app can observe it. Installed
 * on the harness origin only; the app's hooks accept frames from
 * `window.parent` alone, which this page is.
 */
async function installFakePanel(page: Page): Promise<void> {
  await page.addInitScript((harness: string) => {
    if (location.origin !== harness) return;
    const w = window as FakePanelWindow;
    const runs: unknown[] = [];
    const hellos: unknown[] = [];
    let app: { win: Window; origin: string } | null = null;
    w.__browseRuns = runs;
    w.__browseHellos = hellos;
    w.__browseEmit = (payload: unknown) =>
      app?.win.postMessage(
        { type: 'MENTOR:BROWSE_EVENT', payload },
        app.origin,
      );
    window.addEventListener('message', (event: MessageEvent) => {
      const type = (event.data as { type?: unknown } | null)?.type;
      if (typeof type !== 'string' || !type.startsWith('MENTOR:BROWSE_'))
        return;
      app = { win: event.source as Window, origin: event.origin };
      if (type === 'MENTOR:BROWSE_HELLO') {
        hellos.push(event.data);
        app.win.postMessage({ type: 'MENTOR:BROWSE_READY' }, app.origin);
      }
      if (type === 'MENTOR:BROWSE_RUN') runs.push(event.data);
    });
  }, EMBED_HARNESS_URL);
}

const recordedRuns = (page: Page) =>
  page.evaluate(() => (window as FakePanelWindow).__browseRuns ?? []);

const recordedHellos = (page: Page) =>
  page.evaluate(() => (window as FakePanelWindow).__browseHellos ?? []);

const emit = (page: Page, payload: unknown) =>
  page.evaluate(
    (frame) => (window as FakePanelWindow).__browseEmit?.(frame),
    payload,
  );

function launcherFrame(page: Page): FrameLocator {
  return page.frameLocator('agent-ai iframe');
}

async function openPanelChat(page: Page): Promise<FrameLocator> {
  await openLauncher(page, { cowork: true });
  const frame = launcherFrame(page);
  await expect(frame.locator('#chat-input-textarea')).toBeVisible({
    timeout: 60_000,
  });
  // The flag on the iframe URL is what makes the app treat this page as the panel.
  await expect(frame.getByTestId('cowork-pill')).toBeVisible({
    timeout: 15_000,
  });
  return frame;
}

async function sendGoal(frame: FrameLocator): Promise<void> {
  await frame.locator('#chat-input-textarea').fill(GOAL);
  await frame.getByRole('button', { name: 'Send message' }).click();
}

test.describe('Journey 93: Cowork in the extension panel', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'The side panel is a Chrome extension surface',
  );

  test.beforeEach(async ({ page, chatPage }) => {
    await navigateToMentorApp(page);
    // The action list and the rows render only for an agent that shows its
    // reasoning; the mentor settings are patched rather than edited.
    await chatPage.mockShowReasoning(true);
    await installFakePanel(page);
  });

  // cw-01: declared the panel by its iframe URL, the app shows Cowork switched
  // on, with its disclosure note and Approvals = Automatic, in the popover
  // behind the pill — and never asks over postMessage.
  test('the Cowork pill is on inside the panel and its popover says what it does', async ({
    page,
  }) => {
    const frame = await openPanelChat(page);
    await expect(frame.getByTestId('cowork-pill')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await frame.getByTestId('cowork-pill').click();
    const panel = frame.getByTestId('cowork-panel');
    await expect(panel.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(frame.getByTestId('cowork-tab-note')).toContainText('picture');
    await expect(
      panel.getByRole('radio', { name: 'Automatic' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(await recordedHellos(page)).toEqual([]);
  });

  // cw-02: a goal becomes a run frame carrying the Approvals choice; the worker's frames render as one assistant turn — each log line
  // (the page read, a typed field, a failed click) as a numbered row under
  // "Used 3 tools", the reply, then the cap note — and Send returns.
  test('a scripted run renders its rows, reply and cap note as one assistant turn', async ({
    page,
    chatPage,
  }) => {
    const frame = await openPanelChat(page);
    await sendGoal(frame);
    await expect
      .poll(async () => (await recordedRuns(page)).length, { timeout: 15_000 })
      .toBe(1);
    expect((await recordedRuns(page))[0]).toEqual({
      type: 'MENTOR:BROWSE_RUN',
      goal: GOAL,
      auto: true,
    });

    await emit(page, { type: 'ack' });
    await emit(page, { type: 'log', text: ROWS[0], ok: true });
    await emit(page, { type: 'log', text: ROWS[1], ok: true });
    await emit(page, { type: 'log', text: ROWS[2], ok: false });
    await emit(page, { type: 'event', event: { type: 'text', text: REPLY } });
    await emit(page, { type: 'done', text: REPLY, note: NOTE });

    const turn = frame.locator('.chat-ai-message-response').last();
    const body = chatPage.getAiMessageBody(turn);
    await expect(body).toContainText(REPLY, { timeout: 15_000 });
    await expect(body).toContainText(NOTE);

    const rows = chatPage.getToolCallTrigger(turn);
    await expect(rows).toHaveText(/Used 3 tools/);
    await rows.click();
    for (const [index, text] of ROWS.entries()) {
      await expect(
        turn.getByText(`${index + 1}. ${text}`, { exact: true }),
      ).toBeVisible();
    }
    await expect(
      frame.getByRole('button', { name: 'Send message' }),
    ).toBeVisible();
  });

  // cw-03: the DM closes an idle mentor socket after minutes, and a run never
  // touches that socket, so the close lands mid-run. It must not end the turn
  // on screen (iblai-platform#2821): Stop stays and Send stays away until the
  // worker's done. The socket is proxied to the real server and closed from
  // the test the way the DM does it (code 4000).
  test('a mentor socket close mid-run leaves the turn in flight', async ({
    page,
  }) => {
    let socket: WebSocketRoute | undefined;
    await page.routeWebSocket('**/ws/langflow/**', (ws) => {
      socket = ws;
      const server = ws.connectToServer();
      ws.onMessage((message) => server.send(message));
      server.onMessage((message) => ws.send(message));
      ws.onClose((code, reason) => server.close({ code, reason }));
      server.onClose((code, reason) => ws.close({ code, reason }));
    });
    const frame = await openPanelChat(page);
    await sendGoal(frame);
    await expect
      .poll(async () => (await recordedRuns(page)).length, { timeout: 15_000 })
      .toBe(1);
    await emit(page, { type: 'ack' });
    await emit(page, { type: 'log', text: ROWS[0], ok: true });

    const stop = frame.locator('.chat-stop-streaming-button');
    const send = frame.getByRole('button', { name: 'Send message' });
    await expect(stop).toBeVisible({ timeout: 15_000 });
    expect(socket, 'the app opened its mentor socket').toBeDefined();
    await socket!.close({ code: 4000, reason: 'idle' });
    // A close handler that ended the turn would flip Stop to Send within a
    // render; give it the time to show.
    await page.waitForTimeout(1_000);
    await expect(stop).toBeVisible();
    await expect(send).toBeHidden();

    await emit(page, { type: 'event', event: { type: 'text', text: REPLY } });
    await emit(page, { type: 'done', text: REPLY });
    await expect(send).toBeVisible({ timeout: 15_000 });
  });
});
