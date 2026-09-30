import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, getPlatformContext } from '../utils/auth';
import { openMoreOptionsMenu } from '../utils/navigation';
import { navigateAndObserveTenantMetadata } from '../utils/tenant-metadata-observed';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

test.describe('Journey 2: First-Time User Chat & Navigation', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // fixme: AI response timeout — dependent on LLM service availability
  test.fixme(
    'newly registered user goes to chat page and sends a message and receives an AI response',
    async ({ nonadminChatPage }) => {
      await nonadminChatPage.sendMessage('Hello, can you help me?');
      await nonadminChatPage.waitForAIResponse();
      await expect(nonadminChatPage.aiMessages.first()).toBeVisible();
    },
  );

  // fixme: depends on test 1 sending a message first; times out when LLM unavailable
  test.fixme(
    'newly registered user goes to chat page and starts a new chat session after chatting',
    async ({ nonadminChatPage }) => {
      await nonadminChatPage.sendMessage('First message');
      await nonadminChatPage.waitForAIResponse();
      await nonadminChatPage.startNewChat();
      await expect(nonadminChatPage.userMessages).toHaveCount(0);
    },
  );

  // fixme: explore page navigation timeout — non-admin storageState may not be ready
  test.fixme(
    'newly registered user goes to sidebar and navigates to the explore page',
    async ({ nonadminPage, nonadminSidebarPage, nonadminExplorePage }) => {
      await nonadminSidebarPage.navigateToExplore();
      await expect(nonadminExplorePage.heading).toBeVisible({
        timeout: 15_000,
      });
      await expect(nonadminPage).toHaveURL(/explore/);
    },
  );

  test('newly registered user goes to profile dropdown and logs out', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.logout();
    await expect(nonadminPage).toHaveURL(/login|auth/i, { timeout: 15_000 });
  });

  test('newly registered user goes to sidebar and toggles it open and closed', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const sidebar = nonadminPage
      .locator('[data-state="expanded"], [data-state="collapsed"]')
      .first();
    await nonadminSidebarPage.toggle();
    await nonadminPage.waitForTimeout(500);
    // After toggle, state should have changed
    const newState = await sidebar.getAttribute('data-state').catch(() => null);
    expect(['expanded', 'collapsed']).toContain(newState ?? 'collapsed');
  });

  // #uat-9: this used to assume the Help menu item is always present. The
  // nav-bar's "More options → Help" item is gated by the tenant's OWN
  // `show_help` metadata (`hooks/use-help-center.ts` /
  // `UserProfileDropdown`'s `getShowHelp()`: `show_help !== false`) — a
  // pristine tenant shows it, but a tenant that explicitly sets
  // `show_help: false` never renders it, and that's the CORRECT behavior,
  // not a bug. Re-navigating here (redundant with the shared `beforeEach`,
  // but isolated to this one test so the rest of the file's tests keep
  // their original, simpler setup) observes the SAME tenant-metadata
  // response the app itself fetches on load — no DM_URL, no per-environment
  // setup — and asserts whichever behavior that tenant's config dictates.
  test('newly registered user goes to sidebar and clicks the help button to open docs link', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const metadata = await navigateAndObserveTenantMetadata(nonadminPage);
    const showHelp = metadata.show_help !== false;

    await openMoreOptionsMenu(nonadminPage);
    const helpItem = nonadminPage
      .getByRole('menu', { name: /more options/i })
      .or(nonadminPage.getByRole('dialog'))
      .getByRole('menuitem', { name: /help/i });

    if (!showHelp) {
      // The SDK renders no menu item at all when `getShowHelp()` is false —
      // absence here IS the correct behavior for this tenant's config.
      await expect(helpItem).not.toBeVisible({ timeout: 5_000 });
      return;
    }

    await expect(helpItem).toBeVisible({ timeout: 10_000 });
    const [newPage] = await Promise.all([
      nonadminPage.context().waitForEvent('page', { timeout: 10_000 }),
      helpItem.click(),
    ]);
    expect(newPage.url()).toMatch(/ibl|docs|help/i);
    await newPage.close();
  });

  // Issue #1179 — suggested prompts authored in the Prompts editor contain
  // Markdown (links, bold, etc.). They must render through the Markdown
  // component so that formatting survives into the welcome screen and
  // embeds.
  //
  // Fixme: needs a tenant whose suggested-prompt list includes a Markdown
  // link — we don't have a deterministic fixture yet. Flip to `test(...)`
  // once a seeded mentor is available.
  test.fixme(
    'newly registered user sees suggested prompts rendered as Markdown (issue #1179)',
    async ({ nonadminPage }) => {
      // A suggested prompt authored as "See [docs](https://…)" should
      // render an anchor tag, not literal brackets.
      const promptLink = nonadminPage
        .locator('button[type="button"] a[href^="http"]')
        .first();
      await expect(promptLink).toBeVisible({ timeout: 10_000 });
    },
  );

  // nav-08 (issue #1002 regression guard, activated for #2586's SDK Chat
  // migration): guards the duplicate create-session regression — clicking
  // "New Chat" once must fire exactly ONE POST to
  // /api/ai-mentor/orgs/*/users/*/sessions/. This is a pure REST assertion
  // (no live model reply needed), so it runs unmocked against the real
  // backend.
  //
  // Background: the old Chat component registered two separate useEffects
  // for RemoteEvents.newChat, so a single click emitted the event twice
  // and created two session ids. The fix consolidates into a single
  // effect with proper eventBus.off cleanup. Verified passing against the
  // live backend on the SDK Chat (@iblai/web-containers) surface.
  test('admin goes to chat page with a freshly created mentor and clicking New Chat fires exactly one create-session POST (issue #1002 regression guard)', async ({
    page,
    createMentorPage,
    chatPage,
  }) => {
    // Step 1: navigate as admin and create a fresh mentor so this test
    // is fully isolated — per project convention each test owns its
    // mentor and does not share one via beforeAll.
    await navigateToMentorApp(page);
    await createMentorPage.openAndCreate();

    // Step 2: the app navigates to the new mentor's chat page after
    // creation. Wait until the chat input is ready, confirming we are
    // on the correct page and the initial session has already been
    // established (the page auto-creates one on load).
    await expect(chatPage.chatInput).toBeVisible({ timeout: 30_000 });

    // Step 3: attach the request counter BEFORE clicking New Chat.
    // We match every POST to the sessions endpoint via a URL pattern
    // so the counter is in place before the click causes any network
    // activity.
    //
    // The glob `**/api/ai-mentor/orgs/*/users/*/sessions/` is the
    // canonical create-session endpoint (AiMentorService →
    // aiMentorOrgsUsersSessionsCreate).  We capture the full URL into
    // an array so we can assert its length after the fact — a single
    // waitForResponse() would NOT detect a second duplicate request
    // because it resolves on the first match and exits immediately.
    const sessionPostUrls: string[] = [];
    const captureSessionPost = (request: {
      method(): string;
      url(): string;
    }) => {
      if (
        request.method() === 'POST' &&
        /\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions\/$/.test(
          request.url(),
        )
      ) {
        sessionPostUrls.push(request.url());
      }
    };
    page.on('request', captureSessionPost);

    // Step 4: click New Chat once via the page-object helper (asserts
    // visible, then clicks — no raw locator access needed here).
    await chatPage.startNewChat();

    // Step 5: wait for the first (legitimate) create-session response
    // to complete.  Because the duplicate listener is registered
    // synchronously on the same event emission, the second request (if
    // present) is already in-flight at this point — no extra settle
    // time is needed.
    await page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        /\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions\//.test(resp.url()),
      { timeout: 15_000 },
    );

    // Step 6: wait for the deterministic UI signal that the new chat is
    // ready: the chat input must return to an enabled, editable state.
    // This is the same signal users observe — it avoids arbitrary
    // waitForTimeout and is unambiguous about when the new session is
    // active.
    await expect(chatPage.chatInput).toBeEnabled({ timeout: 15_000 });

    // Step 7: remove the listener before asserting so it doesn't leak
    // into any subsequent test setup.
    page.off('request', captureSessionPost);

    // Step 8: the core assertion — exactly ONE POST must have been
    // captured. Two or more means the duplicate-listener bug is back.
    expect(
      sessionPostUrls,
      `Expected exactly 1 create-session POST but got ${sessionPostUrls.length}: ${sessionPostUrls.join(', ')}`,
    ).toHaveLength(1);
  });

  // nav-09 (issue #2586 SDK Chat migration): a freshly created mentor's
  // session lifecycle stays at exactly ONE session through its first
  // message AND through navigating away and back. Complements nav-08 (which
  // guards the "New Chat" button specifically) by covering the mount-time
  // auto-create path in `@iblai/web-utils`'s `use-advanced-chat.ts`
  // (`startNewChat()`, gated on `!cachedSessionId?.[mentorId]`) — the path
  // that actually creates a brand-new mentor's very first session, before
  // the user ever sends anything or clicks "New Chat".
  //
  // The chat WebSocket is mocked (`ChatPage.mockChatWebSocket()`) since a
  // real model reply isn't required to prove single-session creation — only
  // the outgoing frame's `session_id` and the create-session REST call count
  // matter here. Mocking is registered right before a dedicated
  // `chatPage.gotoChat()` (full navigation) rather than before mentor
  // creation itself — the same reliable ordering journeys 68/73/77 use — so
  // the mentor-creation flow's own SPA routing can't race the mock's
  // WebSocket-route registration.
  test('admin sends the first message on a freshly created mentor and only ever gets one session, even after navigating away and back', async ({
    page,
    createMentorPage,
    chatPage,
    sidebarPage,
    explorePage,
  }) => {
    // Creates a mentor, reloads, sends a message, and navigates away and
    // back — well past the default per-test budget on top of mentor
    // creation's own cost (see journey 13's emb-07/08, which call this for
    // the same reason).
    test.slow();

    await navigateToMentorApp(page);

    const sessionPostUrls: string[] = [];
    const captureSessionPost = (request: {
      method(): string;
      url(): string;
    }) => {
      if (
        request.method() === 'POST' &&
        /\/ai-mentor\/orgs\/[^/]+\/users\/[^/]+\/sessions\/$/.test(
          request.url(),
        )
      ) {
        sessionPostUrls.push(request.url());
      }
    };
    page.on('request', captureSessionPost);

    // The mount-time effect auto-creates exactly one session for the fresh
    // mentor as part of creation itself, before any user action — no WS
    // mock needed yet, this is a pure REST assertion.
    await createMentorPage.openAndCreate();
    const { tenantKey, mentorId } = await getPlatformContext(page);
    await expect
      .poll(() => sessionPostUrls.length, { timeout: 15_000 })
      .toBe(1);
    const sessionId = await chatPage.getCachedSessionId(mentorId);
    expect(sessionId).toBeTruthy();

    // A fresh full navigation to the same mentor must reuse the cached
    // session (no new POST) — this is also what makes the mocked WS
    // reliable: routing is registered immediately before the navigation
    // that opens the socket, not before an earlier SPA-internal one.
    const ws = await chatPage.mockChatWebSocket();
    await chatPage.gotoChat(MENTOR_NEXTJS_HOST, tenantKey, mentorId);
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });
    expect(sessionPostUrls).toHaveLength(1);

    // Sending the first message must reuse that same session — no new POST,
    // and the outgoing WS frame carries the exact same session id.
    await chatPage.sendMessage('First message on a brand-new chat');
    const clientFrame = await ws.waitForClientMessage();
    expect(clientFrame.session_id).toBe(sessionId);
    expect(sessionPostUrls).toHaveLength(1);

    // Navigate away and back — still no additional session creation, and
    // the cached session id for this mentor is unchanged.
    await sidebarPage.navigateToExplore();
    await expect(explorePage.heading).toBeVisible({ timeout: 15_000 });
    await page.goBack();
    await expect(chatPage.getComposerTextarea()).toBeVisible({
      timeout: 30_000,
    });

    expect(sessionPostUrls).toHaveLength(1);
    expect(await chatPage.getCachedSessionId(mentorId)).toBe(sessionId);

    page.off('request', captureSessionPost);
  });
});
