import { test, expect } from '../fixtures/mentor-test';
import type { FrameLocator, Page } from '@playwright/test';
import { navigateToMentorApp } from '../utils/auth';
import { EMBED_HARNESS_URL } from '../fixtures/test-data';
import { openLauncher } from '../utils/embed-harness-client';

/**
 * Journey 93: Cowork in the Chrome extension's side panel — the app half.
 *
 * No journey loads the extension itself. What the app does inside the panel
 * is driven entirely by `postMessage` with the panel (`hooks/use-in-extension-panel.ts`,
 * `hooks/use-browse-run.ts`), so the harness's `/agent-ai` page (second
 * origin, journey 89) stands in for it: an init script answers the app's
 * `MENTOR:BROWSE_HELLO` with `MENTOR:BROWSE_READY`, records every
 * `MENTOR:BROWSE_RUN` it is sent, and can post worker frames back into the
 * iframe exactly as `extensions/chrome/src/browse-bridge.ts` does. The
 * worker's own behaviour (snapshots, real clicks, the picture, the cap) is
 * unit-tested under `extensions/chrome/src/__tests__`.
 *
 * Chrome-only: the surface is a Chrome extension.
 */

const GOAL = 'Open the billing page for me.';
const REPLY = 'Done: the billing page is open.';
const NOTE =
  'I stopped here: that’s as many steps as I take in one go. Send “continue” and I’ll pick up where I left off, as long as this panel stays open.';
const ROWS = {
  read: 'Read page app.acme.com',
  narration: 'Opening the menu to find billing.',
  failed: 'Click — Didn’t work.',
};

interface FakePanelWindow extends Window {
  __browseRuns?: unknown[];
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
    let app: { win: Window; origin: string } | null = null;
    w.__browseRuns = runs;
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
      if (type === 'MENTOR:BROWSE_HELLO')
        app.win.postMessage({ type: 'MENTOR:BROWSE_READY' }, app.origin);
      if (type === 'MENTOR:BROWSE_RUN') runs.push(event.data);
    });
  }, EMBED_HARNESS_URL);
}

const recordedRuns = (page: Page) =>
  page.evaluate(() => (window as FakePanelWindow).__browseRuns ?? []);

const emit = (page: Page, payload: unknown) =>
  page.evaluate(
    (frame) => (window as FakePanelWindow).__browseEmit?.(frame),
    payload,
  );

function launcherFrame(page: Page): FrameLocator {
  return page.frameLocator('agent-ai iframe');
}

async function openPanelChat(page: Page): Promise<FrameLocator> {
  await openLauncher(page);
  const frame = launcherFrame(page);
  await expect(frame.locator('#chat-input-textarea')).toBeVisible({
    timeout: 60_000,
  });
  // The handshake is what makes the app treat this page as the panel.
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

  // cw-01: answered by a panel, the app shows Cowork switched on, with its
  // disclosure note and Approvals = Automatic, in the popover behind the pill.
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
  });

  // cw-02: a goal becomes a run frame carrying the Approvals choice; the worker's frames render as one assistant turn — each log line
  // (an action, the agent's narration, a failed call) as a row showing its
  // text under "Used 1 tool", the reply, then the cap note — and Send returns.
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
    await emit(page, { type: 'log', text: ROWS.read, ok: true });
    await emit(page, { type: 'log', text: ROWS.narration, ok: true });
    await emit(page, { type: 'log', text: ROWS.failed, ok: false });
    await emit(page, { type: 'event', event: { type: 'text', text: REPLY } });
    await emit(page, { type: 'done', text: REPLY, note: NOTE });

    const turn = frame.locator('.chat-ai-message-response').last();
    const body = chatPage.getAiMessageBody(turn);
    await expect(body).toContainText(REPLY, { timeout: 15_000 });
    await expect(body).toContainText(NOTE);

    const rows = chatPage.getToolCallTrigger(turn);
    await expect(rows).toHaveText(/Used 1 tool/);
    await rows.click();
    for (const text of Object.values(ROWS)) {
      await expect(turn.getByText(text, { exact: true })).toBeVisible();
    }
    await expect(
      frame.getByRole('button', { name: 'Send message' }),
    ).toBeVisible();
  });
});
