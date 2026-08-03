import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import { GraderTab } from '../page-objects/edit-mentor/grader.tab';

/**
 * Journey 66 — Mentor Grader Tab.
 *
 * The Grader tab is a new top-level "Configurations" segment
 * (`hooks/use-mentor-segments.ts`, segment value `grader`) rendered by the
 * SDK's `AgentGraderTab` (`@iblai/iblai-js/web-containers/next`), wrapped
 * locally in `components/modals/edit-mentor-modal/tabs/grader-tab.tsx`. It
 * exposes an in-tab "Grading" capability toggle (via the shared
 * `CapabilityGate` component, same pattern as Voice / Screen Share / Memory /
 * Privacy / LTI) plus, once enabled, two gated sub-tabs: "Grading setup"
 * (config form) and "Rubric" (criteria table, modal-based add/edit/delete
 * behind each row's three-dots menu).
 *
 * All interactions go through the `GraderTab` page object
 * (`e2e/page-objects/edit-mentor/grader.tab.ts`), which delegates to the
 * official Grader-tab Playwright helpers exported from
 * `@iblai/iblai-js/playwright` (`GRADER_LABELS`, `isGraderTabVisible`,
 * `switchToGraderSubTab`, `isGradingEnabled`, `setGradingEnabled`,
 * `saveGraderConfig`, `addGraderCriterion`, `editGraderCriterion`,
 * `deleteGraderCriterion`, `expectLastCriterionDeleteDisabled`,
 * `expectGraderMisconfiguredWarning`, `expectGraderTotalPoints`, etc.) —
 * mirrors the `VoiceTab` / `EvaluationTab` pattern. Only the handful of
 * concerns the helper package doesn't cover (the shared `CapabilityGate`
 * wrapper's `data-enabled`, the sub-tab pills themselves, the cancel-delete
 * path, row lookups by name) stay hand-rolled in the page object, documented
 * there as such.
 *
 * ── RBAC ────────────────────────────────────────────────────────────────
 * The backend does not expose the grader RBAC permissions yet
 * (`/mentors/{id}/graderconfigurations/#read|action|write`,
 * `/mentors/{id}/gradercriteria/#action|write|delete`), so the published
 * SDK build ships the grader tab without RBAC wiring (its RBAC props were
 * removed until the permissions land) and the host gates the whole tab to
 * platform admins via the segment's `userTypes` instead
 * (`hooks/use-mentor-segments.ts`, mirroring Tasks / LTI). When the backend
 * permissions land, the SDK re-adds its in-tab checks and the host gates
 * the segment on `graderconfigurations/#read` — see GRD-13 for what
 * becomes testable then. No checkpoint here drives a denied-permission
 * state, since there's no fixture in this environment to seed one.
 *
 * ── Isolation strategy ─────────────────────────────────────────────────────
 * Unlike Privacy (journey 45), which safely shares the account's
 * most-recently-accessed mentor because its toggle only flips a plain
 * boolean field restored in `afterEach`, the Grading toggle here MUTATES THE
 * MENTOR'S ATTACHED TOOLS (`tool_slugs` / `can_use_tools` via
 * `editMentor`) — the same fields journey 06's "Admin can toggle tools
 * on/off" (mgmt-04) and the Tools tab exercise. Running this destructively
 * against the shared mentor would risk racing (or being raced by) any other
 * suite touching that mentor's tool list. Mirrors journey 47's Voice tab
 * isolation exactly: the whole file runs serially in a single worker
 * (`test.describe.configure({ mode: 'serial' })`) AND every test gets its own
 * freshly-created, disposable mentor via `createMentorPage.openAndCreate()`
 * in `beforeEach`, tracked and deleted in `afterAll` via `MentorTracker`.
 *
 * ── Tenant tool-catalogue dependency ───────────────────────────────────────
 * Turning the Grading capability ON only succeeds if the tenant's tool
 * catalogue actually contains a tool named "Grading" — if it doesn't, the
 * SDK shows the `toggleError` toast ("Couldn't update grading") and the
 * switch never flips. Every checkpoint that needs the capability ON attempts
 * it via `GraderTab.tryEnableGrading()` (which races the success/error toasts
 * rather than calling the SDK's `setGradingEnabled`, which only waits on the
 * success toast) and `test.skip`s gracefully — never fails — when it comes
 * back `false`, since that signals an environment without the tool seeded
 * rather than an app bug. Disabling never depends on the catalogue, so it
 * uses the plain `setGradingEnabled(false)` delegate directly.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Journey 66: Mentor Grader Tab', () => {
  const tracker66 = new MentorTracker();

  test.beforeEach(async ({ page, editMentorPage, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Grader tab requires admin access');
      return;
    }

    // Fresh, dedicated mentor per test — see isolation note above.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker66.add(mentorId);

    await editMentorPage.open('Grader');
    await waitForPageReady(page);
  });

  // GRD-01: Grader tab is visible in the modal sidebar (Configurations
  // category, always mounted for a platform admin — the segment is
  // admin-only via userTypes until the backend grader RBAC lands, see the
  // RBAC note above).
  test('admin sees the Grader tab label in the sidebar', async ({
    editMentorPage,
  }) => {
    expect(await editMentorPage.grader.isTabVisible()).toBe(true);
    await editMentorPage.close();
  });

  // GRD-02: Heading, description, and tab body all render (not stuck on the
  // loading spinner) once the mentor-settings query resolves.
  test('admin opens the Grader tab and sees the heading, description, and body', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.grader.heading).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.grader.description).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.grader.body()).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.grader.loadingSpinner).toHaveCount(0, {
      timeout: 15_000,
    });
    await editMentorPage.close();
  });

  // GRD-03: The gated content splits into two sub-tabs — "Grading setup"
  // and "Rubric" — both visible, and switching between them renders the
  // matching section.
  test('admin sees the Grading setup and Rubric sub-tabs and can switch between them', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach — the sub-tabs only render once Grading is on.',
    );

    await expect(grader.subTabs).toBeVisible({ timeout: 10_000 });
    await expect(grader.setupSubTab).toBeVisible({ timeout: 5_000 });
    await expect(grader.rubricSubTab).toBeVisible({ timeout: 5_000 });

    await grader.switchToSubTab('rubric');
    await expect(
      grader.body().getByTestId('grader-criteria-section'),
    ).toBeVisible({
      timeout: 10_000,
    });

    await grader.switchToSubTab('setup');
    await expect(grader.body().getByTestId('grader-setup-section')).toBeVisible(
      {
        timeout: 10_000,
      },
    );

    await editMentorPage.close();
  });

  // GRD-04: A freshly created mentor has no "Grading" tool attached, so the
  // capability toggle defaults OFF, the gated content is grayed
  // (data-enabled="false"), and the off-hint is shown.
  test('on a fresh mentor, the Grading capability defaults to OFF and the gated content is grayed', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    expect(await grader.isGradingEnabled()).toBe(false);
    await expect(grader.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );
    await grader.expectOffHintVisible(true);
    await editMentorPage.close();
  });

  // GRD-05: Enabling the toggle flips it on and ungates the content; since
  // neither a config nor any criteria exist yet, the "no config yet"
  // misconfigured warning is shown (not the "no criteria" one — that only
  // appears once a config exists).
  test('admin enables Grading and sees the "not set up yet" warning', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach — cannot exercise the ON state in this environment.',
    );

    await expect(grader.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );
    await grader.expectMisconfiguredWarning(true);
    await expect(grader.misconfiguredWarning).toContainText(
      GraderTab.UNEXPORTED_LABELS.warnings.noConfig,
    );

    await editMentorPage.close();
  });

  // GRD-06: Filling in and saving the Grading setup form clears the "no
  // config" warning and replaces it with the "no criteria" warning (rubric
  // is still empty).
  test('admin saves the grading setup and the warning switches from "no config" to "no criteria"', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach.',
    );

    await grader.saveConfig({
      instructions: 'E2E: grade the submission for clarity and correctness.',
    });

    await grader.expectMisconfiguredWarning(true);
    await expect(grader.misconfiguredWarning).toContainText(
      GraderTab.UNEXPORTED_LABELS.warnings.noCriteria,
    );

    await editMentorPage.close();
  });

  // GRD-07: With a saved config, admin adds a rubric criterion (through the
  // Add-criterion modal) — it appears in the criteria list, the
  // misconfigured warning clears, and the running total reflects its
  // points.
  test('admin adds a rubric criterion and the misconfigured warning clears', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach.',
    );

    await grader.saveConfig({
      instructions: 'E2E: grade for clarity and correctness.',
    });
    await grader.addCriterion({
      name: 'Clarity',
      criteria: 'The argument is easy to follow.',
      points: 10,
    });

    await grader.expectMisconfiguredWarning(false);
    await grader.expectTotalPoints(10);

    await editMentorPage.close();
  });

  // GRD-08: Admin edits an existing criterion's name and points via the
  // row's three-dots menu → Edit modal, and the row + running total reflect
  // the update.
  test('admin edits a rubric criterion via the row menu and modal', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach.',
    );

    await grader.saveConfig({
      instructions: 'E2E: grade for clarity and correctness.',
    });
    await grader.addCriterion({
      name: 'Clarity',
      criteria: 'The argument is easy to follow.',
      points: 10,
    });

    await grader.editCriterion('Clarity', {
      name: 'Clarity v2',
      criteria: 'The argument is easy to follow.',
      points: 15,
    });

    await expect(await grader.criterionRowByName('Clarity v2')).toBeVisible({
      timeout: 10_000,
    });
    await expect(await grader.criterionRowByName('Clarity')).toHaveCount(0, {
      timeout: 10_000,
    });
    await grader.expectTotalPoints(15);

    await editMentorPage.close();
  });

  // GRD-09: With two criteria present, deleting one is allowed (not the last
  // remaining one) — the row's three-dots menu → Delete opens a confirm
  // modal, and cancelling it leaves the row untouched.
  test('admin cancels a delete confirmation, then deletes a non-last criterion', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach.',
    );

    await grader.saveConfig({
      instructions: 'E2E: grade for clarity and correctness.',
    });
    await grader.addCriterion({
      name: 'Clarity',
      criteria: 'The argument is easy to follow.',
      points: 10,
    });
    await grader.addCriterion({
      name: 'Accuracy',
      criteria: 'Facts and figures are correct.',
      points: 5,
    });
    expect(await grader.criterionCount()).toBe(2);

    await grader.cancelDeleteCriterion('Accuracy');
    await expect(await grader.criterionRowByName('Accuracy')).toBeVisible({
      timeout: 5_000,
    });

    await grader.deleteCriterion('Accuracy');
    expect(await grader.criterionCount()).toBe(1);

    await editMentorPage.close();
  });

  // GRD-10: The backend refuses to delete the LAST remaining criterion — the
  // row menu's Delete item is disabled (aria-disabled) with an explanatory
  // hint shown, rather than letting the request fail.
  test('deleting the last remaining criterion is refused', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach.',
    );

    await grader.saveConfig({
      instructions: 'E2E: grade for clarity and correctness.',
    });
    await grader.addCriterion({
      name: 'Clarity',
      criteria: 'The argument is easy to follow.',
      points: 10,
    });
    expect(await grader.criterionCount()).toBe(1);

    await grader.expectLastCriterionDeleteDisabled('Clarity');

    await editMentorPage.close();
  });

  // GRD-11: Turning the Grading capability OFF grays the content but
  // preserves the saved config and rubric — turning it back ON re-reveals
  // the same criterion untouched (no delete endpoint for either when the
  // tool is detached).
  test('disabling then re-enabling Grading preserves the saved config and rubric', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach.',
    );

    await grader.saveConfig({
      instructions: 'E2E: grade for clarity and correctness.',
    });
    await grader.addCriterion({
      name: 'Clarity',
      criteria: 'The argument is easy to follow.',
      points: 10,
    });

    // Disabling never depends on the tool catalogue — a genuine bug here
    // should fail the test, not be swallowed, so this uses the plain
    // delegate rather than a "try" wrapper.
    await grader.setGradingEnabled(false);
    await expect(grader.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );

    // The tool was already proven attachable earlier in this same test
    // (tryEnableGrading succeeded above), so re-enabling here is expected to
    // succeed deterministically too.
    await grader.setGradingEnabled(true);
    await expect(grader.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );
    await expect(await grader.criterionRowByName('Clarity')).toBeVisible({
      timeout: 10_000,
    });
    await grader.expectTotalPoints(10);

    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker66.deleteAll(browser, testInfo);
  });
});

// ── Non-admin: Grader tab must stay unreachable ──────────────────────────
//
// The `grader` segment is platform-admin-only via `userTypes: [ADMIN]`
// (mirroring Tasks / LTI) until the backend grader RBAC resources land — a
// plain non-admin (student) account cannot open the "Selected agent"
// dropdown's Settings/Modify item at all (see journey 06's mgmt-02), so the
// tab is unreachable in practice. Mirrors journey 47/63's non-admin pattern:
// the dropdown-menu-item check alone already proves this for the common
// case; the fallback branch below covers any environment where a non-admin
// CAN somehow open the dialog.
test.describe('Journey 66: Mentor Grader Tab — Non-Admin', () => {
  test('non-admin does not see the Grader tab in the Edit Mentor modal', async ({
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
      // Non-admin cannot open the edit dialog at all — the Grader tab is
      // definitively not reachable. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) non-admin can open the dialog, verify the Grader tab
    // specifically is still absent.
    await modifyItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });

    expect(await nonadminEditMentorPage.grader.isTabVisible()).toBe(false);

    await nonadminEditMentorPage.close();
  });
});

// GRD-13 (documentation checkpoint, not-reproducible in this environment):
// the grader tab's fine-grained RBAC gating — denied
// `graderconfigurations/#read` renders the tab's own denied empty state;
// denied `write`/`action`/`delete` on the config or criteria resources
// omits the Save/Add/Edit/Delete affordances rather than erroring
// (conditionally rendered, not merely disabled). The backend does not
// expose the grader permissions yet, so the published SDK build ships the
// tab without RBAC wiring and the host gates the segment to admins via
// `userTypes` instead — the RBAC paths are therefore doubly unreachable
// today: no backend permissions to seed AND no checks wired in this build.
// When the permissions land (SDK re-adds its checks, host gates the
// segment on `graderconfigurations/#read`), exercising them will still
// require a fixture that seeds a restricted RBAC permission object for the
// e2e admin account, which this environment lacks (consistent with every
// other RBAC-gated tab in this suite, e.g. journey 24's mem-06, journey
// 6's mgmt-12/13/14). See `e2e/coverage.json`'s `grd-13` entry
// (status: not-reproducible) for the tracked record.
