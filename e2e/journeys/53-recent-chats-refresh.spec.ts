/**
 * Journey 53 — Recent Chats Refresh (issue #1982)
 *
 * Regression guard for the `SidebarChatsSection` `useEffect` that calls
 * `refetchRecent()` once streaming finishes on a brand-new chat (exactly 2
 * messages: user + first assistant reply).
 *
 * On `main` the effect was orphaned inside an unrendered component and never
 * fired, so the Recent list stayed stale after the first response. On this
 * branch (`fix/1982`) the effect lives inside the rendered `SidebarChatsSection`
 * and fires correctly.
 *
 * ── Edge cases (DOCUMENTED here, NOT asserted) ────────────────────────────
 *
 * 1. Anonymous user: the effect is gated on `getUserName()` returning a
 *    truthy string. An anonymous session (username = 'anonymous') evaluates
 *    as falsy in the guard, so the refetch never runs. That path is already
 *    covered structurally by journey 14 (anonymous chat) and by unit tests on
 *    `SidebarChatsSection` — duplicating it here would add a fragile, env-
 *    dependent login flow without adding new signal.
 *
 * 2. Mid-stream timing ("row absent while streaming"): the `refetchRecent`
 *    fires ONLY when `isStreaming === false` AND `numberOfActiveChatMessages
 *    === 2`. Asserting on the row WHILE streaming is flaky by design — the
 *    backend hasn't finished writing the session record yet. The spec waits
 *    for streaming to complete before asserting (see `waitForStreamingDone`
 *    below), which eliminates this as a flake vector.
 *
 * ── Streaming-done signal ─────────────────────────────────────────────────
 *
 * We key off two deterministic signals that indicate streaming has completed
 * and the assistant message is fully rendered:
 *   1. `chatPage.aiMessages.first()` visible — the AI message container is
 *      present in the DOM.
 *   2. The send button becomes enabled again — the chat composer re-enables
 *      itself only after the streaming token stream closes and the Redux
 *      `isStreaming` flag is cleared. This is the same readiness signal used
 *      by other journeys (e.g. journey 50 cp-header-04/05) and aligns with
 *      the `useEffect`'s `!isStreaming` guard in the component.
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wait for the streaming to complete. We use two signals in sequence:
 *   1. The first AI message bubble is visible (streaming has started / landed).
 *   2. The send button is enabled again (streaming is done, composer is ready).
 *
 * This mirrors the component's own `!isStreaming` guard so we assert AFTER
 * the same condition that triggers `refetchRecent()`.
 */
async function waitForStreamingDone(
  page: import('@playwright/test').Page,
  sendButton: import('@playwright/test').Locator,
  aiMessages: import('@playwright/test').Locator,
  timeout = 90_000,
): Promise<void> {
  await expect(aiMessages.first()).toBeVisible({ timeout });
  await expect(sendButton).toBeEnabled({ timeout });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('Journey 53: Recent Chats Refresh', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(
        true,
        'Requires admin access — admin is a signed-in named user',
      );
      return;
    }

    // Per-project convention: each test creates its own fresh mentor so the
    // Chats history starts empty and we get a clean baseline for the Recent
    // list assertions.
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);
  });

  // rcr-01: CORE GUARD — new chat appears in Recent after the first AI response
  //
  // This test MUST fail on `main` (where the refetch effect is orphaned in an
  // unrendered component) and MUST pass on `fix/1982` (where the effect lives
  // inside the rendered `SidebarChatsSection`).
  test('admin sends a first message and the new chat appears in Recent without a page reload', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    // ── Step 1: Expand the Chats section and record the baseline ─────────────
    await sidebarPage.expandChatsSection();
    await waitForPageReady(page);

    // A freshly created mentor has no chat history, so the Recent list should
    // start empty (the "No recent chats" empty-state span is visible).
    const startsEmpty = await sidebarPage.isRecentChatsEmpty(5_000);
    if (!startsEmpty) {
      // The mentor may have pre-existing chats from a prior test run that
      // re-used the same name. Accept this gracefully — the critical assertion
      // is that a NEW row matching our sent text appears AFTER the response.
    }

    // ── Step 2: Send the first message ───────────────────────────────────────
    const sentText = `rcr-01 test ${Date.now()}`;
    await chatPage.sendMessage(sentText);

    // ── Step 3: Wait for streaming to complete ────────────────────────────────
    // We MUST wait until streaming is done before asserting on the Recent list.
    // The `refetchRecent()` in `SidebarChatsSection` fires ONLY when
    // `isStreaming === false` AND `numberOfActiveChatMessages === 2`. Asserting
    // before that condition is met would be a race (the mid-stream timing edge
    // case documented at the top of this file).
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    // ── Step 4: Assert the new Recent row appeared — no page reload ──────────
    // After streaming finishes, the effect fires `refetchRecent()`, which
    // updates the RTK Query cache and re-renders the list. We wait up to 20 s
    // for the row to appear (cold-cache refetch + render cycle).
    //
    // Identify the row by SESSION ID, not by `sentText`: the row label prefers
    // the backend's asynchronously generated session title, so the row that
    // does appear is labelled e.g. "RCR-01 Test Results Discussion" rather than
    // the message we sent. Matching on sent text only ever passed while title
    // generation was slower than this poll.
    const { mentorId } = await getPlatformContext(page);
    const sessionId = await chatPage.getCachedSessionId(mentorId);
    expect(sessionId, 'chat session id must be cached after send').toBeTruthy();

    await expect
      .poll(
        async () => sidebarPage.isRecentChatVisibleBySession(sessionId!, 3_000),
        {
          message:
            'Recent chats list should contain the new chat after streaming ends — this fails on main where refetchRecent() is never called',
          timeout: 20_000,
          intervals: [1_000, 2_000, 3_000],
        },
      )
      .toBe(true);
  });

  // rcr-02: Existing recent chat is selectable (adjacent regression guard #1881)
  //
  // Clicking a Recent row must write `cachedSessionId[mentorId]` to localStorage
  // and navigate to `?session=<id>` so the message loader re-fires and the chat
  // panel repopulates. This is the regression caught by fix #1881 where
  // `handleSelectRow` didn't update the cache key.
  //
  // The Chats section is expanded BEFORE sending so the test observes the live
  // empty→row-appears transition in an already-mounted DOM (same scenario as a
  // user watching the sidebar while the AI replies).
  test('admin clicks an existing Recent chat row and the conversation loads', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    // ── Step 1: Expand Chats section before chatting ──────────────────────────
    // Section must be open the whole time so we observe the live update
    // transition (empty state → row appears) in an already-mounted DOM.
    await sidebarPage.expandChatsSection();
    await waitForPageReady(page);

    // ── Step 2: Send the seeded message ──────────────────────────────────────
    const seededText = `rcr-02 seed ${Date.now()}`;
    await chatPage.sendMessage(seededText);

    // ── Step 3: Wait for streaming to complete ────────────────────────────────
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    // ── Step 4: Assert the seeded row appears in Recent ───────────────────────
    // The section was open the whole time — this asserts the live-update
    // transition (the refetchRecent() effect fires, cache updates, list
    // re-renders with the new row while we are watching).
    //
    // Matched by SESSION ID for the same reason as rcr-01: the backend retitles
    // the row asynchronously (here it lands as "RCR-02 Seed Information
    // Inquiry"), so `seededText` stops matching once the title arrives. Captured
    // before Step 5's startNewChat(), which repoints the cached session id.
    const { mentorId } = await getPlatformContext(page);
    const seededSessionId = await chatPage.getCachedSessionId(mentorId);
    expect(
      seededSessionId,
      'seeded chat session id must be cached after send',
    ).toBeTruthy();

    await expect
      .poll(
        async () =>
          sidebarPage.isRecentChatVisibleBySession(seededSessionId!, 3_000),
        {
          message: 'Seeded chat should appear in Recent after streaming ends',
          timeout: 20_000,
          intervals: [1_000, 2_000, 3_000],
        },
      )
      .toBe(true);

    // ── Step 5: Start a new chat to clear the active session ──────────────────
    // Navigate away so clicking back to the seeded row is a real cross-session
    // navigation (not a no-op on the already-active session).
    await chatPage.startNewChat();
    await waitForPageReady(page);

    // ── Step 6: Click the Recent row and assert the conversation repopulates ──
    // This is the #1881 guard: `handleSelectRow` must write
    // `cachedSessionId[mentorId]` to localStorage and the loader effect must
    // re-fire so the chat panel repopulates with the clicked session's messages.
    await sidebarPage.clickFirstRecentChat();

    await expect(chatPage.userMessages.first()).toBeVisible({
      timeout: 30_000,
    });

    // Verify we loaded the correct conversation. The user message bubble in
    // the chat panel must include the first word of the seeded text.
    const userBubble = page.locator('.chat-user-message-query').first();
    const bubbleText = (await userBubble.textContent()) ?? '';
    expect(bubbleText.includes(seededText.split(' ')[0])).toBe(true);
  });
});

// rcr-03: a chat's active options come back with it.
//
// Selecting a Recent row only swaps the session id, so the composer kept
// showing the PREVIOUS chat's tool/canvas state — and the chat used to send
// a session update turning canvas off on the chat being opened. The tools
// hook now restores the opened session's state from the backend.
//
// Runs on the current mentor (no per-test mentor): it only adds one chat and
// finds its Recent row by session id, so it needs no empty Recent baseline.
test.describe('Journey 53: Recent Chats Refresh — session options', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    await waitForPageReady(page);
  });

  test('user reopens a Recent chat that had canvas enabled and the Canvas toggle is active again', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    await sidebarPage.expandChatsSection();
    await waitForPageReady(page);

    // Exact name: with Recents expanded, `chatPage.canvasToggle` (/canvas/i)
    // can match a Recent row whose title mentions "canvas".
    const canvasToggle = page.getByRole('button', {
      name: 'Canvas',
      exact: true,
    });

    // ── Step 1: Enable canvas on this chat and seed it into Recent ────────────
    await expect(canvasToggle).toBeVisible({ timeout: 30_000 });
    if ((await canvasToggle.getAttribute('aria-pressed')) !== 'true') {
      await canvasToggle.click();
    }
    await expect(canvasToggle).toHaveAttribute('aria-pressed', 'true', {
      timeout: 10_000,
    });
    await chatPage.sendMessage(`rcr-03 seed ${Date.now()}: reply with "ok".`);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    const { mentorId } = await getPlatformContext(page);
    const seededSessionId = await chatPage.getCachedSessionId(mentorId);
    expect(
      seededSessionId,
      'seeded chat session id must be cached after send',
    ).toBeTruthy();
    await expect
      .poll(
        async () =>
          sidebarPage.isRecentChatVisibleBySession(seededSessionId!, 3_000),
        {
          message: 'Seeded chat should appear in Recent after streaming ends',
          timeout: 20_000,
          intervals: [1_000, 2_000, 3_000],
        },
      )
      .toBe(true);

    // ── Step 2: Move to a new chat whose Canvas toggle is OFF ─────────────────
    // Some mentors default canvas on; switch it off so the final assertion can
    // only pass if the seeded chat's own state was restored.
    await chatPage.startNewChat();
    await waitForPageReady(page);
    await expect
      .poll(async () => chatPage.getCachedSessionId(mentorId), {
        message: 'New chat must get its own session',
        timeout: 20_000,
      })
      .not.toBe(seededSessionId);
    await expect(canvasToggle).toBeVisible({ timeout: 30_000 });
    if ((await canvasToggle.getAttribute('aria-pressed')) === 'true') {
      await canvasToggle.click();
    }
    await expect(canvasToggle).toHaveAttribute('aria-pressed', 'false', {
      timeout: 10_000,
    });

    // ── Step 3: Reopen the seeded chat — its canvas state comes back ──────────
    await sidebarPage.getRecentChatRowBySession(seededSessionId!).click();
    await expect(chatPage.userMessages.first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(canvasToggle).toHaveAttribute('aria-pressed', 'true', {
      timeout: 20_000,
    });
  });
});
