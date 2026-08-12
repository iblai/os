import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';

/**
 * Journey 68 — Mentor Billing (Spend Caps) Tab.
 *
 * Covers the "Billing" (LLM spend caps) top-level tab added to the Edit Mentor (Agent)
 * modal (rendered by the SDK's `AgentSpendCapsTab`,
 * `components/modals/edit-mentor-modal/tabs/spend-caps-tab.tsx`). Unlike the
 * feat/2040 `CapabilityGate` tabs (Sandbox/Voice/Screen Share/Privacy/
 * Memory/LTI), this tab has no master on/off toggle — it is admin-only
 * (`userTypes: [UserType.ADMIN]` in `hooks/use-mentor-segments.ts`) and
 * always mounted for admins. It lives in the **Configurations** sidebar
 * category, immediately after **LLM** and before **Voice**.
 *
 * The tab has three scopes, each a Radix sub-tab (`SpendCapsTab` page object
 * — `e2e/page-objects/edit-mentor/spend-caps.tab.ts`):
 *
 *   - "This agent" (`agent`)  — one cap for the currently open mentor.
 *   - "Per user"   (`users`)  — a list of per-(mentor, username) caps.
 *   - "Workspace"  (`tenant`) — ONE cap for the WHOLE TENANT.
 *
 * There is no `@iblai/iblai-js/playwright` helper package for spend caps yet,
 * so `SpendCapsTab`'s locators are hand-rolled off the SDK's own stable
 * `data-testid`s (verified directly against the compiled
 * `AgentSpendCapsTab`/`SpendCapForm` source — see that file's class doc).
 *
 * ── RBAC guard ───────────────────────────────────────────────────────────
 *
 * The backend RBAC-gates each scope independently and the SDK renders a
 * `data-testid="spend-caps-denied"` panel per scope on a 403 instead of
 * erroring (`hooks/use-mentor-segments.ts`'s segment comment: "the backend
 * gates each scope with RBAC ... but exposes no frontend-discoverable
 * resource path yet"). Every checkpoint below checks
 * `spendCaps.isDenied()` right after the scope settles and skips with a
 * reason rather than failing when this admin/tenant hasn't been granted
 * that RBAC resource in a given test environment — the same
 * `test.skip(condition, reason)` shape already used for env-gated
 * (`hasCanvasEnv`) and catalog-gated (`HumanSupportTab.hasToggle()`)
 * checkpoints elsewhere in this suite.
 *
 * ── Isolation ────────────────────────────────────────────────────────────
 *
 * Per house style (see journey 47's note, reused verbatim by 44/65): admin
 * e2e tests share the account-wide most-recently-accessed mentor, so
 * destructive tests must not run against it. Every test here gets its own
 * freshly-created mentor in `beforeEach` (tracked + deleted in `afterAll`
 * via `MentorTracker`), and the whole file runs `serial` so no parallel
 * worker can interleave with the ONE test that touches the Workspace scope.
 *
 * The Workspace ("tenant") cap is NOT mentor-scoped — a fresh mentor does
 * NOT isolate it. sc-08 is the only checkpoint that touches it, and:
 *   - it ALWAYS saves with `enforcement: 'Alert only'`, never
 *     'Block requests' — even if cleanup below fails, a leftover cap can
 *     only ever surface a near-limit notification, never block a chat
 *     request for another journey sharing this tenant;
 *   - it deletes the cap in a `finally` block unconditionally, so the
 *     tenant is left with no Workspace cap configured regardless of which
 *     assertion (if any) failed first.
 */

test.describe.configure({ mode: 'serial', timeout: 240_000 });

/** Text labels of the currently-visible segment tabs in the active category
 * (mirrors journey 44's `visibleSegmentTabLabels`). */
async function visibleSegmentTabLabels(dialog: Locator): Promise<string[]> {
  return dialog
    .locator('[role="tab"][aria-controls^="panel-"]:visible')
    .allTextContents();
}

/** Reads the current admin's username (`userData.user_nicename`) from
 * localStorage — the same field `deleteMentorById` reads for DM API auth.
 * Used as a safe, guaranteed-to-exist username for the per-user cap
 * checkpoint (an arbitrary made-up username may not resolve on the
 * backend). */
async function getCurrentUsername(page: Page): Promise<string> {
  const username = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('userData');
      if (!raw) return null;
      return JSON.parse(raw)?.user_nicename ?? null;
    } catch {
      return null;
    }
  });
  if (!username) {
    throw new Error(
      'getCurrentUsername: could not read userData.user_nicename from localStorage',
    );
  }
  return username;
}

test.describe('Journey 68: Mentor Billing (Spend Caps) Tab', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Billing tab requires admin access');
      return;
    }

    // Dedicated mentor per test — see the isolation note above. Cheap
    // relative to the assertions below and keeps every scope's "fresh /
    // empty" starting state honest (no leftover caps from a prior test).
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    await editMentorPage.open('Billing');
    await waitForPageReady(page);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  // ── sc-01 / sc-02: tab position + header + sub-tabs ──────────────────────

  test('admin sees the Billing tab in the Configurations category immediately after LLM, and it opens on the "This agent" scope', async ({
    editMentorPage,
  }) => {
    const labels = (await visibleSegmentTabLabels(editMentorPage.dialog)).map(
      (l) => l.trim(),
    );
    const llmIndex = labels.indexOf('LLM');
    const billingIndex = labels.indexOf('Billing');
    expect(llmIndex).toBeGreaterThanOrEqual(0);
    expect(billingIndex).toBe(llmIndex + 1);

    const { spendCaps } = editMentorPage;
    await expect(spendCaps.heading).toBeVisible({ timeout: 15_000 });
    await expect(spendCaps.description).toBeVisible({ timeout: 5_000 });
    await expect(spendCaps.subTabsList).toBeVisible({ timeout: 10_000 });
    await expect(spendCaps.subTabTrigger('agent')).toBeVisible({
      timeout: 5_000,
    });
    await expect(spendCaps.subTabTrigger('users')).toBeVisible({
      timeout: 5_000,
    });
    await expect(spendCaps.subTabTrigger('tenant')).toBeVisible({
      timeout: 5_000,
    });
    expect(await spendCaps.isSubTabActive('agent')).toBe(true);

    await editMentorPage.close();
  });

  // ── sc-03: sub-tab switching ──────────────────────────────────────────────

  test('switching between This agent, Per user, and Workspace updates the active sub-tab', async ({
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;

    await spendCaps.switchToSubTab('users');
    expect(await spendCaps.isSubTabActive('users')).toBe(true);
    expect(await spendCaps.isSubTabActive('agent')).toBe(false);
    await spendCaps.waitSettled('users');
    await expect(
      spendCaps.userCapsEmpty.or(spendCaps.userCapsSection).first(),
    ).toBeVisible({ timeout: 15_000 });

    await spendCaps.switchToSubTab('tenant');
    expect(await spendCaps.isSubTabActive('tenant')).toBe(true);
    expect(await spendCaps.isSubTabActive('users')).toBe(false);
    await spendCaps.waitSettled('tenant');
    await expect(
      spendCaps.tenantCap.form.or(spendCaps.deniedState()).first(),
    ).toBeVisible({ timeout: 15_000 });

    await spendCaps.switchToSubTab('agent');
    expect(await spendCaps.isSubTabActive('agent')).toBe(true);
    expect(await spendCaps.isSubTabActive('tenant')).toBe(false);

    await editMentorPage.close();
  });

  // ── sc-04: interval / enforcement option lists ────────────────────────────

  test('the agent-cap form lists interval options Day/Week/Month/Year and enforcement options Block requests/Alert only, in that order', async ({
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.waitSettled('agent');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the agent scope in this environment (403 → spend-caps-denied)',
    );

    const intervalLabels = await spendCaps.agentCap.readIntervalOptions();
    expect(intervalLabels).toEqual(['Day', 'Week', 'Month', 'Year']);

    const enforcementLabels = await spendCaps.agentCap.readEnforcementOptions();
    expect(enforcementLabels).toEqual(['Block requests', 'Alert only']);

    await editMentorPage.close();
  });

  // ── sc-05: create + persist an agent cap ──────────────────────────────────

  test('admin creates an agent spend cap and the values persist after closing and reopening the tab', async ({
    page,
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.waitSettled('agent');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the agent scope in this environment (403 → spend-caps-denied)',
    );

    // Freshly created mentor — no agent cap exists yet.
    await expect(spendCaps.agentCap.noCapHint).toBeVisible({
      timeout: 10_000,
    });

    await spendCaps.agentCap.fill({
      limit: '42.50',
      interval: 'Week',
      enforcement: 'Alert only',
      thresholds: '50, 90',
      enabled: true,
    });
    await spendCaps.agentCap.save();

    // Round-trip verification: close the modal, reopen, and re-read the
    // SERVER copy rather than trusting in-memory form state.
    await editMentorPage.close();
    await editMentorPage.open('Billing');
    await waitForPageReady(page);
    await spendCaps.waitSettled('agent');

    // `SpendCapForm` rehydrates the limit as `String(Number(cap.max_cost_usd))`
    // — "42.50" round-trips through the backend and back as "42.5".
    await expect(spendCaps.agentCap.limitInput).toHaveValue('42.5', {
      timeout: 15_000,
    });
    await expect(spendCaps.agentCap.intervalSelect).toContainText('Week');
    await expect(spendCaps.agentCap.enforcementSelect).toContainText(
      'Alert only',
    );
    await expect(spendCaps.agentCap.thresholdsInput).toHaveValue('50, 90');
    expect(await spendCaps.agentCap.isEnabled()).toBe(true);
    await expect(spendCaps.agentCap.usage).toBeVisible({ timeout: 10_000 });
    await expect(spendCaps.agentCap.alertOnlyBadge).toBeVisible({
      timeout: 10_000,
    });
    await expect(spendCaps.agentCap.spent).toContainText('$0.00');

    await editMentorPage.close();
  });

  // ── sc-06: validation ──────────────────────────────────────────────────────

  test('an invalid spend limit shows the validation error and disables Save', async ({
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.waitSettled('agent');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the agent scope in this environment (403 → spend-caps-denied)',
    );

    await spendCaps.agentCap.limitInput.fill('0');
    await expect(spendCaps.agentCap.limitError).toBeVisible({
      timeout: 5_000,
    });
    await expect(spendCaps.agentCap.limitError).toHaveText(
      'Enter an amount greater than 0',
    );
    await expect(spendCaps.agentCap.saveButton).toBeDisabled({
      timeout: 5_000,
    });

    // Nothing was saved — no cleanup needed.
    await editMentorPage.close();
  });

  // ── sc-07: remove an agent cap ─────────────────────────────────────────────

  test('admin removes the agent spend cap via the confirm modal and the "no cap" hint reappears', async ({
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.waitSettled('agent');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the agent scope in this environment (403 → spend-caps-denied)',
    );

    await spendCaps.agentCap.fill({
      limit: '15',
      interval: 'Month',
      enforcement: 'Alert only',
      enabled: true,
    });
    await spendCaps.agentCap.save();
    await expect(spendCaps.agentCap.deleteButton).toBeVisible({
      timeout: 10_000,
    });

    await spendCaps.agentCap.remove(
      'spend-cap-delete-modal',
      'spend-cap-delete-confirm',
    );

    await expect(spendCaps.agentCap.noCapHint).toBeVisible({
      timeout: 15_000,
    });

    await editMentorPage.close();
  });

  // ── sc-08: Workspace (tenant-wide) cap ─────────────────────────────────────
  //
  // TENANT-WIDE side effect — see the isolation note at the top of this file.
  // Always Alert-only; always cleaned up in `finally` regardless of outcome.

  test('admin configures the Workspace spend cap with Alert-only enforcement, the values persist, and the cap is removed afterward', async ({
    page,
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.switchToSubTab('tenant');
    await spendCaps.waitSettled('tenant');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the tenant scope in this environment (403 → spend-caps-denied)',
    );

    try {
      await spendCaps.tenantCap.fill({
        limit: '1000',
        interval: 'Month',
        enforcement: 'Alert only',
        thresholds: '80, 95',
        enabled: true,
      });
      await spendCaps.tenantCap.save();

      await editMentorPage.close();
      await editMentorPage.open('Billing');
      await waitForPageReady(page);
      await spendCaps.switchToSubTab('tenant');
      await spendCaps.waitSettled('tenant');

      await expect(spendCaps.tenantCap.limitInput).toHaveValue('1000', {
        timeout: 15_000,
      });
      await expect(spendCaps.tenantCap.enforcementSelect).toContainText(
        'Alert only',
      );
      await expect(spendCaps.tenantCap.alertOnlyBadge).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      // Always attempt to remove the Workspace cap — it is TENANT-WIDE and
      // would otherwise leak into every other journey sharing this tenant.
      // Best-effort: swallow errors so a failed cleanup never masks (or is
      // masked by) the assertions above.
      await spendCaps.switchToSubTab('tenant').catch(() => {});
      let hasCap = false;
      try {
        await spendCaps.tenantCap.deleteButton.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
        hasCap = true;
      } catch {
        hasCap = false;
      }
      if (hasCap) {
        await spendCaps.tenantCap
          .remove('spend-cap-delete-modal', 'spend-cap-delete-confirm')
          .catch(() => {});
      }
    }

    await editMentorPage.close();
  });

  // ── sc-09: Per-user sub-tab empty state + add-card open/cancel ────────────

  test('the Per-user sub-tab shows the empty state on a fresh mentor, and the Add user cap flow opens and cancels a draft form', async ({
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.switchToSubTab('users');
    await spendCaps.waitSettled('users');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the users scope in this environment (403 → spend-caps-denied)',
    );

    // Freshly created mentor — no per-user caps exist yet.
    await expect(spendCaps.userCapsEmpty).toBeVisible({ timeout: 10_000 });

    await spendCaps.startAddUserCap();
    await expect(spendCaps.usernameInput).toBeVisible({ timeout: 5_000 });
    // The embedded draft SpendCapForm only mounts once a non-empty username
    // has been typed.
    await expect(spendCaps.newUserCap.form).toBeHidden({ timeout: 3_000 });

    await spendCaps.cancelAddUserCap();
    await expect(spendCaps.userCapsEmpty).toBeVisible({ timeout: 10_000 });

    await editMentorPage.close();
  });

  // ── sc-10: create, list, and delete a per-user cap ─────────────────────────

  test('admin creates a per-user spend cap, sees it listed, and deletes it via the confirm modal', async ({
    page,
    editMentorPage,
  }) => {
    const { spendCaps } = editMentorPage;
    await spendCaps.switchToSubTab('users');
    await spendCaps.waitSettled('users');
    test.skip(
      await spendCaps.isDenied(),
      'Spend caps RBAC not granted for the users scope in this environment (403 → spend-caps-denied)',
    );

    const username = await getCurrentUsername(page);

    await spendCaps.createUserCap(username, {
      limit: '10',
      interval: 'Month',
      enforcement: 'Alert only',
      thresholds: '80, 95',
      enabled: true,
    });
    await expect(spendCaps.userCapRow(username)).toContainText('$10.00');

    await spendCaps.deleteUserCap(username);
    await expect(spendCaps.userCapsEmpty).toBeVisible({ timeout: 15_000 });

    await editMentorPage.close();
  });

  // ── sc-11: non-admin visibility ────────────────────────────────────────────

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
