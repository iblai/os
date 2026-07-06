/**
 * Journey 56 — Chat Search Dialog (issue #2053)
 *
 * Covers the `ChatSearchDialog` opened from the sidebar's "Search chats"
 * entry point (`app-sidebar/index.tsx` — both the expanded text-label
 * button and the collapsed "rail" icon-only button share the accessible
 * name "Search chats"). The dialog itself
 * (`app-sidebar/chats/chat-search-dialog.tsx`) has a search input header,
 * a "New Chat" row, results grouped by recency
 * (`group-chats-by-recency.ts`), and a load-more spinner driven by
 * `use-recent-chats.ts`'s `IntersectionObserver` + `useDebounce`-backed
 * server-side search.
 *
 * ── Deliberately NOT covered here (DOCUMENTED, not asserted) ──────────────
 *
 * 1. Infinite scroll / load-more spinner (`role="status"`,
 *    `[data-testid="chat-search-scroll-sentinel"]`): triggering the
 *    `IntersectionObserver` → `fetchNextPage()` wiring requires a mentor
 *    with MORE than one page of chats (the backend page size). Seeding
 *    10+ real chats through the UI — each requiring a full send +
 *    streaming-wait round trip — is far too slow and adds a large flake
 *    surface for a single pagination assertion. This path is covered
 *    instead by unit tests on `use-recent-chats.ts` (sentinel →
 *    `fetchNextPage` wiring) and the spinner's conditional render in
 *    `chat-search-dialog.tsx`.
 *
 * 2. "Previous 30 Days" / "Older" recency buckets
 *    (`group-chats-by-recency.ts`): the bucket boundaries are computed
 *    from each row's latest message `inserted_at` timestamp being >7 or
 *    >30 days old. A real UI chat send always produces an `inserted_at`
 *    of "now", so aged buckets are not producible by driving the app
 *    through the browser. Covered instead by `groupChatRowsByRecency`
 *    unit tests, which construct rows with synthetic aged timestamps.
 *
 * ── Streaming-done signal (same as Journey 53) ────────────────────────────
 *
 * We key off two deterministic signals that indicate streaming has
 * completed and the assistant message is fully rendered:
 *   1. `chatPage.aiMessages.first()` visible — the AI message container is
 *      present in the DOM.
 *   2. The send button becomes enabled again — the chat composer
 *      re-enables itself only after the streaming token stream closes.
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * Seed exactly 3 distinct chat sessions on the currently-open mentor by
 * sending one distinguishing message per session, starting a NEW chat
 * between each send so every message lands in its own session. Rows are
 * labeled by `chatRowLabel` (`chat-row-label.tsx`), which prefers
 * `row.title` when set — and in practice the backend asynchronously
 * auto-titles a session some time after its first response, so an OLDER
 * seeded session's row label may switch from the raw first human message
 * to a generated title (e.g. "Explain gravity to me <ts>" →
 * "Understanding Gravity Simplified") by the time a later assertion runs.
 * See `TOPIC_KEYWORDS` below for how tests stay robust to this.
 *
 * The LAST seeded chat (pasta) is left as the active session (no
 * `startNewChat()` call after it) so tests can assert cross-session
 * navigation away from — or a fresh reset away from — a session that is
 * actually loaded in the chat panel.
 *
 * A per-run timestamp keeps each seed text unique across repeated runs.
 */
async function seedThreeChats(
  page: import('@playwright/test').Page,
  chatPage: import('../page-objects/chat.page').ChatPage,
): Promise<[string, string, string]> {
  const stamp = Date.now();
  const seeds: [string, string, string] = [
    `What is photosynthesis ${stamp}`,
    `Explain gravity to me ${stamp}`,
    `Give me a pasta recipe ${stamp}`,
  ];

  for (let i = 0; i < seeds.length; i++) {
    await chatPage.sendMessage(seeds[i]);
    await waitForStreamingDone(page, chatPage.sendButton, chatPage.aiMessages);
    if (i < seeds.length - 1) {
      await chatPage.startNewChat();
      await waitForPageReady(page);
    }
  }

  return seeds;
}

/**
 * Topic keywords, in the same order as `seedThreeChats`'s return value.
 *
 * IMPORTANT: the backend asynchronously auto-titles a session some time
 * after its first response (observed in practice: `chatRowLabel` prefers
 * `row.title` once the backend sets it, e.g. "Explain gravity to me
 * <ts>" is later replaced by a generated title like "Understanding
 * Gravity Simplified"). By the time all 3 seed messages have been sent,
 * the two OLDER sessions (photosynthesis, gravity) are frequently already
 * retitled, while the freshest (pasta, no `startNewChat()` after it) is
 * usually still untitled. Row-existence and row-selection assertions
 * therefore match on the topic KEYWORD (present in both the raw message
 * and any generated title) rather than the full sent sentence, which
 * would flake once a session is retitled mid-test.
 */
const TOPIC_KEYWORDS = ['photosynthesis', 'gravity', 'pasta'] as const;

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('Journey 56: Chat Search Dialog', () => {
  test.setTimeout(300_000);

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

    // Per-project convention: each test creates its own fresh mentor so
    // Search chats starts from a clean, isolated chat history.
    await createMentorPage.openAndCreate();
    await waitForPageReady(page);
  });

  // csd-01: Opens and closes
  test('admin opens the Search chats dialog from the expanded sidebar and closes it with Escape', async ({
    page,
    chatPage,
    chatSearchDialogPage,
  }) => {
    await seedThreeChats(page, chatPage);

    await chatSearchDialogPage.openFromSidebar();
    await expect(chatSearchDialogPage.dialog).toBeVisible({ timeout: 10_000 });
    await expect(chatSearchDialogPage.searchbox).toBeFocused({
      timeout: 10_000,
    });

    await chatSearchDialogPage.close();
  });

  // csd-02: Shows the mentor's chats grouped
  test("admin opens Search chats and sees the mentor's chats grouped with single-line labels", async ({
    page,
    chatPage,
    chatSearchDialogPage,
  }) => {
    const seeds = await seedThreeChats(page, chatPage);
    const pastaSeed = seeds[2];

    await chatSearchDialogPage.openFromSidebar();

    await expect(
      chatSearchDialogPage.groupHeader('Previous 7 Days'),
    ).toBeVisible({ timeout: 15_000 });

    // Match by topic keyword (not the full sent sentence) — see
    // `TOPIC_KEYWORDS`'s doc comment on why: older sessions may already be
    // server-side auto-retitled by the time we check.
    for (const keyword of TOPIC_KEYWORDS) {
      await expect(chatSearchDialogPage.rowByText(keyword)).toBeVisible({
        timeout: 15_000,
      });
    }

    // A row renders its label as a single line — no embedded newline. The
    // freshest (pasta) session has no `startNewChat()` after it, so it is
    // the one row still virtually guaranteed to show the raw first human
    // message (not yet auto-retitled), letting us assert it matches the
    // sent text exactly once whitespace is normalized (chatRowLabel does
    // `content.replace(/\s+/g, ' ').trim()`).
    const rowText =
      (await chatSearchDialogPage.rowByText('pasta').textContent()) ?? '';
    expect(rowText.includes('\n')).toBe(false);
    expect(rowText.trim()).toBe(pastaSeed.trim());
  });

  // csd-03: Search filters (server-side, debounced)
  test('admin searches within Search chats and the list filters to the matching session, then clears back to all', async ({
    page,
    chatPage,
    chatSearchDialogPage,
  }) => {
    await seedThreeChats(page, chatPage);
    const [photosynthesisKeyword, gravityKeyword, pastaKeyword] =
      TOPIC_KEYWORDS;

    await chatSearchDialogPage.openFromSidebar();
    await expect(chatSearchDialogPage.rowByText(gravityKeyword)).toBeVisible({
      timeout: 15_000,
    });

    await chatSearchDialogPage.search('gravity');

    // Poll (never a fixed sleep) until the debounced (300ms) server-side
    // search request has round-tripped and the list has settled on the
    // filtered result. Matching by topic keyword (not the full sent
    // sentence) since an older session may already be server-side
    // auto-retitled by the time we check — see `TOPIC_KEYWORDS`.
    await expect
      .poll(
        async () => {
          const [gravityCount, photosynthesisCount, pastaCount] =
            await Promise.all([
              chatSearchDialogPage.rowByText(gravityKeyword).count(),
              chatSearchDialogPage.rowByText(photosynthesisKeyword).count(),
              chatSearchDialogPage.rowByText(pastaKeyword).count(),
            ]);
          return { gravityCount, photosynthesisCount, pastaCount };
        },
        {
          message:
            'Search chats list should filter down to only the matching session',
          timeout: 15_000,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toEqual({ gravityCount: 1, photosynthesisCount: 0, pastaCount: 0 });

    // Clear the search — all 3 seeded rows should return.
    await chatSearchDialogPage.search('');

    await expect
      .poll(
        async () => {
          const [gravityCount, photosynthesisCount, pastaCount] =
            await Promise.all([
              chatSearchDialogPage.rowByText(gravityKeyword).count(),
              chatSearchDialogPage.rowByText(photosynthesisKeyword).count(),
              chatSearchDialogPage.rowByText(pastaKeyword).count(),
            ]);
          return { gravityCount, photosynthesisCount, pastaCount };
        },
        {
          message: 'Clearing the search should restore all seeded rows',
          timeout: 15_000,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toEqual({ gravityCount: 1, photosynthesisCount: 1, pastaCount: 1 });
  });

  // csd-04: New Chat from the dialog
  test('admin clicks New Chat inside Search chats and a fresh empty chat starts', async ({
    page,
    chatPage,
    chatSearchDialogPage,
  }) => {
    await seedThreeChats(page, chatPage);

    // The last seeded chat (pasta) is the active session — its message is
    // currently loaded in the transcript.
    await expect(chatPage.userMessages.first()).toBeVisible({
      timeout: 15_000,
    });

    await chatSearchDialogPage.openFromSidebar();
    await chatSearchDialogPage.newChatRow.click();

    // Dialog closes...
    await expect(chatSearchDialogPage.dialog).not.toBeVisible({
      timeout: 10_000,
    });

    // ...and the transcript resets to a genuinely fresh, empty session —
    // distinct from the previously-active (pasta) seeded session.
    await expect
      .poll(async () => chatPage.userMessages.count(), {
        message: 'New Chat from the search dialog should clear the transcript',
        timeout: 20_000,
        intervals: [500, 1_000, 2_000],
      })
      .toBe(0);
  });

  // csd-05: Selecting a result navigates
  test("admin selects a chat result in Search chats and that session's conversation loads", async ({
    page,
    chatPage,
    chatSearchDialogPage,
  }) => {
    const [photosynthesisSeed] = await seedThreeChats(page, chatPage);
    const [photosynthesisKeyword] = TOPIC_KEYWORDS;

    // Active session is the 3rd seed (pasta) — selecting the FIRST seed is
    // a genuine cross-session navigation (handleSelectRow is a no-op for
    // the already-active session). Select by topic KEYWORD (not the full
    // sent sentence) since this older session may already be server-side
    // auto-retitled by the time we open the dialog — see `TOPIC_KEYWORDS`.
    // The post-navigation assertion below still checks the RAW sent text,
    // since the chat transcript bubble renders the actual message content
    // (unaffected by session-title renaming).
    await chatSearchDialogPage.openFromSidebar();
    await chatSearchDialogPage.selectRow(photosynthesisKeyword);

    await expect(chatSearchDialogPage.dialog).not.toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.locator('.chat-user-message-query', {
        hasText: photosynthesisSeed,
      }),
    ).toBeVisible({ timeout: 30_000 });
  });

  // csd-06: Rail entry point
  test('admin collapses the sidebar and opens Search chats from the rail icon', async ({
    page,
    chatPage,
    sidebarPage,
    chatSearchDialogPage,
  }) => {
    await seedThreeChats(page, chatPage);

    await sidebarPage.toggle();
    await waitForPageReady(page);

    await chatSearchDialogPage.openFromRail();
    await expect(chatSearchDialogPage.dialog).toBeVisible({ timeout: 10_000 });
  });
});
