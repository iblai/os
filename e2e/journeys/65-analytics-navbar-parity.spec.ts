import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { ChatPrivacyPage } from '../page-objects/chat-privacy.page';

/**
 * Journey 65: Analytics Navbar Parity (issue #2248)
 *
 * There is only ONE navbar component — `app/platform/_components/app-layout.tsx`
 * renders `<NavBar />` for every `/platform/<tenant>/<mentor>/**` route,
 * including `/analytics`. Before the fix, two path predicates inside
 * `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`
 * special-cased `/analytics` the same way as `/prompt-gallery`, which made
 * the analytics route:
 *   - show the mentor name as static text instead of the "Selected agent"
 *     dropdown trigger,
 *   - hide the admin-only LLM Model Selector,
 *   - hide the Private Mode chip,
 *   - silently no-op the dropdown's "New Chat" action (the `newChat` event
 *     bus emit has no listener off the chat route).
 *
 * The fix renames `isPromptGalleryOrAnalytics` to `isPromptGalleryPage`
 * (dropping `/analytics`) and stops `isOnChatPage` from excluding
 * `/analytics`, so analytics now gets full navbar parity with the regular
 * chat page.
 *
 * `/prompt-gallery` has NO regression-guard checkpoint here, deliberately.
 * It is not a reachable route in this codebase: there is no `page.tsx`
 * anywhere under `app/platform/[tenantKey]/[mentorId]/` for it, and no
 * `router.push`/`Link` in the app ever targets it — the prompt gallery is a
 * client-state modal (`components/modals/prompt-gallery-modal.tsx`) that
 * never touches the URL. The only three references to `/prompt-gallery` in
 * the whole codebase are the defensive `pathname.includes('/prompt-gallery')`
 * checks in `nav-bar/index.tsx`, `embed-nav-bar.tsx`, and `components/
 * header.tsx`. Verified live: navigating the browser directly to
 * `/platform/<tenant>/<mentor>/prompt-gallery` renders the app's genuine
 * root `not-found.tsx` (only `app/not-found.tsx` exists — there is no
 * nested boundary for the `[mentorId]` segment), and the `<nav>` element
 * does not render at all (`isPromptGalleryPage` never even gets a chance to
 * run against real DOM). A test that "navigates" there would only be
 * exercising Next.js's generic 404 page, not the guard it's meant to prove,
 * so no checkpoint was added for it — see `nav-bar/__tests__/index.test.tsx`
 * for the (already-passing) unit-level coverage of that predicate instead.
 *
 * Chosen home: a new journey rather than reviving Journey 18
 * (`18-analytics-dashboard.spec.ts`) or extending Journey 56
 * (`56-navbar-user-mode-dropdown-visibility.spec.ts`). Journey 18's four
 * tests are pre-existing `// fixme` breakage (analytics tab navigation
 * timing out) unrelated to this fix — out of scope to repair here. Journey
 * 56 is scoped tightly to the User/Admin dropdown-visibility regression
 * (issue #2048); bolting on LLM-selector/privacy-chip/New-Chat-routing
 * checkpoints would blur that journey's focus. A dedicated journey keeps
 * the #2248 checkpoints legible as their own unit, matching the pattern of
 * Journey 64 (issue #2155) and Journey 61 (LaTeX rendering).
 */
test.describe('Journey 65: Analytics Navbar Parity', () => {
  // This worktree's e2e/.env.local pins TEST_TIMEOUT=60000 (vs the repo
  // default of 120000). Several checkpoints here open the categorized
  // dropdown, click through New Chat, and wait for a fresh chat session to
  // hydrate — under parallel-worker contention that chain can run past 60s
  // even though nothing is actually stuck (confirmed via --retries=0: every
  // failure was a plain timeout, never a stale/incorrect assertion). Give
  // the whole journey more headroom rather than let real, working
  // assertions race a too-tight budget.
  test.setTimeout(120_000);

  // Only logs in and lands on the regular chat page. Individual tests
  // navigate to `/analytics` themselves (via `analyticsPage.goto()`) so the
  // "full navbar parity" test can assert the chat-page baseline first
  // without a second `navigateToMentorApp` round-trip (that redundant
  // re-auth was the root cause of its flakiness — see below).
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
    await waitForPageReady(page);
  });

  test('admin goes to the analytics page and sees the mentor dropdown trigger, which opens the categorized menu', async ({
    page,
    navbarPage,
    analyticsPage,
  }) => {
    await analyticsPage.goto();

    // Regression guard: before the fix this branch rendered a static
    // Avatar + name `<div>` instead of the dropdown trigger button.
    await expect(navbarPage.mentorDropdown).toBeVisible({ timeout: 15_000 });

    await navbarPage.openMentorDropdown();

    const settingsItem = page.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });
    await expect(navbarPage.mentorDropdownNewChatItem).toBeVisible({
      timeout: 10_000,
    });
    await expect(settingsItem).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('admin goes to the analytics page and sees full navbar parity: LLM Model Selector and Private Mode chip both appear', async ({
    page,
    navbarPage,
    analyticsPage,
  }) => {
    // Baseline on the regular chat page first (already here — `beforeEach`
    // only calls `navigateToMentorApp` once, no extra auth round-trip).
    // This is what "parity" is measured against, and it also guards
    // against a vacuous pass if the tenant's chat-privacy gate were ever
    // turned off (Journey 50 owns that tenant-level toggle; reading the
    // SAME state twice, back to back, in one test keeps the comparison
    // meaningful without this journey mutating any shared config itself).
    const chatPrivacy = new ChatPrivacyPage(page);

    await expect(navbarPage.llmModelSelectorButton).toBeVisible({
      timeout: 15_000,
    });
    await chatPrivacy.assertHeaderToggleVisible(true);

    // Now the analytics route — before the fix, both were hidden here
    // because `isOnChatPage` excluded `/analytics`. This is a client-side
    // SPA navigation (no re-auth), so it doesn't reintroduce the timeout.
    await analyticsPage.goto();
    await expect(page).toHaveURL(/\/analytics$/, { timeout: 15_000 });

    await expect(navbarPage.llmModelSelectorButton).toBeVisible({
      timeout: 15_000,
    });
    await chatPrivacy.assertHeaderToggleVisible(true);
  });

  test('admin clicks New Chat from the analytics navbar dropdown and lands on a fresh, empty chat session', async ({
    page,
    navbarPage,
    chatPage,
    analyticsPage,
  }) => {
    // Before the fix, `handleSegmentClick` unconditionally emitted
    // `RemoteEvents.newChat` — a silent no-op off the chat route, since the
    // only listener is the chat component itself, which isn't mounted on
    // `/analytics`. The fix routes home first via `navigateToHome()` and
    // dispatches `chatActions.setShouldStartNewChat(true)` when not on a
    // chat route.
    await analyticsPage.goto();
    await expect(page).toHaveURL(/\/analytics$/, { timeout: 15_000 });

    await navbarPage.openMentorDropdown();
    await expect(navbarPage.mentorDropdownNewChatItem).toBeVisible({
      timeout: 10_000,
    });
    await navbarPage.mentorDropdownNewChatItem.click();

    // Lands back on the bare chat route — no `/analytics` suffix.
    await expect(page).toHaveURL(/\/platform\/[^/]+\/[^/]+\/?$/, {
      timeout: 20_000,
    });
    await waitForPageReady(page);

    // A fresh session has no prior messages.
    await expect(chatPage.userMessages).toHaveCount(0, { timeout: 10_000 });
    await expect(chatPage.aiMessages).toHaveCount(0, { timeout: 10_000 });
  });

  test('admin goes to the analytics Users sub-tab and still sees the dropdown and LLM Model Selector', async ({
    page,
    navbarPage,
    analyticsPage,
  }) => {
    // Proves the fix holds for nested analytics routes, not just the
    // `/analytics` index — `isPromptGalleryPage`/`isOnChatPage` use
    // `pathname.includes(...)`, so this also guards against a narrower
    // exact-match regression being introduced later.
    await analyticsPage.goto();
    await analyticsPage.navigateToTab('users');
    await expect(page).toHaveURL(/\/analytics\/users$/, { timeout: 15_000 });

    await expect(navbarPage.mentorDropdown).toBeVisible({ timeout: 15_000 });
    await expect(navbarPage.llmModelSelectorButton).toBeVisible({
      timeout: 15_000,
    });
  });

  test('admin flipped to User mode does not see the LLM Model Selector on the analytics page', async ({
    page,
    navbarPage,
    analyticsPage,
  }) => {
    // The selector is gated on `isOnChatPage && isAdmin && !userIsStudent`.
    // Flipping the navbar User/Admin switch to User (student) mode must
    // hide it on analytics exactly as it does on the regular chat page —
    // this is a client-local Redux toggle (`state.user.isInstructorMode`),
    // not a backend mutation, so no cleanup is needed.
    await analyticsPage.goto();
    await navbarPage.switchToUserMode();

    await expect(navbarPage.llmModelSelectorButton).toBeHidden({
      timeout: 10_000,
    });
  });
});
