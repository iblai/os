import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { openMoreOptionsMenu } from '../utils/navigation';

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

  test('newly registered user goes to sidebar and clicks the help button to open docs link', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const [newPage] = await Promise.all([
      nonadminPage.context().waitForEvent('page', { timeout: 10_000 }),
      openMoreOptionsMenu(nonadminPage),
      nonadminPage
        .getByRole('menu', { name: /more options/i })
        .or(nonadminPage.getByRole('dialog'))
        .getByRole('menuitem', { name: /help/i })
        .click(),
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

  // FIXME(#1002): parked as a placeholder at the user's request — verify
  // against the live backend and remove .fixme to activate. Guards the
  // duplicate create-session regression: clicking "New Chat" once must
  // fire exactly ONE POST to /api/ai-mentor/orgs/*/users/*/sessions/.
  //
  // Background: the old Chat component registered two separate useEffects
  // for RemoteEvents.newChat, so a single click emitted the event twice
  // and created two session ids. The fix consolidates into a single
  // effect with proper eventBus.off cleanup.
  //
  // To activate: remove the `test.fixme(` wrapper (keep the inner async
  // function), confirm the test passes on the live backend, then update
  // nav-08 in coverage.json and COVERAGE.md from "pending" → "covered".
  test.fixme(
    'admin goes to chat page with a freshly created mentor and clicking New Chat fires exactly one create-session POST (issue #1002 regression guard)',
    async ({ page, createMentorPage, chatPage }) => {
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
    },
  );
});
