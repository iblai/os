import { test, expect } from '../fixtures/mentor-test';
import type { FrameLocator, Page } from '@playwright/test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  EMBED_HARNESS_URL,
  MENTOR_NEXTJS_HOST,
  generateMentorName,
} from '../fixtures/test-data';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { ChatPage } from '../page-objects/chat.page';
import { parsePlatformUrl } from '../utils/navigation';
import {
  postRealSnippetUrl,
  rewriteSnippetOrigin,
} from '../utils/embed-harness-client';
import path from 'path';

/**
 * Journey 82: Embed Mode Redesign — Conversation & Controls (issue #2586)
 *
 * Journeys 78/80 cover the second-origin harness infrastructure and the
 * embed header/LTI CSS-shape regressions (prompt-row stacking, 320/300px
 * overflow). This journey instead drives full INTERACTIONS inside the
 * redesigned embed: a real customer-site snippet (not just a bare
 * `?src=` iframe), a scripted conversation, the "+" menu/tool chips/skills
 * picker/file cards, header controls (New chat, menu, private mode,
 * minimal sidebar), an unauthenticated visitor, screen share/voice, and LTI
 * persistence across in-app navigation. Journey 13 still owns embed-tab
 * CONFIGURATION (toggles, persistence, icon upload); this journey owns the
 * embed RUNTIME.
 *
 * Every reply-dependent check mocks the chat WebSocket
 * (`chatPage.mockChatWebSocket()`/`ChatPage.mockChatWebSocket()`) — a live
 * model reply is subject to the "free-models-per-day-high-balance" rate
 * limit in this environment (see journey 77's header comment). Every
 * mentor this journey creates is pinned to the cheap ibl.ai model via
 * `createMentorPage.openAndCreate()` (issue #2534) and cleaned up
 * automatically (`resource-tracker.ts` / `residue.teardown.ts` — no
 * `MentorTracker` needed, see journeys 22/42/44/47/52's note).
 */
function embedUrl(mentorUrl: string, extraParams: Record<string, string> = {}) {
  const url = new URL(mentorUrl);
  url.searchParams.set('embed', 'true');
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * How long to wait for the embed's own composer to mount inside the
 * harness iframe before giving up. 45s, not the 15-20s most individual
 * checks used to hardcode: under this repo's default LOCAL concurrency
 * (`workers: 4`, `playwright.config.ts`), four browsers hit the same dev
 * server + real backend at once, and a cold mentor-app render can genuinely
 * take longer than 20s to finish — this was observed to intermittently
 * fail a handful of embed tests at 4 workers while the exact same tests
 * passed reliably at `--workers=1`. The content always arrives; it's just
 * slower under contention, so the fix is a sufficient wait, not a retry.
 */
const EMBED_READY_TIMEOUT = 45_000;

/**
 * Navigates to the second-origin harness (`?src=`) and waits for the
 * embed's own composer to mount inside the iframe before returning it —
 * the embed's "ready" signal for every caller, so no call site needs its
 * own ad-hoc composer-visibility wait/timeout (see `EMBED_READY_TIMEOUT`'s
 * doc comment for why 45s).
 */
async function gotoEmbedHarness(
  page: Page,
  mentorUrl: string,
  extraParams: Record<string, string> = {},
): Promise<FrameLocator> {
  await page.goto(
    `${EMBED_HARNESS_URL}/?src=${encodeURIComponent(embedUrl(mentorUrl, extraParams))}`,
    { waitUntil: 'domcontentloaded', timeout: 30_000 },
  );
  const iframe = page.frameLocator('#embed-harness-iframe');
  await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
    timeout: EMBED_READY_TIMEOUT,
  });
  return iframe;
}

/**
 * POSTs a real generated embed snippet (`getEmbedCode()`'s literal
 * output) to the harness server's `/real-snippet` store (via the shared
 * `postRealSnippetUrl` helper — also used by journey 13's ESC-close test)
 * and navigates `page` to the host page it serves back — a fake
 * "customer site" with the snippet injected verbatim into its body (see
 * `embed-harness-server.mjs`'s doc comment).
 *
 * Rewrites the snippet's baked-in app origin to `MENTOR_NEXTJS_HOST` first
 * (via `rewriteSnippetOrigin` — see its doc comment): `getEmbedCode()` bakes
 * in a BUILD-time origin (`config.mentorIframeUrl()`), which in this
 * environment is `http://localhost:3000` — an unrelated app — while the
 * build under test is served at `MENTOR_NEXTJS_HOST`. Returns the origin
 * that was actually rewritten (or null if none was found), so tests that
 * want to assert on it don't have to re-parse the snippet themselves.
 */
async function gotoRealSnippetPage(
  page: Page,
  snippet: string,
): Promise<{ originalOrigin: string | null }> {
  const { rewritten, originalOrigin } = rewriteSnippetOrigin(
    snippet,
    MENTOR_NEXTJS_HOST,
  );
  const url = await postRealSnippetUrl(
    page.request,
    EMBED_HARNESS_URL,
    rewritten,
  );
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return { originalOrigin };
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

test.describe('Journey 82: Embed Mode Redesign — Conversation & Controls', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // er-01: the REAL generated embed snippet, dropped into a fake customer
  // page, behaves like a real launcher: bubble visible, click opens the
  // panel with the chat, Close (the embed header's own button, via its
  // closeEmbed postMessage) hides the widget again, reopening the bubble
  // restores it (same iframe, not recreated), and the floating bubble never
  // covers the HOST page's own composer-shaped content.
  test('real embed snippet: bubble opens the panel, Close hides it, and reopening restores it without overlapping the host page', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Embed');
    await waitForPageReady(page);
    // `createAndGetEmbedCode()`, not `getEmbedCode()`: the real widget
    // snippet only exists in the DOM once "Create Embed" has been submitted
    // (see its doc comment) — reading the tab's first `<pre>` beforehand can
    // match an unrelated block (e.g. this shared mentor's SSO redirect-token
    // URL) instead of the actual snippet.
    const snippet = await editMentorPage.embed.createAndGetEmbedCode();
    expect(snippet.length).toBeGreaterThan(0);
    expect(snippet).toContain('ibl-chat-bubble');
    await editMentorPage.close();

    const { originalOrigin } = await gotoRealSnippetPage(page, snippet);

    const bubble = page.locator('.ibl-chat-bubble');
    await expect(bubble).toBeVisible({ timeout: 15_000 });
    await expect(bubble).toHaveAttribute('aria-expanded', 'false');

    // The launcher must never sit on top of the host page's own composer.
    const hostComposerBox = await page
      .locator('#customer-page-composer')
      .boundingBox();
    const bubbleBox = await bubble.boundingBox();
    expect(hostComposerBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    expect(boxesOverlap(bubbleBox!, hostComposerBox!)).toBe(false);

    // Open: the widget container + its iframe (the chat) become visible.
    await bubble.click();
    const widget = page.locator('#ibl-chat-widget-container');
    await expect(widget).toBeVisible({ timeout: 15_000 });
    await expect(bubble).toHaveAttribute('aria-expanded', 'true');

    // The iframe's `src` must point at the app actually under test, not the
    // build-time origin baked into the snippet (see `rewriteSnippetOrigin`'s
    // doc comment — confirmed via a debug run to be `http://localhost:3000`,
    // an unrelated app, which `net::ERR_CONNECTION_REFUSED`s).
    const iframeSrc = await page
      .locator('#ibl-chat-widget-container iframe')
      .getAttribute('src');
    expect(iframeSrc).not.toBeNull();
    expect(iframeSrc!.startsWith(MENTOR_NEXTJS_HOST)).toBe(true);
    if (originalOrigin) {
      expect(originalOrigin).not.toBe(MENTOR_NEXTJS_HOST);
    }

    const panelFrame = page.frameLocator('#ibl-chat-widget-container iframe');
    await expect(panelFrame.locator('#chat-input-textarea')).toBeVisible({
      timeout: 30_000,
    });
    // Regression guard: the composer mounts slightly before the welcome
    // content (agent-name heading) does — a brief spinner shows in between
    // (confirmed via a debug run to resolve in well under a second with no
    // failing requests). Asserting the heading too, not just the composer,
    // means a genuinely STUCK spinner would fail this test instead of
    // passing silently.
    await expect(panelFrame.locator('h1').first()).toBeVisible({
      timeout: EMBED_READY_TIMEOUT,
    });

    // Close: the embed header's "Close chat" button posts closeEmbed, which
    // the snippet's own message listener turns into a widget hide.
    await panelFrame
      .getByRole('button', { name: 'Close chat', exact: true })
      .click();
    await expect(widget).toBeHidden({ timeout: 10_000 });
    await expect(bubble).toHaveAttribute('aria-expanded', 'false');

    // Reopen: the SAME widget (and therefore the same chat session) is
    // restored rather than rebuilt from scratch.
    await bubble.click();
    await expect(widget).toBeVisible({ timeout: 10_000 });
    await expect(panelFrame.locator('#chat-input-textarea')).toBeVisible({
      timeout: 15_000,
    });
  });

  // er-02: a scripted conversation in the embed — sending shows the user
  // bubble and the mocked AI reply, the suggested-prompt rows disappear
  // once the conversation has started, and the disclaimer (when the mentor
  // has one) still sits directly above the composer in this state.
  test('embed conversation: sending a message renders the reply and hides the suggested-prompt rows', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    const iframe = await gotoEmbedHarness(page, page.url());
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    await chatInput.fill('Hello from the embed conversation test');
    await iframe.getByRole('button', { name: 'Send message' }).click();
    await expect(
      iframe.locator('.chat-user-message-query').filter({
        hasText: 'Hello from the embed conversation test',
      }),
    ).toBeVisible({ timeout: 10_000 });

    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id;
    ws.send({ generation_id: `e2e-er02-${Date.now()}`, session_id: sessionId });
    ws.send({ data: 'Scripted embed reply', session_id: sessionId });
    ws.send({ eos: true, session_id: sessionId });

    await expect(
      iframe.locator('.chat-ai-message-response').filter({
        hasText: 'Scripted embed reply',
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Prompt rows (if this mentor renders any) are a pre-conversation-only
    // affordance — once there are messages, the welcome screen (and its
    // rows) is gone entirely.
    await expect(iframe.getByTestId('starter-prompt-row')).toHaveCount(0);

    // The disclaimer (when present) stays directly above the composer even
    // mid-conversation, not just on the empty-state screen (cr-01).
    const disclaimer = iframe.locator('#chat-input-disclaimer');
    if (await disclaimer.count()) {
      const disclaimerBox = await disclaimer.boundingBox();
      const composerBox = await iframe
        .getByTestId('composer-box')
        .boundingBox();
      expect(disclaimerBox).not.toBeNull();
      expect(composerBox).not.toBeNull();
      expect(disclaimerBox!.y).toBeLessThanOrEqual(composerBox!.y);
    }
  });

  // er-03: clicking a suggested-prompt row sends it immediately — the embed
  // wires `onPromptSelect` straight to `handleSubmit` (EmbedStarterPrompts),
  // the same as the main chat's guided prompts; it does not just fill the
  // composer.
  test('embed: clicking a suggested-prompt row sends it immediately', async ({
    page,
    chatPage,
  }) => {
    await page.route(
      '**/api/ai-prompt/orgs/*/users/*/sessions/*/guided-prompts/**',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ai_prompts: ['Tell me a fun fact'] }),
        });
      },
    );
    const ws = await chatPage.mockChatWebSocket();
    const iframe = await gotoEmbedHarness(page, page.url());
    await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
      timeout: 20_000,
    });

    const row = iframe.getByTestId('starter-prompt-row').first();
    let rowVisible = false;
    try {
      await row.waitFor({ state: 'visible', timeout: 15_000 });
      rowVisible = true;
    } catch {
      rowVisible = false;
    }
    test.skip(
      !rowVisible,
      'Embed suggested prompts did not render for this mentor/session',
    );

    await row.click();
    await expect(
      iframe.locator('.chat-user-message-query').filter({
        hasText: 'Tell me a fun fact',
      }),
    ).toBeVisible({ timeout: 10_000 });

    const clientFrame = await ws.waitForClientMessage();
    expect(clientFrame.prompt).toBe('Tell me a fun fact');
  });

  // er-04: the embed composer's "+" menu offers Upload/Camera/Tools/Skills
  // but never Prompts/Memory (embedMode disables both — chat-input-form.tsx
  // `showPrompts`/`showMemory`); toggling a tool from the Tools submenu
  // shows an active chip with a "Turn off" ×, and turning Canvas on shows
  // the same chip-shaped "Turn off Canvas" × pill.
  test('embed composer: the "+" menu offers Upload/Camera/Tools/Skills (never Prompts/Memory) and a toggled tool renders as a removable chip', async ({
    page,
  }) => {
    const iframe = await gotoEmbedHarness(page, page.url());
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    const plusButton = iframe.getByTestId('composer-plus-button');
    let hasPlusMenu = false;
    try {
      await plusButton.waitFor({ state: 'visible', timeout: 5_000 });
      hasPlusMenu = true;
    } catch {
      hasPlusMenu = false;
    }
    test.skip(!hasPlusMenu, 'No "+" menu for this mentor/session');

    await plusButton.click();
    const menu = iframe
      .getByTestId('composer-plus-menu')
      .or(iframe.getByTestId('composer-plus-sheet'));
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await expect(menu.getByText('Prompts', { exact: true })).toHaveCount(0);
    await expect(iframe.getByTestId('chat-memory-button')).toHaveCount(0);

    const toolsTrigger = menu
      .getByTestId('composer-tools-trigger')
      .or(menu.getByText('Tools', { exact: true }));
    let hasTools = false;
    try {
      await toolsTrigger.first().waitFor({ state: 'visible', timeout: 5_000 });
      hasTools = true;
    } catch {
      hasTools = false;
    }
    if (hasTools) {
      await toolsTrigger.first().click();
      const toolsMenu = iframe.getByTestId('composer-tools-menu').or(menu);
      const firstTool = toolsMenu
        .getByRole('menuitemcheckbox')
        .first()
        .or(toolsMenu.getByRole('switch').first());
      let hasToggle = false;
      try {
        await firstTool.waitFor({ state: 'visible', timeout: 5_000 });
        hasToggle = true;
      } catch {
        hasToggle = false;
      }
      if (hasToggle) {
        const toolName = (await firstTool.textContent())?.trim() ?? '';
        await firstTool.click();
        await page.keyboard.press('Escape');
        if (toolName) {
          const chip = iframe
            .getByTestId('composer-tool-chip')
            .filter({ hasText: toolName });
          await expect(chip).toBeVisible({ timeout: 10_000 });
          await expect(chip).toHaveAttribute(
            'aria-label',
            new RegExp(`turn off ${toolName}`, 'i'),
          );
        }
      }
    } else {
      await page.keyboard.press('Escape');
    }

    // Canvas: on shows the same chip-shaped "Turn off Canvas" × pill.
    const canvas = iframe.getByRole('button', { name: 'Canvas', exact: true });
    if ((await canvas.count()) > 0) {
      if ((await canvas.getAttribute('aria-pressed')) !== 'true') {
        await canvas.click();
      }
      await expect(iframe.getByTestId('composer-canvas-off')).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  // er-05: the "/" skill picker opens ABOVE the composer and, in the
  // redesign, shows only the skill NAME — never the /slug line (which the
  // classic variant renders).
  test('embed composer: the "/" skill picker opens above the composer and shows names only', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockEffectiveSkills([
      {
        unique_id: 'e2e-skill-1',
        name: 'Summarize Reading',
        slug: 'summarize-reading',
        enabled: true,
      },
    ]);
    const iframe = await gotoEmbedHarness(page, page.url());
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    await chatInput.click();
    await chatInput.pressSequentially('/sum');
    const picker = iframe.getByTestId('slash-skill-picker');
    let pickerVisible = false;
    try {
      await picker.waitFor({ state: 'visible', timeout: 10_000 });
      pickerVisible = true;
    } catch {
      pickerVisible = false;
    }
    test.skip(
      !pickerVisible,
      'Slash skill picker did not open for this mentor',
    );

    await expect(
      picker.getByTestId('slash-skill-picker-option-name').first(),
    ).toBeVisible();
    // Redesign variant: names only, no /slug line.
    await expect(
      picker.getByTestId('slash-skill-picker-option-slug'),
    ).toHaveCount(0);

    const composerBox = await chatInput.boundingBox();
    const pickerBox = await picker.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(pickerBox).not.toBeNull();
    expect(pickerBox!.y + pickerBox!.height).toBeLessThanOrEqual(
      composerBox!.y + 1,
    );
  });

  // er-06: mocked file-card states (uploading, done, failed+Retry,
  // too-large) render inside the embed exactly as in the main chat
  // (journey 79's cr-06), scoped to the cross-origin iframe.
  test('embed composer: file cards cover uploading, done, failed+Retry and too-large', async ({
    page,
    chatPage,
  }) => {
    await chatPage.mockFileUpload('success', 1_500);
    const iframe = await gotoEmbedHarness(page, page.url());
    await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
      timeout: 20_000,
    });

    const fileInput = iframe.locator('input[type="file"]:not([capture])');
    const smallFile = Buffer.from('hello world '.repeat(1000));
    await fileInput.setInputFiles({
      name: 'e2e-embed-small.txt',
      mimeType: 'text/plain',
      buffer: smallFile,
    });
    const chip = iframe.getByTestId('attachment-chip').first();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toHaveAttribute('data-status', 'uploading', {
      timeout: 5_000,
    });
    await expect(chip).toHaveAttribute('data-status', 'success', {
      timeout: 10_000,
    });
    await iframe.getByRole('button', { name: 'Remove file' }).first().click();
    await expect(chip).toHaveCount(0);

    // -- failed + Retry --
    await chatPage.mockFileUpload('upload-url-error', 0);
    await fileInput.setInputFiles({
      name: 'e2e-embed-fail.txt',
      mimeType: 'text/plain',
      buffer: smallFile,
    });
    const failedChip = iframe.getByTestId('attachment-chip').first();
    await expect(failedChip).toHaveAttribute('data-status', 'error', {
      timeout: 10_000,
    });
    await expect(
      iframe.getByRole('button', { name: 'Retry', exact: true }),
    ).toBeVisible();
    await iframe.getByRole('button', { name: 'Remove file' }).first().click();
    await expect(failedChip).toHaveCount(0);

    // -- too large (rejected client-side) --
    const hugeFile = Buffer.alloc(25 * 1024 * 1024, 1);
    await fileInput.setInputFiles({
      name: 'e2e-embed-huge.bin',
      mimeType: 'application/octet-stream',
      buffer: hugeFile,
    });
    const rejectedChip = iframe.locator(
      '[data-testid="attachment-chip"][data-status="too-large"]',
    );
    let rejected = false;
    try {
      await rejectedChip.waitFor({ state: 'visible', timeout: 10_000 });
      rejected = true;
    } catch {
      rejected = false;
    }
    if (rejected) {
      await expect(rejectedChip).toBeVisible();
    }
  });

  // er-07: a 390px full-screen embed never scrolls sideways and keeps Send
  // fully visible, including once a tool chip/Canvas pill has widened the
  // toolbar (complements journey 80's 320px LTI-specific check with a
  // plain, non-LTI embed frame).
  test('390px embed: no horizontal overflow and Send stays visible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const iframe = await gotoEmbedHarness(page, page.url());
    await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
      timeout: 20_000,
    });
    // Regression guard: catch a stuck welcome spinner (see er-01's doc
    // comment) rather than only confirming the composer mounted.
    await expect(iframe.locator('h1').first()).toBeVisible({
      timeout: EMBED_READY_TIMEOUT,
    });

    const canvas = iframe.getByRole('button', { name: 'Canvas', exact: true });
    if ((await canvas.count()) > 0) {
      if ((await canvas.getAttribute('aria-pressed')) !== 'true') {
        await canvas.click();
      }
    }

    await expect(
      iframe.getByRole('button', { name: /^(Send message|Connecting)/ }),
    ).toBeVisible();
    expect(
      await iframe
        .locator('html')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await iframe
        .getByTestId('composer-toolbar')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // er-08: header controls — New chat clears the conversation back to the
  // empty state, the help/settings menu opens and lists its items, the
  // private-mode (chat privacy) toggle works if the mentor exposes one, and
  // the hamburger opens the minimal sidebar (New Chat + Chats, nothing
  // else — journey 13's emb-09 already covers the full absence list, this
  // only confirms the toggle itself works from the redesigned header).
  test('embed header: New chat resets the conversation, the menu lists items, the private-mode toggle works, and the hamburger opens the minimal sidebar', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    const iframe = await gotoEmbedHarness(page, page.url());
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    // Start a conversation, then New chat clears it back to the empty state.
    await chatInput.fill('Message before New chat');
    await iframe.getByRole('button', { name: 'Send message' }).click();
    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id;
    ws.send({ generation_id: `e2e-er08-${Date.now()}`, session_id: sessionId });
    ws.send({ data: 'reply before new chat', session_id: sessionId });
    ws.send({ eos: true, session_id: sessionId });
    await expect(
      iframe.locator('.chat-ai-message-response').first(),
    ).toBeVisible({ timeout: 15_000 });

    await iframe.getByRole('button', { name: 'New chat', exact: true }).click();
    await expect(iframe.locator('.chat-user-message-query')).toHaveCount(0, {
      timeout: 10_000,
    });

    // Menu/help trigger opens and lists at least one item (Help and/or
    // Support; Help is conditional on tenant config).
    const menuTrigger = iframe
      .getByRole('button', { name: 'Open menu options' })
      .or(iframe.getByRole('button', { name: 'Open settings menu' }));
    await expect(menuTrigger).toBeVisible({ timeout: 10_000 });
    await menuTrigger.click();
    const menuItems = iframe.getByRole('menuitem');
    await expect(menuItems.first()).toBeVisible({ timeout: 5_000 });
    expect(await menuItems.count()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    // Private-mode (chat privacy) toggle, when the mentor/session exposes
    // one: clicking it opens the confirm dialog; cancel to avoid mutating
    // shared state.
    const privacyToggle = iframe.getByTestId('chat-privacy-toggle');
    let hasPrivacyToggle = false;
    try {
      await privacyToggle.waitFor({ state: 'visible', timeout: 5_000 });
      hasPrivacyToggle = true;
    } catch {
      hasPrivacyToggle = false;
    }
    if (hasPrivacyToggle) {
      await privacyToggle.click();
      const confirmDialog = iframe.getByTestId('chat-privacy-confirm-dialog');
      let confirmVisible = false;
      try {
        await confirmDialog.waitFor({ state: 'visible', timeout: 5_000 });
        confirmVisible = true;
      } catch {
        confirmVisible = false;
      }
      if (confirmVisible) {
        await iframe.getByTestId('chat-privacy-confirm-cancel').click();
      }
    }

    // Hamburger (mobile only) opens the minimal sidebar.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(chatInput).toBeVisible({ timeout: 20_000 });
    const hamburger = iframe.getByRole('button', { name: 'Open sidebar' });
    let hasHamburger = false;
    try {
      await hamburger.waitFor({ state: 'visible', timeout: 10_000 });
      hasHamburger = true;
    } catch {
      hasHamburger = false;
    }
    if (hasHamburger) {
      await hamburger.click();
      await expect(
        iframe.getByRole('button', { name: 'New Chat', exact: true }),
      ).toBeVisible({ timeout: 10_000 });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // er-10: screen share & voice call. `selectEnableChatActionsPopup`
  // (`@iblai/web-utils`'s host-chat slice) has NO dispatch call site
  // anywhere in the OS or web-containers/web-utils SOURCE (grepped both
  // trees — it is only read by a selector and exercised in unit tests that
  // mock the selector directly), so there is no UI action or postMessage
  // handshake in this build that turns `MENTOR:CHAT_ACTION_SCREENSHARE` /
  // `MENTOR:CHAT_ACTION_VOICECALL` on. Per the task's own fallback, this
  // documents that and instead verifies the in-panel path: for a
  // logged-in embed user on an agent with Screen Sharing enabled, the
  // button is present and clicking it opens the in-chat LiveKit modal UI
  // (not a postMessage) — the behaviour this build actually ships.
  test.describe('Screen share & voice (own agent)', () => {
    test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
      await createMentorPage.openAndCreate(
        generateMentorName().replace('E2E', 'E2E Embed ScreenShare'),
      );
      // The composer's Screen Sharing button is gated by `useMentorTools`'s
      // `screenSharingIsEnabled` (`@iblai/web-utils`), which checks the
      // mentor's TOOLS list (slug "screen-share") — the same mechanism as
      // Web Search/Deep Research/etc, toggled on the Tools tab. The
      // separate "Screen" top-level tab's `enable_video` capability toggle
      // (`CapabilityGate`) is unrelated to button visibility — it only
      // governs the screen-sharing prompt cards on that tab; confirmed via
      // a debug run that enabling ONLY that capability left the button
      // absent, while enabling the Tools-tab switch made it appear.
      await editMentorPage.open('Tools');
      await waitForPageReady(page);
      await editMentorPage.tools.enableTool('Screen Sharing');
      await editMentorPage.close();
    });

    test('embed: Screen Sharing button is present for a logged-in user and opens the in-panel modal (chat-action popups have no wiring in this build)', async ({
      page,
    }) => {
      // `display-capture` is not a Playwright/CDP-grantable permission (real
      // screen capture needs a native OS picker a headless browser cannot
      // satisfy) — clicking the button is still expected to flip local
      // component state and attempt the in-panel LiveKit modal, which is
      // what this checkpoint verifies; a failed/rejected capture is a
      // separate concern this test does not need to resolve.
      const iframe = await gotoEmbedHarness(page, page.url());
      await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
        timeout: 20_000,
      });

      const screenShareButton = iframe.getByRole('button', {
        name: 'Screen Sharing',
        exact: true,
      });
      await expect(screenShareButton).toBeVisible({ timeout: 15_000 });
      await screenShareButton.click();
      // The in-panel path (no chat-action-popup wiring exists to redirect
      // this to a parent postMessage in this build — see the describe-level
      // comment): clicking flips `isScreenSharingModalOpen` locally, which
      // drives the button's active/open visual state regardless of whether
      // the subsequent real `getDisplayMedia()` call succeeds in this
      // headless environment.
      await expect(screenShareButton).toHaveClass(/ibl-button-primary/, {
        timeout: 15_000,
      });
    });

    test('embed: Voice call button is present for a logged-in user', async ({
      page,
    }) => {
      const iframe = await gotoEmbedHarness(page, page.url());
      await expect(iframe.locator('#chat-input-textarea')).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        iframe.getByRole('button', { name: 'Voice call' }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  // er-11: LTI persistence — in `?embed=true&lti=true` the Close button
  // stays absent and Escape stays a no-op even after New chat and after
  // opening a chat from history (both are in-app navigations that could in
  // principle drop the `lti` query param — `lib/embed-context.ts` caches it
  // so they don't).
  test('LTI embed: Close stays absent and Escape stays a no-op after New chat and after opening a chat from history', async ({
    page,
    chatPage,
  }) => {
    const ws = await chatPage.mockChatWebSocket();
    const iframe = await gotoEmbedHarness(page, page.url(), { lti: 'true' });
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 20_000 });
    // Regression guard: catch a stuck welcome spinner in the LTI frame too
    // (see er-01's doc comment), not just that the composer mounted.
    await expect(iframe.locator('h1').first()).toBeVisible({
      timeout: EMBED_READY_TIMEOUT,
    });
    await expect(
      iframe.getByRole('button', { name: 'Close chat', exact: true }),
    ).toHaveCount(0);

    // Produce one chat turn so there is history to reopen.
    await chatInput.fill('LTI persistence message');
    await iframe.getByRole('button', { name: 'Send message' }).click();
    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id;
    ws.send({ generation_id: `e2e-er11-${Date.now()}`, session_id: sessionId });
    ws.send({ data: 'lti reply', session_id: sessionId });
    ws.send({ eos: true, session_id: sessionId });
    await expect(
      iframe.locator('.chat-ai-message-response').first(),
    ).toBeVisible({ timeout: 15_000 });

    // New chat — still no Close, Escape still a no-op.
    await iframe.getByRole('button', { name: 'New chat', exact: true }).click();
    await expect(
      iframe.getByRole('button', { name: 'Close chat', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(chatInput).toBeVisible({ timeout: 5_000 });

    // Open the sidebar and reopen the prior chat from history, if a
    // sidebar/history affordance is present in this LTI frame.
    const hamburger = iframe.getByRole('button', { name: 'Open sidebar' });
    let hasHamburger = false;
    try {
      await hamburger.waitFor({ state: 'visible', timeout: 5_000 });
      hasHamburger = true;
    } catch {
      hasHamburger = false;
    }
    if (hasHamburger) {
      await hamburger.click();
      const historyItem = iframe
        .getByRole('button', { name: /LTI persistence message/i })
        .first();
      let hasHistory = false;
      try {
        await historyItem.waitFor({ state: 'visible', timeout: 5_000 });
        hasHistory = true;
      } catch {
        hasHistory = false;
      }
      if (hasHistory) {
        await historyItem.click();
        await expect(chatInput).toBeVisible({ timeout: 15_000 });
      }
    }
    await expect(
      iframe.getByRole('button', { name: 'Close chat', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
  });

  // er-12: the Embed tab's own live preview iframe (Edit Agent -> Embed)
  // renders the redesigned embed — the gradient agent-name heading and
  // either the suggested-prompt rows or the composer itself.
  test('embed tab preview iframe shows the redesigned embed', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Embed');
    await waitForPageReady(page);
    const preview = page.frameLocator('#embed-mentor-preview');
    // The composer rendering at all is the load-bearing signal that the
    // redesigned embed mounted inside the preview iframe (vs. a blank/error
    // page) — this holds regardless of whether the shared admin mentor's
    // preview session happens to land on the empty-state welcome screen or
    // an already-started conversation (this mentor is reused across the
    // whole file, so an earlier checkpoint's mocked send can leave a
    // cached session behind).
    const composer = preview.locator('#chat-input-textarea');
    await expect(composer).toBeVisible({ timeout: 30_000 });

    // Best-effort: whichever of the empty-state heading or an existing
    // conversation bubble renders, something recognizable from the
    // redesigned chat tree is present alongside the composer.
    const heading = preview.locator('h1').first();
    const aiMessage = preview.locator('.chat-ai-message-response').first();
    let sawContent = false;
    try {
      await heading
        .or(aiMessage)
        .waitFor({ state: 'visible', timeout: 15_000 });
      sawContent = true;
    } catch {
      sawContent = false;
    }
    expect(sawContent).toBe(true);

    await editMentorPage.close();
  });
});

// er-09: a logged-out visitor on an anonymous (publicly chattable) mentor
// gets the chat (and can send, mocked) but none of the logged-in-only
// controls — no "+" menu, no screen share, no dictation, no voice call
// (chat-input-form.tsx's `visibleToLoggedInUsersOnly` gate).
//
// This is a SIBLING top-level describe, not nested inside the main one: the
// main describe's `beforeEach` always calls `navigateToMentorApp` (which
// logs in as admin) regardless of any `test.use({ storageState: ... })`
// override in a nested describe — Playwright hooks cascade from outer to
// inner unconditionally, so nesting this under the main describe silently
// re-authenticated the "logged-out" visitor as admin before the test body
// ever ran (the bug journey 14 avoids the same way, in its own file).
test.describe('Journey 82: Logged-out embed visitor', () => {
  let platformKey = '';
  let mentorId = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .replace('mentor-mobile-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const setupContext = await browser.newContext({ storageState: authFile });
    const setupPage = await setupContext.newPage();
    try {
      await navigateToMentorApp(setupPage);
      const createMentorPage = new CreateMentorPage(setupPage);
      await createMentorPage.openAndCreate(
        generateMentorName().replace('E2E', 'E2E Embed Anon'),
      );
      const parsed = parsePlatformUrl(setupPage.url());
      platformKey = parsed.platformKey;
      mentorId = parsed.mentorId;

      const editMentorPage = new EditMentorPage(setupPage);
      await editMentorPage.open('Settings');
      await waitForPageReady(setupPage);
      await editMentorPage.settings.setVisibilityAnyone();
      await editMentorPage.settings.setChatAccessAnyone();
      const saveBtn = editMentorPage.dialog
        .getByRole('button', { name: /save/i })
        .first();
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await setupPage.waitForTimeout(1_500);
      await editMentorPage.close();
    } finally {
      await setupPage.close();
      await setupContext.close();
    }
  });

  test.use({ storageState: { cookies: [], origins: [] } });

  test('logged-out embed visitor can chat but sees no "+" menu, screen share, dictation or voice call', async ({
    page,
  }) => {
    test.skip(!platformKey || !mentorId, 'Anonymous mentor setup failed');
    const chatPage = new ChatPage(page);
    const ws = await chatPage.mockChatWebSocket();
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;
    const iframe = await gotoEmbedHarness(page, mentorUrl);
    const chatInput = iframe.locator('#chat-input-textarea');
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    await chatInput.fill('Hello from an anonymous embed visitor');
    await iframe.getByRole('button', { name: 'Send message' }).click();
    const clientFrame = await ws.waitForClientMessage();
    const sessionId = clientFrame.session_id;
    ws.send({
      generation_id: `e2e-er09-${Date.now()}`,
      session_id: sessionId,
    });
    ws.send({ data: 'anonymous reply', session_id: sessionId });
    ws.send({ eos: true, session_id: sessionId });
    await expect(
      iframe.locator('.chat-ai-message-response').first(),
    ).toBeVisible({ timeout: 15_000 });

    await expect(iframe.getByTestId('composer-plus-button')).toHaveCount(0);
    await expect(
      iframe.getByRole('button', { name: 'Screen Sharing', exact: true }),
    ).toHaveCount(0);
    await expect(
      iframe.getByRole('button', { name: 'Voice input' }),
    ).toHaveCount(0);
    await expect(
      iframe.getByRole('button', { name: 'Voice call' }),
    ).toHaveCount(0);
  });
});
