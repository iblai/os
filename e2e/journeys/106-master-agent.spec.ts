import { test, expect } from '../fixtures/mentor-test';
import type { Frame, FrameLocator, Locator, Page } from '@playwright/test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { openLauncher } from '../utils/embed-harness-client';
import { generateMentorName } from '../fixtures/test-data';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 106: Assistant header button
 *
 * A Bot button in the header opens the organization's main agent in a column
 * docked beside the page content, as the existing `<agent-ai>` embed. The
 * column's left edge is a resize handle (width remembered). Inside the
 * embed, Full screen turns the panel into a centered popup over a dimmed page
 * and Close chat hides it. MasterAgent ships in `@iblai/iblai-js` 2.85.0.
 *
 * ma-07 and ma-08 chat for real and pin where the chat saves its session id.
 * The Assistant is a frame of the app on the app's own origin, so it shares
 * the page's localStorage and saves under `session_id:framed`; an agent
 * embedded on another website has a different-origin parent and must keep
 * `session_id`, exactly as before. Each conversation must come back after a
 * reload. Both create their own agent (pinned to ibl.ai Fast, reaped by the
 * run's sweeper): the account's starred agent can take minutes to start.
 */

const PANEL_TESTID = 'master-agent-panel';
const WIDTH_STORAGE_KEY = 'ibl-master-agent-width';
const SESSION_KEY = 'session_id';
const FRAMED_SESSION_KEY = 'session_id:framed';
const LAUNCHER_IFRAME = 'agent-ai iframe';
const PANEL_IFRAME = `[data-testid="${PANEL_TESTID}"] agent-ai iframe`;
const REPLY_TIMEOUT = 90_000;

function masterAgentButton(page: Page) {
  return page.getByRole('button', { name: 'Assistant', exact: true });
}

function panel(page: Page) {
  return page.getByTestId(PANEL_TESTID);
}

function embedFrame(page: Page) {
  return page.frameLocator(PANEL_IFRAME);
}

function mainContent(page: Page) {
  return page.locator('#main-content-container');
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b as NonNullable<typeof b>;
}

async function openPanel(page: Page) {
  await masterAgentButton(page).click();
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await expect(panel(page)).toHaveAttribute('data-view', 'side');
}

async function frameOf(page: Page, iframeSelector: string): Promise<Frame> {
  const handle = await page
    .locator(iframeSelector)
    .elementHandle({ timeout: 30_000 });
  const frame = await handle?.contentFrame();
  expect(frame, `${iframeSelector} has a frame`).toBeTruthy();
  return frame as Frame;
}

/** The chat's cached session id for `<tenant>:<agent>` under `storageKey`. */
async function cachedSession(
  target: Page | Frame,
  storageKey: string,
  cacheKey: string,
): Promise<string | null> {
  return target
    .evaluate(
      ([storageKey, cacheKey]) => {
        const cache = JSON.parse(
          window.localStorage.getItem(storageKey) ?? '{}',
        ) as Record<string, string>;
        return cache[cacheKey] ?? null;
      },
      [storageKey, cacheKey] as const,
    )
    .catch(() => null);
}

/** Waits until the chat saves a session id other than `previous` and returns it. */
async function newlySavedSession(
  target: Page | Frame,
  storageKey: string,
  cacheKey: string,
  previous: string | null,
): Promise<string> {
  let saved: string | null = null;
  await expect
    .poll(
      async () => {
        const value = await cachedSession(target, storageKey, cacheKey);
        saved = value && value !== previous ? value : null;
        return saved;
      },
      {
        timeout: 45_000,
        message: `expected the chat to save a new session id in ${storageKey}["${cacheKey}"]`,
      },
    )
    .not.toBeNull();
  return saved as unknown as string;
}

/** Makes `agentId` this tenant's Default Agent for this page, as Advanced › Default Agent would. */
async function useAsDefaultAgent(
  page: Page,
  tenantKey: string,
  agentId: string,
): Promise<void> {
  await page.route(
    (url) => url.pathname.endsWith('/core/users/platforms/'),
    async (route) => {
      const response = await route.fetch();
      const platforms = (await response.json()) as Array<{
        key: string;
        metadata?: Record<string, unknown>;
      }>;
      await route.fulfill({
        response,
        json: platforms.map((platform) =>
          platform.key === tenantKey
            ? {
                ...platform,
                metadata: {
                  ...platform.metadata,
                  overall_default_mentor: { unique_id: agentId },
                },
              }
            : platform,
        ),
      });
    },
  );
}

/**
 * Records the sessions whose history loads from now on. The history replaces
 * the whole chat when it lands, so a message typed before that is wiped.
 */
function watchHistoryLoads(page: Page) {
  const loaded = new Set<string>();
  page.on('response', (response) => {
    const match = /\/sessions\/([^/?]+)\/\?(?:.*&)?page=1(?:&|$)/.exec(
      response.url(),
    );
    if (match) loaded.add(match[1]);
  });
  return (sessionId: string) =>
    expect
      .poll(() => loaded.has(sessionId), {
        timeout: 30_000,
        message: `expected the history of session ${sessionId} to load`,
      })
      .toBe(true);
}

function uniqueMessage(where: string): string {
  return `Assistant e2e ${where} ${Date.now()}-${test.info().parallelIndex}: reply with one short sentence.`;
}

function userMessage(root: Page | FrameLocator, text: string): Locator {
  return root.locator('.chat-user-message-query', { hasText: text });
}

/** Sends `text` in the chat under `root` and waits for the agent's reply to finish streaming. */
async function chatWithAgent(
  root: Page | FrameLocator,
  text: string,
): Promise<void> {
  const replies = root.locator('.chat-ai-message-response');
  const repliesBefore = await replies.count();
  const composer = root.locator('#chat-input-textarea');
  await expect(composer).toBeVisible({ timeout: 60_000 });
  await composer.fill(text);
  const send = root.getByRole('button', { name: 'Send message' });
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();

  await expect(userMessage(root, text)).toBeVisible({ timeout: 30_000 });
  await expect(replies.nth(repliesBefore)).toContainText(/\w/, {
    timeout: REPLY_TIMEOUT,
  });
  await expect(root.locator('.chat-stop-streaming-button')).toBeHidden({
    timeout: REPLY_TIMEOUT,
  });
}

test.describe('Journey 106: Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // ma-01: the header shows the Assistant button once an agent is known.
  test('user sees the Assistant button in the header', async ({ page }) => {
    const button = masterAgentButton(page);
    await expect(button).toBeVisible({ timeout: 30_000 });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  // ma-02: the first tap opens the side panel with the embed pointed at an
  // agent of this organization, and the embed's own nav bar loads.
  test('user opens the Assistant and sees the agent embedded in a side panel', async ({
    page,
  }) => {
    const { tenantKey } = await getPlatformContext(page);
    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);
    await expect(masterAgentButton(page)).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const iframe = page.locator(
      `[data-testid="${PANEL_TESTID}"] agent-ai iframe`,
    );
    // agent-ai builds the address attribute by attribute; wait for the agent in it.
    await expect(iframe).toHaveAttribute(
      'src',
      new RegExp(`/platform/${tenantKey}/[^/?]+\\?`),
      { timeout: 30_000 },
    );
    const url = new URL((await iframe.getAttribute('src')) as string);
    expect(url.pathname.startsWith(`/platform/${tenantKey}/`)).toBe(true);
    expect(url.searchParams.get('embed')).toBe('true');
    expect(url.searchParams.get('show-close-button')).toBe('true');
    expect(url.searchParams.get('allow-fullscreen')).toBe('true');

    // Docked beside the page content, flush right and right under the nav bar.
    await expect(
      mainContent(page).locator('xpath=following-sibling::*[1]'),
    ).toHaveAttribute('data-testid', PANEL_TESTID);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const nav = page.locator('nav').filter({ has: masterAgentButton(page) });
    // Measured together and retried: a banner loading above the header shifts
    // the header and the panel at once.
    await expect
      .poll(
        async () => {
          const [panelBox, navBox, mainBox] = await Promise.all([
            box(panel(page)),
            box(nav),
            box(mainContent(page)),
          ]);
          return [
            Math.abs(panelBox.x + panelBox.width - viewportWidth) <= 1,
            Math.abs(panelBox.y - (navBox.y + navBox.height)) <= 2,
            Math.abs(mainBox.x + mainBox.width - panelBox.x) <= 1,
          ];
        },
        { timeout: 10_000 },
      )
      .toEqual([true, true, true]);

    const frame = embedFrame(page);
    await expect(
      frame.getByRole('button', { name: 'Full screen', exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      frame.getByRole('button', { name: 'Close chat', exact: true }),
    ).toBeVisible();
  });

  // ma-03: Full screen in the embed makes the panel a popup over a dimmed
  // page; Exit full screen brings the side view back.
  test('user goes full screen in the Assistant and exits back to the side panel', async ({
    page,
  }) => {
    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);
    const frame = embedFrame(page);

    await frame
      .getByRole('button', { name: 'Full screen', exact: true })
      .click({ timeout: 60_000 });
    await expect(panel(page)).toHaveAttribute('data-view', 'popup');
    await expect(page.getByTestId('master-agent-backdrop')).toBeVisible();

    await frame
      .getByRole('button', { name: 'Exit full screen', exact: true })
      .click();
    await expect(panel(page)).toHaveAttribute('data-view', 'side');
    await expect(page.getByTestId('master-agent-backdrop')).toHaveCount(0);
  });

  // ma-04: Close chat in the embed hides the panel; the header button brings
  // it back in the side view with the embed still there.
  test('user closes the Assistant chat and reopens it from the header', async ({
    page,
  }) => {
    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);
    const frame = embedFrame(page);

    await frame
      .getByRole('button', { name: 'Close chat', exact: true })
      .click({ timeout: 60_000 });
    await expect(panel(page)).toBeHidden();
    await expect(masterAgentButton(page)).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await masterAgentButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-view', 'side');
    await expect(
      frame.getByRole('button', { name: 'Full screen', exact: true }),
    ).toBeVisible({ timeout: 30_000 });
  });

  // ma-05: tapping the header button while the side panel is open hides it.
  test('user taps the Assistant button again and the panel hides', async ({
    page,
  }) => {
    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);

    await masterAgentButton(page).click();
    await expect(panel(page)).toBeHidden();
    await expect(masterAgentButton(page)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  // ma-06: dragging the left-edge handle widens the docked panel and narrows
  // the page content; the width survives close and reopen.
  test('user drags the Assistant resize handle and the width is kept after reopening', async ({
    page,
  }) => {
    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);
    try {
      const handle = page.getByRole('separator', {
        name: 'Resize Assistant',
        exact: true,
      });
      await expect(handle).toBeVisible();
      const panelBefore = await box(panel(page));
      const mainBefore = await box(mainContent(page));
      const handleBox = await box(handle);
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 60, startY, { steps: 5 });
      await page.mouse.move(startX - 120, startY, { steps: 5 });
      await page.mouse.up();

      await expect
        .poll(async () => (await box(panel(page))).width, { timeout: 5_000 })
        .toBeGreaterThanOrEqual(panelBefore.width + 118);
      const panelAfter = await box(panel(page));
      const mainAfter = await box(mainContent(page));
      expect(
        Math.abs(panelAfter.width - (panelBefore.width + 120)),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(mainAfter.width - (mainBefore.width - 120)),
      ).toBeLessThanOrEqual(2);

      await masterAgentButton(page).click();
      await expect(panel(page)).toBeHidden();
      await masterAgentButton(page).click();
      await expect(panel(page)).toBeVisible();
      const panelReopened = await box(panel(page));
      expect(
        Math.abs(panelReopened.width - panelAfter.width),
      ).toBeLessThanOrEqual(2);
    } finally {
      await page.evaluate(
        (key) => window.localStorage.removeItem(key),
        WIDTH_STORAGE_KEY,
      );
    }
  });

  // ma-07: an agent embedded on another website (the harness's <agent-ai>
  // page, a different origin) answers a message, saves its chat under
  // session_id (never the Assistant's session_id:framed) and shows the same
  // conversation after a reload.
  test('user chats with an agent embedded on another website and the conversation comes back after a reload', async ({
    page,
    createMentorPage,
  }) => {
    test.setTimeout(300_000);
    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const cacheKey = `${tenantKey}:${mentorId}`;
    const message = uniqueMessage('website embed');
    const historyLoaded = watchHistoryLoads(page);
    await openLauncher(page);

    const launcher = page.frameLocator(LAUNCHER_IFRAME);
    await expect(launcher.locator('#chat-input-textarea')).toBeVisible({
      timeout: 60_000,
    });
    const embed = await frameOf(page, LAUNCHER_IFRAME);
    await historyLoaded(
      await newlySavedSession(embed, SESSION_KEY, cacheKey, null),
    );

    await chatWithAgent(launcher, message);
    expect(await cachedSession(embed, SESSION_KEY, cacheKey)).toBeTruthy();
    expect(
      await embed.evaluate(
        (key) => window.localStorage.getItem(key),
        FRAMED_SESSION_KEY,
      ),
    ).toBeNull();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(userMessage(launcher, message)).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      launcher.locator('.chat-ai-message-response').first(),
    ).toContainText(/\w/);
  });

  // ma-08: the page and the Assistant chat with the same agent (the
  // organization's Default Agent) and each keeps its own conversation: the
  // page under session_id, the Assistant (same origin, shared localStorage)
  // under session_id:framed. A New chat in the Assistant leaves the page's
  // conversation alone, and neither shows the other's message, before or
  // after a reload.
  test('user chats in the page and in the Assistant, and each keeps its own conversation after a reload', async ({
    page,
    createMentorPage,
  }) => {
    test.setTimeout(360_000);
    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    const cacheKey = `${tenantKey}:${mentorId}`;
    const pageMessage = uniqueMessage('page');
    const panelMessage = uniqueMessage('panel');
    await useAsDefaultAgent(page, tenantKey, mentorId);
    const pageHistoryLoaded = watchHistoryLoads(page);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForPageReady(page);

    const pageSession = await newlySavedSession(
      page,
      SESSION_KEY,
      cacheKey,
      null,
    );
    await pageHistoryLoaded(pageSession);
    await chatWithAgent(page, pageMessage);

    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);
    await expect(page.locator(PANEL_IFRAME)).toHaveAttribute(
      'src',
      new RegExp(`/platform/${tenantKey}/${mentorId}\\?`),
      { timeout: 30_000 },
    );
    const assistant = embedFrame(page);
    const opened = await newlySavedSession(
      page,
      FRAMED_SESSION_KEY,
      cacheKey,
      null,
    );
    await expect(userMessage(assistant, pageMessage)).toHaveCount(0);
    const newChat = assistant.getByRole('button', {
      name: 'New chat',
      exact: true,
    });
    await expect(newChat).toBeVisible({ timeout: 60_000 });
    const panelHistoryLoaded = watchHistoryLoads(page);
    await newChat.click();
    const panelSession = await newlySavedSession(
      page,
      FRAMED_SESSION_KEY,
      cacheKey,
      opened,
    );
    await panelHistoryLoaded(panelSession);
    await chatWithAgent(assistant, panelMessage);

    expect(await cachedSession(page, SESSION_KEY, cacheKey)).toBe(pageSession);
    expect(await cachedSession(page, FRAMED_SESSION_KEY, cacheKey)).toBe(
      panelSession,
    );
    await expect(userMessage(page, pageMessage)).toBeVisible();
    await expect(userMessage(page, panelMessage)).toHaveCount(0);
    await expect(userMessage(assistant, pageMessage)).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForPageReady(page);
    await expect(userMessage(page, pageMessage)).toBeVisible({
      timeout: 60_000,
    });
    await expect(userMessage(page, panelMessage)).toHaveCount(0);

    await expect(masterAgentButton(page)).toBeVisible({ timeout: 30_000 });
    await openPanel(page);
    await expect(userMessage(assistant, panelMessage)).toBeVisible({
      timeout: 60_000,
    });
    await expect(userMessage(assistant, pageMessage)).toHaveCount(0);
  });
});
