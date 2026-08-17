import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import {
  SPEND_LIMITS_LABELS,
  spendLimitsTabBody,
  isSpendLimitsTabVisible,
  setAgentSpendLimit,
  addUserSpendLimit,
  editUserSpendLimit,
  setUserSpendLimitEnabled,
  deleteUserSpendLimit,
  userSpendLimitRow,
  switchToWorkspaceSpendLimits,
  switchToPlanAndCredits,
  switchToAgentLimits,
  workspaceSpendLimitSection,
  setWorkspaceSpendLimit,
  deleteWorkspaceSpendLimit,
  expectWorkspaceSpendStats,
  agentLimitsSection,
  agentLimitsRow,
  clearAgentLimitsFilter,
  clickSetSpendLimitForFilteredAgent,
  setAgentLimitsRowEnabled,
  expectAgentLimitsRowContent,
  setAgentSpendLimitFromTenantBilling,
  addUserSpendLimitFromTenantBilling,
  openAgentLimitsManage,
  switchToSpendLimitsSubTab,
  closeAgentLimitsPopup,
} from '@iblai/iblai-js/playwright';

/**
 * Journey 69 — LLM Spend Limits ("Billing").
 *
 * Covers BOTH surfaces the SDK's spend-limits UI touches, as two
 * clearly-separated `test.describe` blocks in this one file:
 *
 *   A. **Agent settings (Billing tab)** — the "Billing" top-level tab in the
 *      Edit Mentor (Agent) modal, rendered by the SDK's `AgentSpendCapsTab`
 *      (`components/modals/edit-mentor-modal/tabs/spend-caps-tab.tsx`,
 *      admin-only — `userTypes: [UserType.ADMIN]` in
 *      `hooks/use-mentor-segments.ts`, always mounted, no `CapabilityGate`
 *      master toggle). Lives in the **Configurations** sidebar category,
 *      immediately after **LLM**. Exactly two sub-tabs — "This Agent" and
 *      "Per User" — the per-user flow is an "Add User Limit" MODAL with an
 *      email-based user picker.
 *
 *   B. **Tenant settings (Spend Limits + Agent Limits)** — two tabs on the
 *      tenant settings "Billing" surface (the SAME `BillingTab` component
 *      journey 21-B already exercises for Plan & Credits —
 *      `billingPage.openBillingTab()` / `?profileTab=billing` — now with an
 *      internal "Billing sections" tablist: "Plan & Credits" (default,
 *      journey 21's coverage) / "Spend Limits" / "Agent Limits"):
 *        - **Spend Limits** — the tenant-wide (workspace) LLM spend limit,
 *          `SpendLimitsSection` inside `BillingTab`. ONE cap for the whole
 *          tenant; mutating it affects every mentor and every user.
 *        - **Agent Limits** — every agent spend cap configured tenant-wide,
 *          `AgentLimitsSection` inside `BillingTab`: an autocomplete filter,
 *          a direct Status toggle per row, and a "manage" action that opens
 *          the SAME agent-scoped Billing editor block A covers
 *          (`AgentSpendCapsTab`) in a POPUP stacked on top of the tenant
 *          settings dialog.
 *
 * REWRITE NOTE (feat/2286): the prior version of block A tested a
 * three-sub-tab UI (This agent / Per user / Workspace) with hand-rolled
 * locators (`e2e/page-objects/edit-mentor/spend-caps.tab.ts`, now deleted).
 * The current SDK UI drops the "Workspace" sub-tab entirely — the
 * tenant-wide limit moved to block B. Every interaction below goes through
 * the dedicated helpers in `@iblai/iblai-js/playwright` (see that package's
 * "Spend limits (Billing) helpers" doc block): they gate tab/sub-tab
 * switching on DOM rendering and every save/delete/toggle on the mutated
 * data re-rendering (an in-place RTK Query cache refresh that a prior SDK
 * build lacked — since fixed upstream, confirmed live against
 * `localhost:3000`).
 *
 * BLOCK B RESTRUCTURE: `AgentLimitsSection`'s table reads
 * `useListAgentSpendCapsQuery({ org, ...(filter ? { mentor: filter } : {}) })`
 * — the DB-backed caps list, which (verified in the SDK source) lists EVERY
 * configured cap tenant-wide the instant no filter is applied. The
 * autocomplete FILTER, by contrast, is backed by a search index that lags
 * mentor creation by DAYS on this backend (see the "search index" comment
 * below). So only ONE checkpoint (`tal-01`) actually needs the filter —
 * every other `tal-*` test creates its cap through the Edit Agent dialog
 * (`createAgentCapViaEditDialog`, Block A's proven `setAgentSpendLimit`
 * flow) and then drives the tenant Agent Limits table directly via
 * `agentLimitsRow(mentorUniqueId)` and the `*FromTenantBilling` composites
 * (`setAgentSpendLimitFromTenantBilling`, `addUserSpendLimitFromTenantBilling`
 * — neither touches the filter internally; deletes go through the local
 * `deleteAgentCapAndAwaitResponse` instead of the SDK's own delete helpers —
 * see its comment below). Those composites and `openAgentLimitsManage`
 * internally open/close the manage popup and resolve every nested query
 * FROM it — the nested-dialog stacking (tenant settings dialog → manage
 * popup → user-cap
 * modal → delete confirm) is handled entirely inside the SDK, never via a
 * bare page-wide query.
 *
 * ── RBAC guard ────────────────────────────────────────────────────────────
 *
 * RBAC is enforced at TAB level by the host: an admin without the
 * spend-caps grant never sees the Billing tab at all (the segment is
 * `userTypes: [ADMIN]` in use-mentor-segments.ts and the tenant Billing tab
 * is likewise admin-gated), so there is no in-scope denied-panel probing in
 * this file. Once a tab/section is reachable its content must load — a
 * backend 403 (or a 404 from an undeployed endpoint) fails the SDK helpers'
 * own waits loudly: this repo prefers red-until-fixed live gates over
 * silent skips for app/backend-level blockers. The only skips left are
 * genuine environment gates (non-admin session, `show_paywall=false`).
 *
 * ── Isolation ────────────────────────────────────────────────────────────
 *
 * The whole FILE runs in `default` mode: tests execute in declaration
 * order, in the same worker, but — unlike `serial` — a failure in one test
 * does NOT skip the rest of the file. Every test is SELF-CONTAINED (creates
 * whatever state it needs itself rather than relying on a prior test's
 * mutation) and closes the Edit Mentor dialog as its LAST action (house
 * pattern — see journeys 44/47/66/67's beforeEach/test bodies): the next
 * test's `createMentorPage.openAndCreate()` drives the sidebar "New Agent"
 * flow, which needs the page chrome unobstructed — a dialog left open from
 * a prior test blocks it (its Radix overlay intercepts the sidebar/dropdown
 * click).
 *
 *   - Block A: every test gets its own freshly-created mentor
 *     (`MentorTracker`, deleted in `afterAll`). No test in block A touches
 *     tenant-wide state, and no test depends on another block-A test's
 *     mutation — per-user checkpoints (sc-06/07/08) each call
 *     `addUserSpendLimit` themselves before mutating further.
 *   - Block B: the workspace Spend Limits cap is TENANT-WIDE (not
 *     mentor-scoped) — the one checkpoint that touches it (`twl-02`) ALWAYS
 *     saves with `enforcement: 'alert_only'` (never `'block'`) and removes
 *     it in a `finally` block unconditionally, so a leftover cap can only
 *     ever surface a near-limit notification — never block a chat request
 *     for another journey sharing this tenant — and the tenant is left
 *     capless regardless of which assertion (if any) failed first. The
 *     Agent Limits checkpoints (`tal-*`) each get their OWN freshly-created,
 *     capless mentor (`MentorTracker`, deleted in `afterAll` — same pattern
 *     as block A, not journey 14's shared worker-scoped mentor this used to
 *     be). `tal-01` — the sole filter-dependent checkpoint — is declared
 *     LAST in the block so every other test's runtime gives the search
 *     index maximum time to catch up before it runs.
 */

test.describe.configure({ mode: 'default', timeout: 300_000 });

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** Reads the current admin's email + username from localStorage
 * (`userData.user_email` / `userData.user_nicename`) — a safe,
 * guaranteed-to-exist identity for the per-user cap checkpoints in both
 * blocks. The "Add User Limit" picker (agent AND tenant scope) is
 * EMAIL-based (no free-text usernames), while the backend still keys
 * caps/mutations by username. */
async function getCurrentAdminIdentity(
  page: Page,
): Promise<{ email: string; username: string }> {
  const identity = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('userData');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        email: parsed?.user_email ?? null,
        username: parsed?.user_nicename ?? null,
      };
    } catch {
      return null;
    }
  });
  if (!identity?.email || !identity?.username) {
    throw new Error(
      'getCurrentAdminIdentity: could not read userData.user_email / user_nicename from localStorage',
    );
  }
  return identity;
}

/** Text labels of the currently-visible segment tabs in the active category
 * (mirrors journey 44/67's `visibleSegmentTabLabels`). */
async function visibleSegmentTabLabels(dialog: Locator): Promise<string[]> {
  return dialog
    .locator('[role="tab"][aria-controls^="panel-"]:visible')
    .allTextContents();
}

/**
 * The tenant Agent Limits autocomplete filter (`agent-limits-filter-input`,
 * driven with raw locators in `tal-01` below rather than the SDK's
 * `filterAgentLimits` — that helper expects an EXACT match on one option
 * and this checkpoint samples several) is backed by a SEARCH INDEX
 * (`useGetMentorsQuery` → `SearchService.searchOrgsUsersMentorsRetrieve` →
 * `GET /api/search/orgs/{org}/users/{username}/mentors/`), not the DB
 * directly — confirmed in the SDK source. A mentor created moments earlier
 * in this same test's `beforeEach` is reliably NOT yet indexed: live
 * evidence shows the index still only contains mentors from DAYS earlier —
 * this backend indexes in a batch/cron job, not near-real-time, so NO
 * bounded retry can ever make a freshly-created mentor searchable. This is
 * a product-level limitation being reported upstream separately, not a test
 * bug. `tal-01` (the one checkpoint that must use this filter) works around
 * it by picking an ALREADY-INDEXED mentor from a past test run instead of
 * its own fresh one — see its own comment — while every other `tal-*`
 * checkpoint below avoids the index entirely (per-mentor spend limits are
 * created through the Edit Agent dialog instead — see
 * `createAgentCapViaEditDialog` — and then manipulated via
 * `agentLimitsRow(mentorUniqueId)` / the `*FromTenantBilling` composites,
 * all of which read `useListAgentSpendCapsQuery`, the DB-backed caps list
 * that lists every configured cap immediately with no filter applied). */
const AGENT_LIMITS_SEARCH_QUERY = 'E2E Mentor';

/**
 * Deletes an agent-cap (agent scope OR the same-shaped popup instance,
 * since both use the `agent-cap-*` testid prefix) via its confirm dialog,
 * gated on the DELETE network response — NOT the SDK's `deleteAgentSpendLimit`
 * / `deleteAgentSpendLimitFromTenantBilling`'s own internal wait for the
 * "no limit configured" hint to reappear. Live network evidence: the DELETE
 * itself succeeds (204) and the very next GET already reflects it (404,
 * ~300ms later) — the backend and the query layer are both fine — but the
 * SDK helpers' hardcoded 15s render wait intermittently times out under
 * this environment's current load before the component re-renders. Reported
 * upstream separately; this local helper is the reliable stand-in until
 * then. */
async function deleteAgentCapAndAwaitResponse(
  page: Page,
  scope: Locator,
): Promise<void> {
  const deleteButton = scope.getByTestId('agent-cap-delete-button');
  await expect(deleteButton).toBeEnabled({ timeout: 10_000 });
  await deleteButton.click();

  const modal = page.getByTestId('spend-cap-delete-modal');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  const confirmButton = modal.getByTestId('spend-cap-delete-confirm');
  await expect(confirmButton).toBeEnabled({ timeout: 10_000 });

  const responsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === 'DELETE' &&
      /\/spend-caps?\//.test(new URL(r.url()).pathname),
    { timeout: 20_000 },
  );
  await confirmButton.click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(
      `Agent spend limit delete failed: DELETE ${response.url()} → ${response.status()} ${response.statusText()}`,
    );
  }
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

/**
 * Creates the given agent-scoped spend limit through the Edit Agent
 * dialog's Billing tab (Block A's `setAgentSpendLimit` flow) instead of the
 * tenant Agent Limits filter+popup — sidesteps the search-index lag
 * entirely (see the "search index" comment above) since the Edit Agent
 * dialog addresses the mentor directly by id, never by a search query.
 * Leaves the dialog closed on return.
 */
async function createAgentCapViaEditDialog(
  page: Page,
  editMentorPage: EditMentorPage,
  values: Parameters<typeof setAgentSpendLimit>[1],
): Promise<void> {
  await editMentorPage.open('Billing');
  await waitForPageReady(page);
  await setAgentSpendLimit(page, values);
  await editMentorPage.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// Block A: Agent settings (Billing tab)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Journey 69: Spend Limits — Agent settings (Billing tab)', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Billing tab requires admin access');
      return;
    }

    // Dedicated mentor per test — every checkpoint below mutates
    // agent-scoped state, so a fresh, capless mentor per test keeps the
    // "empty" starting state honest and tests independent of run order.
    // `open()` self-detects the Edit Agent dialog the create flow
    // auto-opens (?modal=...edit_mentor...) and navigates straight to the
    // requested tab without touching the agent dropdown (see journeys
    // 44/47/66's identical beforeEach).
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    await editMentorPage.open('Billing');
    await waitForPageReady(page);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // ── sc-01: tab position + default sub-tab ─────────────────────────────────

  test('admin sees the Billing tab in the Configurations category immediately after LLM, and it opens on "This Agent" with "Per User" also available', async ({
    page,
    editMentorPage,
  }) => {
    const labels = (await visibleSegmentTabLabels(editMentorPage.dialog)).map(
      (l) => l.trim(),
    );
    const llmIndex = labels.indexOf('LLM');
    const billingIndex = labels.indexOf('Billing');
    expect(llmIndex).toBeGreaterThanOrEqual(0);
    expect(billingIndex).toBe(llmIndex + 1);

    expect(await isSpendLimitsTabVisible(page)).toBe(true);

    const body = spendLimitsTabBody(page);
    const agentSubTab = body.getByRole('tab', {
      name: SPEND_LIMITS_LABELS.subTabs.agent,
      exact: true,
    });
    const usersSubTab = body.getByRole('tab', {
      name: SPEND_LIMITS_LABELS.subTabs.users,
      exact: true,
    });
    await expect(agentSubTab).toHaveAttribute('data-state', 'active', {
      timeout: 15_000,
    });
    await expect(usersSubTab).toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // ── sc-02: create + persist an agent spend limit ──────────────────────────

  test('admin creates an agent spend limit and the values persist after closing and reopening the Billing tab', async ({
    page,
    editMentorPage,
  }) => {
    const body = spendLimitsTabBody(page);
    // Freshly created mentor — no agent limit exists yet.
    await expect(body.getByTestId('agent-cap-no-cap-hint')).toBeVisible({
      timeout: 10_000,
    });

    await setAgentSpendLimit(page, {
      limitUsd: '42.50',
      interval: 'week',
      enforcement: 'alert_only',
      alertThresholds: '50, 90',
      enabled: true,
    });

    // Round-trip verification: close the modal, reopen, and re-read the
    // SERVER copy rather than trusting in-memory form state.
    await editMentorPage.close();
    await editMentorPage.open('Billing');
    await waitForPageReady(page);

    const reopened = spendLimitsTabBody(page);
    // The form rehydrates the limit as `String(Number(cap.max_cost_usd))` —
    // "42.50" round-trips through the backend and back as "42.5".
    await expect(reopened.getByTestId('agent-cap-limit-input')).toHaveValue(
      '42.5',
      { timeout: 15_000 },
    );
    await expect(
      reopened.getByTestId('agent-cap-interval-select'),
    ).toContainText(SPEND_LIMITS_LABELS.intervalOptions.week);
    await expect(
      reopened.getByTestId('agent-cap-enforcement-select'),
    ).toContainText(SPEND_LIMITS_LABELS.enforcementOptions.alert_only);
    await expect(
      reopened.getByTestId('agent-cap-thresholds-input'),
    ).toHaveValue('50, 90');
    await expect(
      reopened.getByTestId('agent-cap-enabled-switch'),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(reopened.getByTestId('agent-cap-usage')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      reopened.getByTestId('agent-cap-alert-only-badge'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(reopened.getByTestId('agent-cap-spent')).toContainText(
      '$0.00',
    );

    await editMentorPage.close();
  });

  // ── sc-03: validation ──────────────────────────────────────────────────────

  test('an invalid spend limit shows the validation error and disables Save', async ({
    page,
    editMentorPage,
  }) => {
    const body = spendLimitsTabBody(page);
    await body.getByTestId('agent-cap-limit-input').fill('0');
    await expect(body.getByTestId('agent-cap-limit-error')).toBeVisible({
      timeout: 5_000,
    });
    await expect(body.getByTestId('agent-cap-limit-error')).toHaveText(
      'Enter an amount greater than 0',
    );
    await expect(body.getByTestId('agent-cap-save-button')).toBeDisabled({
      timeout: 5_000,
    });

    // Nothing was saved — no data cleanup needed, but the dialog itself
    // still needs closing (house pattern — see the isolation note above).
    await editMentorPage.close();
  });

  // ── sc-04: remove an agent spend limit ─────────────────────────────────────

  test('admin removes the agent spend limit via the confirm dialog and the "no limit" hint reappears', async ({
    page,
    editMentorPage,
  }) => {
    await setAgentSpendLimit(page, {
      limitUsd: '15',
      interval: 'month',
      enforcement: 'alert_only',
      enabled: true,
    });

    const body = spendLimitsTabBody(page);
    await expect(body.getByTestId('agent-cap-delete-button')).toBeVisible({
      timeout: 10_000,
    });

    // Local network-gated delete instead of the SDK's `deleteAgentSpendLimit`
    // — see `deleteAgentCapAndAwaitResponse`'s comment above.
    await deleteAgentCapAndAwaitResponse(page, body);

    await expect(body.getByTestId('agent-cap-no-cap-hint')).toBeVisible({
      timeout: 15_000,
    });

    await editMentorPage.close();
  });

  // ── sc-05: add a per-user spend limit via the email picker ────────────────

  test('admin adds a per-user spend limit through the email picker and sees it listed', async ({
    page,
    editMentorPage,
  }) => {
    const { email, username } = await getCurrentAdminIdentity(page);

    // `addUserSpendLimit` switches to the "Per User" sub-tab itself before
    // touching anything in it — no separate readiness wait needed.
    await addUserSpendLimit(page, {
      email,
      username,
      limitUsd: '10',
      interval: 'month',
      enforcement: 'alert_only',
      alertThresholds: '80, 95',
      enabled: true,
    });

    await expect(userSpendLimitRow(page, username)).toContainText('$10.00');

    await editMentorPage.close();
  });

  // ── sc-06: edit an existing per-user spend limit ───────────────────────────

  test("admin edits an existing per-user spend limit via the row's three-dots menu", async ({
    page,
    editMentorPage,
  }) => {
    const { email, username } = await getCurrentAdminIdentity(page);

    await addUserSpendLimit(page, {
      email,
      username,
      limitUsd: '10',
      interval: 'month',
      enforcement: 'alert_only',
      enabled: true,
    });
    await expect(userSpendLimitRow(page, username)).toContainText('$10.00');

    await editUserSpendLimit(page, username, {
      limitUsd: '25',
      interval: 'week',
      enforcement: 'block',
    });

    await expect(userSpendLimitRow(page, username)).toContainText('$25.00');

    await editMentorPage.close();
  });

  // ── sc-07: per-user Status toggle saves immediately ────────────────────────

  test("admin flips a per-user spend limit's Status toggle off and back on", async ({
    page,
    editMentorPage,
  }) => {
    const { email, username } = await getCurrentAdminIdentity(page);

    await addUserSpendLimit(page, {
      email,
      username,
      limitUsd: '10',
      interval: 'month',
      enforcement: 'alert_only',
      enabled: true,
    });

    const row = userSpendLimitRow(page, username);
    await expect(row.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 10_000 },
    );

    await setUserSpendLimitEnabled(page, username, false);
    await expect(row.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'false',
      { timeout: 10_000 },
    );

    await setUserSpendLimitEnabled(page, username, true);
    await expect(row.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 10_000 },
    );

    await editMentorPage.close();
  });

  // ── sc-08: delete a per-user spend limit ───────────────────────────────────

  test('admin deletes a per-user spend limit via the row menu and the row disappears', async ({
    page,
    editMentorPage,
  }) => {
    const { email, username } = await getCurrentAdminIdentity(page);

    await addUserSpendLimit(page, {
      email,
      username,
      limitUsd: '10',
      interval: 'month',
      enforcement: 'alert_only',
      enabled: true,
    });
    await expect(userSpendLimitRow(page, username)).toBeVisible({
      timeout: 15_000,
    });

    await deleteUserSpendLimit(page, username);

    await expect(userSpendLimitRow(page, username)).toBeHidden({
      timeout: 15_000,
    });

    await editMentorPage.close();
  });

  // ── sc-09: non-admin visibility ────────────────────────────────────────────

  test('non-admin user does not see the Billing tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const modifyItem = nonadminPage
      .getByRole('menuitem', { name: /modify/i })
      .or(nonadminPage.getByRole('menuitem', { name: /settings/i }).first());

    let menuItemVisible = false;
    try {
      await modifyItem.waitFor({ state: 'visible', timeout: 3_000 });
      menuItemVisible = true;
    } catch {
      menuItemVisible = false;
    }

    if (!menuItemVisible) {
      // Non-admin cannot open the edit dialog at all — Billing is
      // definitively not visible. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) the non-admin can open the dialog, assert the
    // Billing tab trigger is absent from the Configurations category.
    await modifyItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });
    await nonadminEditMentorPage.waitForHydrated();
    await expect(
      nonadminEditMentorPage.dialog
        .getByRole('tab', { name: 'Billing', exact: true })
        .and(
          nonadminEditMentorPage.dialog.locator(
            '[aria-controls^="panel-"]:visible',
          ),
        ),
    ).toHaveCount(0, { timeout: 10_000 });
    await nonadminEditMentorPage.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Block B: Tenant settings (Spend Limits + Agent Limits)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Journey 69: Spend Limits — Tenant settings (Spend Limits + Agent Limits)', () => {
  // Dedicated, freshly-created, capless mentor PER TEST — every Agent Limits
  // checkpoint below (except `tal-01`, which deliberately borrows an
  // ALREADY-INDEXED mentor from a past run instead — see its own comment)
  // is self-contained: a test that needs an existing cap creates it itself
  // via `createAgentCapViaEditDialog` rather than relying on a previous
  // test's mutation.
  let dedicatedMentorId = '';
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Tenant Billing spend limits require admin access');
      return;
    }

    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    dedicatedMentorId = mentorId;
    tracker.add(mentorId);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // ── twl-01: tab structure + Plan & Credits round-trip ─────────────────────

  test('the tenant Billing tab exposes a "Billing sections" tablist with Plan & Credits, Spend Limits, and Agent Limits', async ({
    page,
    billingPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }
    await billingPage.openBillingTab();

    const tablist = page.getByRole('tablist', {
      name: SPEND_LIMITS_LABELS.tenantTablistAria,
    });
    await expect(tablist).toBeVisible({ timeout: 10_000 });
    await expect(
      tablist.getByRole('tab', {
        name: SPEND_LIMITS_LABELS.tenantTabs.planAndCredits,
        exact: true,
      }),
    ).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
    await expect(billingPage.billingPlanSection).toBeVisible({
      timeout: 10_000,
    });

    await switchToWorkspaceSpendLimits(page);
    await expect(workspaceSpendLimitSection(page)).toBeVisible({
      timeout: 15_000,
    });

    await switchToAgentLimits(page);
    await expect(agentLimitsSection(page)).toBeVisible({ timeout: 15_000 });

    await switchToPlanAndCredits(page);
    await expect(billingPage.billingPlanSection).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── twl-02: workspace-wide Spend Limits lifecycle (alert-only!) ───────────

  test('admin configures the workspace-wide spend limit with alert-only enforcement, the usage stats render and persist, and the limit is removed afterward', async ({
    page,
    billingPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }
    await billingPage.openBillingTab();
    await switchToWorkspaceSpendLimits(page);

    try {
      // ALWAYS alert-only — see the isolation note at the top of this file:
      // a leftover cap must never be able to BLOCK chat requests for another
      // journey sharing this tenant.
      await setWorkspaceSpendLimit(page, {
        limitUsd: '1000',
        interval: 'month',
        enforcement: 'alert_only',
        alertThresholds: '80, 95',
        enabled: true,
      });

      // Presence-level only — never assert exact dollar figures (live,
      // shared-tenant spend changes across the whole test run).
      await expectWorkspaceSpendStats(page);

      // Round-trip: reopen the Billing tab and re-read the SERVER copy.
      await billingPage.openBillingTab();
      await switchToWorkspaceSpendLimits(page);

      const section = workspaceSpendLimitSection(page);
      await expect(section.getByTestId('tenant-cap-limit-input')).toHaveValue(
        '1000',
        { timeout: 15_000 },
      );
      await expect(
        section.getByTestId('tenant-cap-enforcement-select'),
      ).toContainText(SPEND_LIMITS_LABELS.enforcementOptions.alert_only);
      await expect(
        section.getByTestId('tenant-cap-alert-only-badge'),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      // Always attempt to remove the workspace cap — best-effort, so a
      // failed cleanup never masks (or is masked by) the assertions above.
      await switchToWorkspaceSpendLimits(page).catch(() => {});
      const section = workspaceSpendLimitSection(page);
      let hasCap = false;
      try {
        await section
          .getByTestId('tenant-cap-delete-button')
          .waitFor({ state: 'visible', timeout: 10_000 });
        hasCap = true;
      } catch {
        hasCap = false;
      }
      if (hasCap) {
        await deleteWorkspaceSpendLimit(page).catch(() => {});
      }
    }
  });

  // ── tal-02: edit via the manage popup (nested-dialog stacking) ────────────
  //
  // No filter anywhere in this test — see the "BLOCK B RESTRUCTURE" comment
  // at the top of this file. The cap is created through the Edit Agent
  // dialog (index-free); `setAgentSpendLimitFromTenantBilling` opens the
  // manage popup off `agentLimitsRow`, which reads the DB-backed,
  // unfiltered caps list.

  test('admin edits the agent spend limit through the Agent Limits manage popup stacked on the tenant settings dialog', async ({
    page,
    billingPage,
    editMentorPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }

    // Self-contained setup: create the cap this checkpoint then edits,
    // rather than depending on a previous test having created one.
    await createAgentCapViaEditDialog(page, editMentorPage, {
      limitUsd: '75',
      interval: 'month',
      enforcement: 'alert_only',
    });

    await billingPage.openBillingTab();
    await switchToAgentLimits(page);

    await setAgentSpendLimitFromTenantBilling(page, dedicatedMentorId, {
      limitUsd: '120',
      interval: 'week',
      enforcement: 'alert_only',
    });

    await expectAgentLimitsRowContent(page, dedicatedMentorId, {
      limit: '$120.00',
    });
  });

  // ── tal-03: Status toggle in the table row ────────────────────────────────

  test("admin flips the agent's Status toggle off and back on directly in the Agent Limits row", async ({
    page,
    billingPage,
    editMentorPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }

    // Self-contained setup: this checkpoint only tests the row's Status
    // toggle, so it needs a cap to exist first.
    await createAgentCapViaEditDialog(page, editMentorPage, {
      limitUsd: '75',
      interval: 'month',
      enforcement: 'alert_only',
    });

    await billingPage.openBillingTab();
    await switchToAgentLimits(page);

    const row = agentLimitsRow(page, dedicatedMentorId);
    await expect(row.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 10_000 },
    );

    await setAgentLimitsRowEnabled(page, dedicatedMentorId, false);
    await expect(row.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'false',
      { timeout: 10_000 },
    );

    await setAgentLimitsRowEnabled(page, dedicatedMentorId, true);
    await expect(row.getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 10_000 },
    );
  });

  // ── tal-04: per-user limit through the popup's nested modal ──────────────

  test('admin adds a per-user spend limit through the Agent Limits manage popup\'s nested "Per User" modal', async ({
    page,
    billingPage,
    editMentorPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }

    // Self-contained setup: the manage popup this checkpoint opens is only
    // reachable from an already-capped agent's row (a capless agent shows
    // the empty state's "Set Spend Limit" button instead), so create the
    // agent-scoped cap first.
    await createAgentCapViaEditDialog(page, editMentorPage, {
      limitUsd: '75',
      interval: 'month',
      enforcement: 'alert_only',
    });

    await billingPage.openBillingTab();
    await switchToAgentLimits(page);

    const { email, username } = await getCurrentAdminIdentity(page);

    await addUserSpendLimitFromTenantBilling(page, dedicatedMentorId, {
      email,
      username,
      limitUsd: '10',
      interval: 'month',
      enforcement: 'alert_only',
      enabled: true,
    });

    // The popup closed after the add — reopen it and re-read the SERVER
    // copy rather than trusting in-memory form state (round-trip, mirroring
    // block A's persistence checkpoints).
    const popup = await openAgentLimitsManage(page, dedicatedMentorId);
    await switchToSpendLimitsSubTab(page, 'users', popup);
    await expect(userSpendLimitRow(page, username, popup)).toContainText(
      '$10.00',
    );
    await closeAgentLimitsPopup(page);
  });

  // ── tal-05: delete via the manage popup ───────────────────────────────────

  test('admin deletes the agent spend limit through the manage popup and the row disappears', async ({
    page,
    billingPage,
    editMentorPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }

    // Self-contained setup: create the cap this checkpoint then deletes.
    await createAgentCapViaEditDialog(page, editMentorPage, {
      limitUsd: '75',
      interval: 'month',
      enforcement: 'alert_only',
    });

    await billingPage.openBillingTab();
    await switchToAgentLimits(page);

    // Local network-gated delete inside the manage popup instead of the
    // SDK's `deleteAgentSpendLimitFromTenantBilling` — see
    // `deleteAgentCapAndAwaitResponse`'s comment above.
    const popup = await openAgentLimitsManage(page, dedicatedMentorId);
    await deleteAgentCapAndAwaitResponse(page, spendLimitsTabBody(page, popup));
    await closeAgentLimitsPopup(page);

    // The tenant-wide (unfiltered) list only holds CONFIGURED caps — now
    // capless, the row is gone entirely.
    await expect(agentLimitsRow(page, dedicatedMentorId)).toBeHidden({
      timeout: 15_000,
    });
  });

  // ── tal-01: filter to an ALREADY-INDEXED mentor, create from empty-state ──
  //
  // Declared LAST — see the "BLOCK B RESTRUCTURE" comment at the top of this
  // file. This is the ONE checkpoint in this block that must exercise the
  // search-index-backed autocomplete filter (there is no DB-backed way to
  // reach the "capless agent" empty state / "Set Spend Limit" entry point).
  //
  // Live evidence ruled out retrying a FRESH mentor: the index only ever
  // returned mentors from DAYS earlier — this backend indexes in a
  // batch/cron job, not near-real-time, so no bounded poll could ever make
  // a mentor created seconds ago searchable. Instead, this test searches
  // broadly (`AGENT_LIMITS_SEARCH_QUERY = "E2E Mentor"`, this suite's own
  // `generateMentorName()` convention) and picks a mentor the index ALREADY
  // knows about — by construction, always old enough. It samples up to 5
  // returned candidates for the first CAPLESS one (empty state) to drive the
  // create flow; if every sampled candidate already has a cap, it falls back
  // to asserting the filter → row-visible path on the first candidate
  // instead (annotated via `test.info()`, never a failure — the filter
  // mechanism itself is still exercised end to end either way).
  //
  // The selected mentor belongs to the SHARED tenant (created by an
  // unrelated, earlier test run) — mutating it demands the same safety
  // contract as the workspace cap: alert-only enforcement and an
  // UNCONDITIONAL `finally` cleanup, so this test always leaves that
  // mentor exactly as it found it.

  test('admin filters Agent Limits to an already-indexed mentor, creates its spend limit from the empty-state popup (or verifies an existing one), and the row lists it', async ({
    page,
    billingPage,
  }) => {
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
      return;
    }
    await billingPage.openBillingTab();
    await switchToAgentLimits(page);

    const section = agentLimitsSection(page);
    const filterInput = section.getByTestId('agent-limits-filter-input');
    const results = section.getByTestId('agent-limits-filter-results');
    // Any row testid, without needing to know the mentor's unique_id up
    // front — safe because the filter scopes the table server-side
    // (`mentor: agentFilter.value`), so at most one row can ever match.
    const filteredRow = section.locator('[data-testid^="agent-limits-row-"]');
    const emptyState = section.getByTestId('agent-limits-set-limit-button');

    await expect(filterInput).toBeVisible({ timeout: 10_000 });
    await filterInput.fill(AGENT_LIMITS_SEARCH_QUERY);
    await expect(results.getByRole('button').first()).toBeVisible({
      timeout: 20_000,
    });
    const candidates = (await results.getByRole('button').allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);
    expect(
      candidates.length,
      `Agent Limits autocomplete returned no results for ` +
        `"${AGENT_LIMITS_SEARCH_QUERY}" — this suite's own past mentors ` +
        `should already be indexed by now; if the tenant is genuinely empty ` +
        `of them this checkpoint cannot run.`,
    ).toBeGreaterThan(0);

    let selectedName: string | null = null;
    let selectedIsCapless = false;
    for (const candidateName of candidates.slice(0, 5)) {
      await filterInput.fill(AGENT_LIMITS_SEARCH_QUERY);
      await expect(results.getByRole('button').first()).toBeVisible({
        timeout: 20_000,
      });
      await results
        .getByRole('button', { name: candidateName, exact: true })
        .click();
      await expect(
        section.getByTestId('agent-limits-filter-selected'),
      ).toContainText(candidateName, { timeout: 10_000 });
      await expect(emptyState.or(filteredRow).first()).toBeVisible({
        timeout: 15_000,
      });

      let hasCap = false;
      try {
        await filteredRow.waitFor({ state: 'visible', timeout: 1_000 });
        hasCap = true;
      } catch {
        hasCap = false;
      }

      selectedName = candidateName;
      if (!hasCap) {
        selectedIsCapless = true;
        break;
      }
      await clearAgentLimitsFilter(page);
    }

    if (!selectedName) {
      throw new Error(
        `Could not select any candidate from the ` +
          `"${AGENT_LIMITS_SEARCH_QUERY}" search results.`,
      );
    }

    if (!selectedIsCapless) {
      // Every sampled candidate already has a cap — the filter →
      // row-visible path is still genuinely covered; PASS on that instead
      // of failing. This branch makes no mutation, so no cleanup is needed.
      test.info().annotations.push({
        type: 'note',
        description:
          `All ${Math.min(candidates.length, 5)} sampled "${AGENT_LIMITS_SEARCH_QUERY}" ` +
          `candidates already had a spend limit configured; verified the ` +
          `filter → row-visible path on "${selectedName}" instead of the ` +
          `empty-state → create path.`,
      });
      await filterInput.fill(AGENT_LIMITS_SEARCH_QUERY);
      await expect(results.getByRole('button').first()).toBeVisible({
        timeout: 20_000,
      });
      await results
        .getByRole('button', { name: selectedName, exact: true })
        .click();
      await expect(filteredRow).toBeVisible({ timeout: 15_000 });
      await clearAgentLimitsFilter(page);
      return;
    }

    // Found a capless, already-indexed mentor — create its spend limit from
    // the empty-state popup and verify the row lists it.
    try {
      const popup = await clickSetSpendLimitForFilteredAgent(page);
      await setAgentSpendLimit(
        page,
        {
          limitUsd: '75',
          interval: 'month',
          // ALWAYS alert-only — this mentor is owned by another suite; a
          // leftover cap must never be able to BLOCK its chat requests (see
          // the isolation note at the top of this file).
          enforcement: 'alert_only',
          alertThresholds: '80, 95',
          enabled: true,
        },
        popup,
      );
      await closeAgentLimitsPopup(page);

      await expect(filteredRow).toBeVisible({ timeout: 15_000 });
      await expect(filteredRow).toContainText('$75.00');
    } finally {
      // Always attempt to remove the cap — best-effort, unconditional, so a
      // failed cleanup never masks (or is masked by) the assertions above,
      // and this borrowed mentor is left exactly as found regardless of
      // which assertion (if any) failed first.
      let hasRow = false;
      try {
        await filteredRow.waitFor({ state: 'visible', timeout: 10_000 });
        hasRow = true;
      } catch {
        hasRow = false;
      }
      if (hasRow) {
        const manageButton = filteredRow.locator(
          '[data-testid^="agent-limits-manage-"]',
        );
        await manageButton.click().catch(() => {});
        const popup = page.getByTestId('agent-limits-modal');
        const popupBody = spendLimitsTabBody(page, popup);
        let canDelete = false;
        try {
          await popupBody
            .getByTestId('agent-cap-delete-button')
            .waitFor({ state: 'visible', timeout: 10_000 });
          canDelete = true;
        } catch {
          canDelete = false;
        }
        if (canDelete) {
          await deleteAgentCapAndAwaitResponse(page, popupBody).catch(() => {});
        }
        await closeAgentLimitsPopup(page).catch(() => {});
      }
      await clearAgentLimitsFilter(page).catch(() => {});
    }
  });
});
