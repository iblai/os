/**
 * Journey 58 — Embed Mode Chat Selection Sidebar Guard (issue #2067 / LAIA-684)
 *
 * Regression guard for a bug where selecting a chat from the sidebar history
 * inside the embed widget leaked the FULL sidebar (Agents, Workflows,
 * Projects, Analytics, Management, Notifications, Support) to students.
 *
 * Root cause: `SidebarChatsSection.handleSelectRow` (in
 * `app-sidebar/index.tsx`) unconditionally called
 * `router.push('/platform/<tenant>/<mentor>?session=<id>')` when a history
 * row was clicked. `router.push` replaces the URL, which silently drops the
 * `?embed=true` query param. `useEmbedMode` derives embed state purely from
 * the URL, so losing the param flipped the app out of embed mode mid-session
 * and the full admin sidebar rendered in its place — inside a widget embedded
 * on a third-party site where students should only ever see "New Chat" and
 * "Chats".
 *
 * The fix (commit 67e74db2) navigates ONLY when the current pathname is not
 * already the mentor's own chat page; the session is selected via Redux +
 * the `session_id` localStorage cache (read by `useAdvancedChat`'s
 * `use-chat-history` loader), so no navigation is actually required when the
 * row is clicked from the chat page itself — which is always true inside the
 * embed widget. This test asserts that clicking a row does NOT navigate,
 * that `?embed=true` survives, and that the chat panel still repaints with
 * the clicked session's messages.
 *
 * ── Why two seeded chats ──────────────────────────────────────────────────
 *
 * On a hard page load, `use-chat-history`'s mount effect auto-restores the
 * mentor's cached session from localStorage (`cachedSessionId[mentorId]`) —
 * see `use-advanced-chat.ts` / `use-chat-history.ts` in `@iblai/web-utils`.
 * That means the MOST RECENTLY active chat is already shown before any click.
 * To observe a real "click a history row → panel repaints" transition (and
 * exercise the exact `row.session_id !== appSessionId` branch that used to
 * be entangled with the URL push), this test seeds TWO chats and, after
 * reloading into embed mode, clicks the OLDER of the two — the one that is
 * NOT auto-restored on load.
 *
 * ── Embed URL construction ────────────────────────────────────────────────
 *
 * Mirrors the `embedUrlFor()` helper in journey 13
 * (13-shareable-links-and-embed-integration.spec.ts): take the real mentor
 * chat URL reached via normal UI navigation/mentor creation, and append
 * `?embed=true` via the URL API, then `page.goto()` to it. This is a real
 * page navigation to a URL the app itself would be loaded at inside an
 * iframe — not a hand-built deep link into an unrelated flow.
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/** Builds the embed URL (the iframe's own src) for a mentor page. */
function embedUrlFor(mentorUrl: string): string {
  const url = new URL(mentorUrl);
  url.searchParams.set('embed', 'true');
  url.searchParams.set('extra-body-classes', 'iframed-externally');
  return url.toString();
}

/**
 * Wait for streaming to complete: the first AI message bubble is visible and
 * the send button is re-enabled. Mirrors the readiness signal used by
 * journey 53 (recent-chats-refresh) so we never assert on the Recent list —
 * or here, on the sidebar — before the app's own state has settled.
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

/**
 * Asserts the minimal embed sidebar: New Chat + Chats present; Agents,
 * Workflows, Projects, Analytics, Management, Notifications, and the Support
 * footer link all absent. Used both BEFORE and AFTER the row click so a
 * regression that only appears post-click (the actual bug) is caught.
 */
async function assertMinimalEmbedSidebar(
  sidebarPage: import('../page-objects/sidebar.page').SidebarPage,
): Promise<void> {
  await expect(sidebarPage.newChatButton).toBeVisible({ timeout: 15_000 });

  const chatsTrigger = sidebarPage.sidebar.getByRole('button', {
    name: 'Chats',
    exact: true,
  });
  await expect(chatsTrigger).toBeVisible({ timeout: 15_000 });

  for (const name of [
    'Agents',
    'Workflows',
    'Projects',
    'Analytics',
    'Management',
  ]) {
    const stillVisible = await sidebarPage.isSectionTriggerVisible(name, 3_000);
    expect(stillVisible, `"${name}" section must be ABSENT in embed mode`).toBe(
      false,
    );
  }

  let notificationsVisible = false;
  try {
    await sidebarPage.notificationsLink.waitFor({
      state: 'visible',
      timeout: 3_000,
    });
    notificationsVisible = true;
  } catch {
    notificationsVisible = false;
  }
  expect(
    notificationsVisible,
    'Notifications must be ABSENT in embed mode',
  ).toBe(false);

  const supportVisible = await sidebarPage.isSupportLinkVisible(3_000);
  expect(supportVisible, 'Support link must be ABSENT in embed mode').toBe(
    false,
  );
}

test.describe('Journey 58: Embed Mode Chat Selection Sidebar Guard', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access to create a mentor');
      return;
    }

    // Per-project convention: each test creates its own fresh mentor so the
    // Chats history starts empty and the seeded rows below are unambiguous.
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);
  });

  test('embed mode preserves ?embed=true and hides the full sidebar after selecting a chat from history', async ({
    page,
    chatPage,
    sidebarPage,
  }) => {
    // ── Step 1: Seed TWO chats on the (non-embed) mentor page ────────────────
    // Chat A — will NOT be the auto-restored session after reload.
    const chatAText = `j57 chat-a ${Date.now()}`;
    await chatPage.sendMessage(chatAText);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    // Chat B — sent last, so it becomes the cached/auto-restored session.
    await chatPage.startNewChat();
    await waitForPageReady(page);
    const chatBText = `j57 chat-b ${Date.now()}`;
    await chatPage.sendMessage(chatBText);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);

    // Both chats must be visible in the Recent list before we navigate away —
    // this is our positive precondition, not a negative assertion, so it's
    // safe to anchor on it before touching embed mode.
    await sidebarPage.expandChatsSection();
    await expect
      .poll(async () => sidebarPage.isRecentChatVisible(chatAText, 3_000), {
        message: 'Chat A should be in the Recent list before embed reload',
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);
    await expect
      .poll(async () => sidebarPage.isRecentChatVisible(chatBText, 3_000), {
        message: 'Chat B should be in the Recent list before embed reload',
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);

    // ── Step 2: Reload into embed mode via a real navigation ────────────────
    // The base mentor URL never gained a `?session=` query at this point —
    // sending a message from the composer doesn't route through
    // `handleSelectRow` — so this is still the mentor's bare chat URL.
    const baseMentorUrl = page.url();
    const targetEmbedUrl = embedUrlFor(baseMentorUrl);
    await page.goto(targetEmbedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPageReady(page);

    // ── Step 3: Wait for the embed chat panel to settle, THEN assert absence ──
    // Anchor on a positive signal (the auto-restored Chat B message rendering)
    // before asserting any negatives, so we never race the sidebar's own
    // mount/embed-mode resolution.
    await expect(
      page.locator('.chat-user-message-query', { hasText: chatBText }),
    ).toBeVisible({ timeout: 30_000 });
    expect(page.url()).toContain('embed=true');

    await sidebarPage.ensureExpanded(20_000);
    await assertMinimalEmbedSidebar(sidebarPage);

    // ── Step 4: Open Chats and click the OLDER row (Chat A) ──────────────────
    // Chat B is the one auto-restored on load (see file header comment), so
    // clicking Chat A is a genuine cross-session selection that exercises
    // `handleSelectRow`'s `row.session_id !== appSessionId` branch and its
    // (fixed) pathname-gated navigation.
    await sidebarPage.expandChatsSection();
    await expect
      .poll(async () => sidebarPage.isRecentChatVisible(chatAText, 3_000), {
        message: 'Chat A row should be present in the embed Chats list',
        timeout: 20_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);

    const urlBeforeClick = page.url();
    await sidebarPage.getRecentChatRow(chatAText).click();

    // ── Step 5: Repaint check — Chat A's message must now be shown ───────────
    await expect(
      page.locator('.chat-user-message-query', { hasText: chatAText }),
    ).toBeVisible({ timeout: 30_000 });

    // ── Step 6: THE regression guard — URL and sidebar after the click ───────
    // On `main` (pre-fix) this click called `router.push(.../?session=...)`,
    // which strips `?embed=true` and flips the app out of embed mode — the
    // full sidebar (Agents/Workflows/Projects/Analytics/Management/
    // Notifications/Support) would appear here. On the fix, the row click
    // repaints in place without touching the URL at all.
    const urlAfterClick = page.url();
    expect(urlAfterClick).toContain('embed=true');
    expect(urlAfterClick).not.toContain('session=');
    expect(urlAfterClick).toBe(urlBeforeClick);

    await assertMinimalEmbedSidebar(sidebarPage);
  });
});
