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
 * `CapabilityGate` component, same pattern as Voice / Screen / Memory /
 * Privacy / LTI) plus, once enabled, three gated sub-tabs: "Grading Setup"
 * (config form), "Rubric" (criteria table, modal-based add/edit/delete
 * behind each row's three-dots menu), and "Results" (grade-results table
 * with filters and a per-row Override affordance that pushes grade
 * overrides back to the LMS).
 *
 * All interactions go through the `GraderTab` page object
 * (`e2e/page-objects/edit-mentor/grader.tab.ts`), which delegates to the
 * official Grader-tab Playwright helpers exported from
 * `@iblai/iblai-js/playwright` (`GRADER_LABELS`, `isGraderTabVisible`,
 * `switchToGraderSubTab`, `isGradingEnabled`, `setGradingEnabled`,
 * `saveGraderConfig`, `addGraderCriterion`, `editGraderCriterion`,
 * `deleteGraderCriterion`, `expectLastCriterionDeleteDisabled`,
 * `expectGraderMisconfiguredWarning`, `expectGraderTotalPoints`,
 * `filterGradeResultsByEmail`, `expectGradeResultRow`, `overrideGradeResult`,
 * `clearGradeResultOverride`, etc.) — mirrors the `VoiceTab` /
 * `EvaluationTab` pattern. Only the handful of concerns the helper package
 * doesn't cover (the shared `CapabilityGate` wrapper's `data-enabled`, the
 * sub-tab pills themselves, the cancel-delete path, row lookups by name, the
 * Results empty-state copy) stay hand-rolled in the page object, documented
 * there as such.
 *
 * ── RBAC ────────────────────────────────────────────────────────────────
 * The backend now exposes grader permissions as flat actions on the mentor
 * resource (`/mentors/{id}/#read_grader_config`, `#write_grader_config`,
 * `#create_grader_config`, `#view_grader_criteria`, `#create_grader_criteria`,
 * `#write_grader_criteria`, `#delete_grader_criteria`, `#view_grade_results`,
 * `#override_grade_results`) — the same `/mentors/{id}/` RBAC entry every
 * other mentor-scoped check already fetches. `useGrader` checks these with a
 * graceful fallback (enforcement only kicks in once the RBAC permission tree
 * actually contains an entry for that mentor); denied `read_grader_config`
 * renders the tab's own denied empty state, and denied write/create/delete/
 * override actions omit the matching affordance rather than erroring. The
 * host additionally gates the whole segment on `read_grader_config`
 * (`hooks/use-mentor-segments.ts`) with the standard `[FREE_TRIAL, ADMIN]`
 * `userTypes` set every mainstream Edit Agent tab uses. This repo's e2e
 * admin account holds full permissions on mentors it owns for MOST grader
 * actions, but NOT uniformly — confirmed live against the real tenant:
 * `read_grader_config`/`view_grader_criteria` are granted (Grading Setup
 * and Rubric always render, GRD-03), but `view_grade_results` is NOT (the
 * Results pill never renders for this account — GRD-04 checks for it and
 * skips gracefully rather than assuming it). The remaining denied-write/
 * create/delete/override paths still have no fixture in this environment to
 * seed; see GRD-14/GRD-15.
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
  // category, always mounted for an admin with standard mentor-owner
  // permissions — the segment is additionally gated on
  // read_grader_config, see the RBAC note above).
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

  // GRD-03: The gated content exposes the Grading Setup and Rubric sub-tabs
  // — both consistently visible for the e2e admin across every live run —
  // and switching between them renders the matching section. The Results
  // pill is intentionally NOT asserted here: confirmed live against the real
  // e2e tenant that `view_grade_results` is not granted to this admin even
  // though `read_grader_config`/`view_grader_criteria` are, so the Results
  // pill never renders for this account — see GRD-04, which checks for it
  // explicitly and skips gracefully rather than assuming it.
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

  // GRD-04: The Results sub-tab renders its own grade-results table and, on
  // a mentor with no graded submissions yet, shows the zero-filters empty
  // state ("No grades yet…"). Doesn't depend on a saved config or rubric —
  // ResultsSection queries grade results directly, independent of hasConfig.
  // Gracefully skips if the Results pill isn't granted — CONFIRMED live that
  // this repo's e2e admin lacks `view_grade_results` on the real tenant (see
  // GraderTab's RBAC class doc), so this is an expected skip in that
  // environment today, not a failure.
  test('admin sees the Results sub-tab and its empty state on a fresh mentor', async ({
    editMentorPage,
  }) => {
    const { grader } = editMentorPage;
    const enabled = await grader.tryEnableGrading();
    test.skip(
      !enabled,
      'Tenant tool catalogue has no "Grading" tool to attach — the Results sub-tab only renders once Grading is on.',
    );

    const resultsVisible = await grader.isResultsSubTabVisible();
    test.skip(
      !resultsVisible,
      'e2e admin lacks view_grade_results on this tenant — the Results pill is permission-gated and never renders (confirmed live).',
    );

    await grader.expectResultsEmpty({ filtered: false });

    await editMentorPage.close();
  });

  // GRD-05: A freshly created mentor has no "Grading" tool attached, so the
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

  // GRD-06: Enabling the toggle flips it on and ungates the content, and the
  // misconfigured warning settles on "rubric is empty". Attaching the
  // Grading tool AUTO-PROVISIONS the grader config row server-side, and the
  // SDK's `toggleGrading` (useGrader, iblai-js ≥ 2.8.1) refetches the config
  // right after the settings PATCH succeeds — so the "not set up yet" (no
  // config) wording is only a transient flash between the success toast and
  // that refetch landing, never the settled state on a fresh mentor. A live
  // trace caught exactly that flash: "not set up yet" at the toast, "rubric
  // is empty" ~1s later. `toContainText` retries, so it rides out the flash
  // and asserts the settled wording — do NOT assert `noConfig` here.
  test('admin enables Grading and sees the "rubric is empty" warning (config is auto-provisioned on attach)', async ({
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
      GraderTab.UNEXPORTED_LABELS.warnings.noCriteria,
      { timeout: 10_000 },
    );

    await editMentorPage.close();
  });

  // GRD-07: Filling in and saving the Grading setup form (a PATCH, since the
  // config row was auto-provisioned on attach — see GRD-06) succeeds and
  // leaves the "no criteria" warning in place: the rubric is still empty,
  // so saving instructions alone must not clear the banner.
  test('admin saves the grading setup and the "no criteria" warning stays until a criterion exists', async ({
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

  // GRD-08: With a saved config, admin adds a rubric criterion (through the
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

  // GRD-09: Admin edits an existing criterion's name and points via the
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

  // GRD-10: With two criteria present, deleting one is allowed (not the last
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

  // GRD-11: The backend refuses to delete the LAST remaining criterion — the
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

  // GRD-12: Turning the Grading capability OFF grays the content but
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

// GRD-13 — Non-admin: Grader tab must stay unreachable ────────────────────
//
// The `grader` segment uses the standard `[FREE_TRIAL, ADMIN]` userTypes set
// every mainstream Edit Agent tab uses (plus the `read_grader_config` RBAC
// resource gate) — a plain non-admin (student) account cannot open the
// "Selected agent" dropdown's Settings/Modify item at all (see journey 06's
// mgmt-02), so the tab is unreachable in practice. Mirrors journey 47/63's
// non-admin pattern: the dropdown-menu-item check alone already proves this
// for the common case; the fallback branch below covers any environment
// where a non-admin CAN somehow open the dialog.
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

// GRD-14 (documentation checkpoint, not-reproducible in this environment):
// the grader tab's fine-grained RBAC gating is real — the backend exposes
// flat actions on the mentor resource (read_grader_config,
// write_grader_config, create_grader_config, view_grader_criteria,
// create_grader_criteria, write_grader_criteria, delete_grader_criteria,
// view_grade_results, override_grade_results) and useGrader checks them via
// `/mentors/{id}/#<action>` with a graceful fallback (enforcement only
// kicks in once the RBAC permission tree actually contains an entry for
// that mentor — otherwise every action stays allowed). Denied
// read_grader_config (or every view action denied at once) renders the
// tab's own denied empty state and drops that sub-tab's trigger entirely;
// denied write/create/delete/override actions omit the matching
// Save/Add/Edit/Delete/Override affordance rather than erroring
// (conditionally rendered, not merely disabled). GRD-04 already exercises
// ONE denied-permission path live (view_grade_results, confirmed denied for
// the e2e admin — see the class doc in grader.tab.ts) by skipping
// gracefully. The remaining denied paths — read_grader_config denial (tab
// hidden entirely), and write/create/delete/override denial (affordance
// omitted) — still require seeding a restricted RBAC permission object this
// environment has no fixture for. See `e2e/coverage.json`'s `grd-14` entry
// (status: not-reproducible) for the tracked record.

// GRD-15 (documentation checkpoint, not-reproducible in this environment):
// the Results sub-tab's grade-override flow (`GraderTab.overrideResult` /
// `clearResultOverride`, which PATCH a learner's grade override back to the
// LMS through the grade-results endpoint) requires a real graded submission
// to already exist AND the `override_grade_results` RBAC action — moot for
// the e2e admin today anyway, since it also lacks `view_grade_results` and
// so can't even reach a result row to override (GRD-04). Grading only
// happens when a learner actually chats with the agent and the agent's own
// LLM-driven grading run completes against a live LMS-connected runtime —
// this e2e environment has no fixture to produce a graded submission on
// demand. GRD-04 already covers the one Results-tab state this environment
// CAN reliably produce: the empty table on a mentor nothing has graded yet
// (when the pill is granted at all). See `e2e/coverage.json`'s `grd-15`
// entry (status: not-reproducible) for the tracked record.
