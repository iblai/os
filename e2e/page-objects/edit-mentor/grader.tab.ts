import { Page, Locator, expect } from '@playwright/test';
import {
  GRADER_LABELS,
  graderTabBody,
  isGraderTabVisible,
  switchToGraderTab,
  switchToGraderSubTab,
  isGradingEnabled,
  setGradingEnabled,
  saveGraderConfig,
  addGraderCriterion,
  editGraderCriterion,
  deleteGraderCriterion,
  expectLastCriterionDeleteDisabled,
  expectGraderMisconfiguredWarning,
  expectGraderTotalPoints,
  filterGradeResultsByEmail,
  expectGradeResultRow,
  overrideGradeResult,
  clearGradeResultOverride,
  type GraderSubTab,
  type GraderGradingMode,
  type GraderFeedbackMode,
  type GraderCriterionInput,
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the "Grader" tab inside the Edit Mentor modal.
 *
 * The tab is rendered by the SDK's `AgentGraderTab` component
 * (`@iblai/iblai-js/web-containers/next`, wrapped locally in
 * `components/modals/edit-mentor-modal/tabs/grader-tab.tsx`). All selectors
 * flow through the official Grader-tab Playwright helpers re-exported by
 * `@iblai/iblai-js/playwright` (mirrors the `VoiceTab` / `EvaluationTab`
 * pattern) — never patch a selector here; if labels are overridden via the
 * `labels` prop, update the `GRADER_LABELS` import chain instead.
 *
 * The helpers resolve the edit-agent dialog themselves from `page` (they
 * scope through `page.getByRole('dialog').filter({ has: tablist })`
 * internally), so every delegate below takes `this.page`, not `this.dialog`
 * — same pattern as `EvaluationTab`.
 *
 * ── Structure (re-verified against the RBAC-aware rebuild) ────────────────
 * The gated content is split into THREE sub-tabs — "Grading Setup" (config
 * form, `grader-sub-tab-setup` / `grader-setup-section`), "Rubric" (criteria
 * table, `grader-sub-tab-rubric` / `grader-criteria-section`), and "Results"
 * (grade-results table, `grader-sub-tab-results` / `grader-results-section`).
 * `saveGraderConfig` / `addGraderCriterion` / `editGraderCriterion` /
 * `deleteGraderCriterion` / `expectLastCriterionDeleteDisabled` /
 * `expectGraderTotalPoints` / `filterGradeResultsByEmail` /
 * `expectGradeResultRow` / `overrideGradeResult` / `clearGradeResultOverride`
 * all switch to the relevant sub-tab internally before acting — callers
 * don't need to switch first. Criterion add/edit are modal-based
 * (`grader-criterion-modal` + `grader-criterion-modal-save`, fields
 * "Name"/"Criteria"/"Points" — note the name field is labelled "Name", not
 * "Criterion"), and each row exposes a three-dots actions menu (`aria-label`
 * from `GRADER_LABELS.menu.actionsAria(name)`) with "Edit" / "Delete" items.
 * Delete goes through its own confirm modal (`grader-criterion-delete-modal`
 * + `grader-criterion-delete-confirm`). The Results sub-tab's per-row
 * "Override" button (`aria-label` from
 * `GRADER_LABELS.results.overrideButtonAria(email)`) opens
 * `grader-override-modal` (fields "Override Points"/"Override Feedback",
 * `grader-override-save` / `grader-override-clear`), which pushes the
 * override back to the LMS.
 *
 * Re-verified against a subsequent yalc rebuild (Aug 7): `GRADER_LABELS`
 * display strings moved to Title Case across the board (e.g. "Grading
 * Setup", "Add Criterion", "Override Points"/"Override Feedback",
 * grading/feedback mode option labels) — transparent to every method here
 * since none of them hardcode these display strings, only the stable
 * `GRADER_LABELS.*` property paths and `data-testid`s (all unchanged). The
 * Results sub-tab's learner filter was reworked from separate email/
 * username text inputs into a single "Search for User" combobox picker
 * (`grader-results-user-filter` trigger, `GRADER_LABELS.results.
 * searchUsersPlaceholder` search box) — absorbed transparently by
 * `filterResultsByEmail`/`filterGradeResultsByEmail`, which this page
 * object only delegates to (never called directly by this journey's
 * checkpoints today, so nothing here needed updating). All other testids
 * (sub-tabs, sections, modals, capability toggle/gate) and the hand-pinned
 * `UNEXPORTED_LABELS` copy below were re-confirmed byte-for-byte unchanged.
 *
 * ── RBAC ────────────────────────────────────────────────────────────────
 * The backend now exposes grader permissions as FLAT actions on the mentor
 * resource (`/mentors/{mentorDbId}/#<action>`, same entry every other
 * mentor-scoped check uses) — `read_grader_config`, `write_grader_config`,
 * `create_grader_config`, `view_grader_criteria`, `create_grader_criteria`,
 * `write_grader_criteria`, `delete_grader_criteria`, `view_grade_results`,
 * `override_grade_results`. `useGrader` checks these with a graceful
 * fallback: `allow(action) = !mentorEntry || checkRbacPermission(...)` —
 * enforcement only kicks in once the RBAC permission tree actually contains
 * an entry for that mentor; otherwise every action stays allowed and the
 * server's own 403s remain the source of truth. Denied `read_grader_config`
 * (or every view action denied at once — `nothingViewable`) renders the
 * `grader-tab-denied` empty state and drops that sub-tab's trigger entirely;
 * denied `write`/`create`/`delete`/`override` actions omit the matching
 * Save/Add/Edit/Delete/Override affordance rather than erroring
 * (conditionally rendered, not merely disabled). The host additionally
 * gates the whole Grader segment on `/mentors/{id}/#read_grader_config`
 * (`hooks/use-mentor-segments.ts`) — a denied admin never sees the tab at
 * all. This repo's e2e admin account holds full permissions on mentors it
 * owns for MOST grader actions, but NOT all of them uniformly — confirmed
 * live against the real e2e tenant (`conradtesttenant`): `read_grader_config`
 * and `view_grader_criteria` are granted (Grading Setup / Rubric pills
 * always render), but `view_grade_results` is NOT (the Results pill never
 * renders for this account, on every live run observed). Checkpoints that
 * depend on the Results pill (`isResultsSubTabVisible`) check for it and
 * skip gracefully rather than assume it — see GRD-04 in
 * `66-mentor-grader-tab.spec.ts`. The remaining denied-permission paths
 * (config/criteria write denial, override denial) still have no fixture in
 * this environment to seed — see the `not-reproducible` checkpoints there
 * for that narrower, still-open gap.
 *
 * ── Capability toggle ──────────────────────────────────────────────────────
 * The "Grading" master switch (`grader-capability-toggle`) lives inline at
 * the top of the tab via the shared `CapabilityGate` component, exactly like
 * Voice / Screen / Memory / Privacy / LTI. It attaches/detaches the
 * tenant's "Grading" TOOL on the mentor (`editMentor({ tool_slugs,
 * can_use_tools })`) rather than flipping a plain boolean settings field.
 * `setGradingEnabled` is optimistic (per its own doc: "the switch itself
 * flips optimistically and would roll back on failure") and additionally
 * waits for the SUCCESS toast before considering the toggle settled — so a
 * failed attach (see below) will make it time out rather than return
 * `false`.
 *
 * IMPORTANT — tenant catalogue dependency: turning the toggle ON only
 * succeeds if the tenant's tool catalogue actually contains a tool named
 * "Grading". If it doesn't, the SDK shows the `toggleError` toast
 * ("Couldn't update grading" — NOT exported on `GRADER_LABELS.toasts`,
 * which only carries `toggleOn`/`toggleOff`; hardcoded here against the
 * compiled bundle's `graderTabLabels.toasts.toggleError`, re-confirmed
 * unchanged in the RBAC-aware rebuild) and the switch never flips.
 * `tryEnableGrading` races both toasts directly instead of calling
 * `setGradingEnabled` for the ON direction, so a missing tool fails fast
 * (surfaced as `false`) instead of burning `setGradingEnabled`'s full
 * timeout waiting on a success toast that will never come. The OFF
 * direction never depends on the catalogue, so it delegates straight to
 * `setGradingEnabled` — a failure there is a genuine bug, not an
 * environment gap, and should throw.
 *
 * Turning the capability OFF never touches the grader config/rubric — there
 * is no DELETE for either, so both survive a disable/re-enable cycle (see
 * `useGrader.toggleGrading`'s inline comment in the SDK source).
 */
export class GraderTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Re-exported for convenience — see `GRADER_LABELS` doc in the SDK helpers. */
  static readonly LABELS = GRADER_LABELS;

  /**
   * Copy NOT exported by `GRADER_LABELS` (confirmed against the compiled
   * `@iblai/web-containers` bundle's `graderTabLabels` object) — pinned here
   * only because a couple of checkpoints want to assert on it specifically.
   * Prefer `GRADER_LABELS` wherever it has the string. Re-verified against
   * the RBAC-aware rebuild: the header description and `toggleError` toast
   * are byte-for-byte unchanged; the two warning strings picked up minor
   * wording tweaks ("...in Grading setup to finish." / "...in the Rubric
   * tab.") but the regexes below still match either wording. The Results
   * empty-state strings are new in this rebuild — also confirmed against
   * the same `graderTabLabels.results` object.
   */
  static readonly UNEXPORTED_LABELS = {
    header: {
      description:
        'Set up how your agent grades work against a rubric you define.',
    },
    toasts: {
      toggleError: "Couldn't update grading",
    },
    warnings: {
      // `noConfig` is only a transient flash on a fresh mentor: attaching
      // the Grading tool auto-provisions the config row and useGrader
      // refetches it right after the toggle succeeds, so the settled
      // post-enable wording is `noCriteria` (journey 66 GRD-06).
      noConfig: /not set up yet/i,
      noCriteria: /rubric is empty/i,
    },
    results: {
      emptyState:
        'No grades yet. They will appear here once the agent starts grading.',
      emptyFiltered: 'No grades match the current filters.',
    },
  } as const;

  /**
   * Wrapper around the gated config/rubric content — `data-enabled` mirrors
   * the toggle. Hand-rolled: the shared `CapabilityGate` wrapper has no
   * dedicated export in the grader-tab helpers (same gap in the Voice /
   * Privacy tab helper packages), so this stays a direct testid lookup like
   * every other CapabilityGate-based page object in this repo. `:visible`
   * scopes to the currently-active tab's gate, since inactive top-level tab
   * panels can stay force-mounted (CSS-hidden) rather than unmounted.
   */
  readonly capabilityContent: Locator;
  /** Hint shown next to the description while the capability is off — same gap as above. */
  readonly capabilityOffHint: Locator;
  /** Spinner shown while mentor settings are still loading — no dedicated helper export. */
  readonly loadingSpinner: Locator;
  /** Friendly denied empty state (server 403 on config `read`, denied `read_grader_config`, or every view action denied at once) — no dedicated helper export. */
  readonly deniedState: Locator;
  /** "Grading is on but ..." warning banner — presence is covered by `expectMisconfiguredWarning`; kept for reading its exact wording. */
  readonly misconfiguredWarning: Locator;
  /**
   * The sub-tab segmented control and its three triggers (a denied RBAC
   * action drops the corresponding trigger, see class doc). No dedicated
   * getter is exported for these (only the `switchToGraderSubTab` action
   * helper is) — same situation as `VoiceTab`'s
   * `subTabs`/`voiceSubTab`/`callConfigSubTab`, which are hand-rolled
   * testid locators for the same reason.
   */
  readonly subTabs: Locator;
  readonly setupSubTab: Locator;
  readonly rubricSubTab: Locator;
  readonly resultsSubTab: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.capabilityContent = dialog.locator(
      '[data-testid="capability-gate-content"]:visible',
    );
    this.capabilityOffHint = dialog.locator(
      '[data-testid="capability-gate-off-hint"]:visible',
    );
    this.loadingSpinner = dialog.getByTestId('grader-tab-loading');
    this.deniedState = dialog.getByTestId('grader-tab-denied');
    this.misconfiguredWarning = dialog.getByTestId(
      'grader-misconfigured-warning',
    );
    this.subTabs = dialog.getByTestId('grader-sub-tabs');
    this.setupSubTab = dialog.getByTestId('grader-sub-tab-setup');
    this.rubricSubTab = dialog.getByTestId('grader-sub-tab-rubric');
    this.resultsSubTab = dialog.getByTestId('grader-sub-tab-results');
  }

  // ── Tab navigation / body ────────────────────────────────────────────────

  /** The tab body — present regardless of capability state (tab is always mounted). */
  body(): Locator {
    return graderTabBody(this.page);
  }

  /** Whether the Grader tab is currently rendered in the Edit Agent dialog. */
  isTabVisible(): Promise<boolean> {
    return isGraderTabVisible(this.page);
  }

  /**
   * Switch to the Grader tab directly via the SDK helper. NOTE: this does
   * NOT switch the host app's own "Configurations" category strip first —
   * that's a genuinely host-side concern the SDK has no way to know about.
   * Journeys should navigate via `editMentorPage.open('Grader')` /
   * `editMentorPage.navigateToTab('Grader')`, which handles the category
   * switch before the tab trigger is even in the DOM; call this only when
   * the category is already active.
   */
  switchToTab(): Promise<void> {
    return switchToGraderTab(this.page);
  }

  /**
   * Switch between the "Grading Setup" and "Rubric" sub-tabs. Every mutating
   * helper below (`saveConfig`, `addCriterion`, `editCriterion`,
   * `deleteCriterion`, `expectLastCriterionDeleteDisabled`,
   * `expectTotalPoints`) already does this internally — call it directly
   * only for a standalone visibility/navigation check.
   */
  switchToSubTab(subTab: GraderSubTab): Promise<void> {
    return switchToGraderSubTab(this.page, subTab);
  }

  /** "Grader" heading at the top of the tab panel — same string as `GRADER_LABELS.tabName`. */
  get heading(): Locator {
    return this.dialog.getByRole('heading', {
      name: GRADER_LABELS.tabName,
      exact: true,
    });
  }

  /** Description line below the heading — see `UNEXPORTED_LABELS` doc. */
  get description(): Locator {
    return this.dialog.getByText(
      GraderTab.UNEXPORTED_LABELS.header.description,
      { exact: true },
    );
  }

  /**
   * Whether the Results sub-tab pill is currently rendered. Gated on the
   * `view_grade_results` RBAC action (see class doc) — CONFIRMED live
   * against the real e2e tenant that this action is NOT granted to the e2e
   * admin even though `read_grader_config`/`view_grader_criteria` are (the
   * Grading Setup and Rubric pills reliably render; Results does not).
   * Bounded `waitFor` + catch rather than `isVisible` (see this repo's
   * anti-pattern guidance) so callers get a real wait, not a snapshot.
   */
  async isResultsSubTabVisible(): Promise<boolean> {
    try {
      await this.resultsSubTab.waitFor({ state: 'visible', timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  // ── Capability gate ───────────────────────────────────────────────────────

  /** Whether the "Grading" toggle is currently on. */
  isGradingEnabled(): Promise<boolean> {
    return isGradingEnabled(this.page);
  }

  /**
   * Idempotently sets Grading OFF (or ON in the common case where the tool
   * is known to be available). Delegates straight to the SDK helper, which
   * waits for the relevant toast + the gated content's `data-enabled`. A
   * thrown error here is a genuine failure — use `tryEnableGrading` instead
   * when the tenant's tool catalogue availability is unknown/untrusted.
   */
  setGradingEnabled(enabled: boolean): Promise<void> {
    return setGradingEnabled(this.page, enabled);
  }

  /**
   * Attempts to turn Grading ON, tolerating a tenant whose tool catalogue
   * has no "Grading" tool to attach. Returns `true` once the toggle and its
   * gated-content wrapper confirm the ON state, `false` if the `toggleError`
   * toast fired instead. Races the success/error toasts directly (rather
   * than calling the SDK's `setGradingEnabled`, which only waits on the
   * success toast and would otherwise burn its full timeout before this
   * could report failure) — see class doc.
   */
  async tryEnableGrading(): Promise<boolean> {
    const body = graderTabBody(this.page);
    const toggle = body.getByTestId('grader-capability-toggle');
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    if (await isGradingEnabled(this.page)) return true;

    await expect(toggle).toBeEnabled({ timeout: 10_000 });
    await toggle.click();

    const successToast = this.page
      .getByText(GRADER_LABELS.toasts.toggleOn)
      .first();
    const errorToast = this.page
      .getByText(GraderTab.UNEXPORTED_LABELS.toasts.toggleError)
      .first();

    // Both waits are raced below, but Promise.race never cancels the loser —
    // it keeps polling in the background until ITS OWN 15s timeout elapses,
    // then rejects. A live run caught the fallout directly: on every test
    // where the toggle succeeds (the common case), `errorWait` is always the
    // loser, and its rejection ~12s later had no `.catch` anywhere, making it
    // an unhandled promise rejection in the single long-lived worker process
    // this whole serial file runs in. That measurably destabilized LATER,
    // unrelated actions in the same file — e.g. a Save button observed stuck
    // non-actionable for a full 30s several tests afterward, traced back via
    // trace.zip timing to line up with one of these unhandled rejections.
    // Attaching a no-op `.catch` directly to each branch marks it "handled"
    // for Node's purposes regardless of which one loses the race.
    const successWait = successToast
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'ok' as const);
    const errorWait = errorToast
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'error' as const);
    successWait.catch(() => {});
    errorWait.catch(() => {});

    const outcome = await Promise.race([successWait, errorWait]).catch(
      () => 'timeout' as const,
    );

    if (outcome !== 'ok') return false;

    await expect(toggle).toHaveAttribute('aria-checked', 'true', {
      timeout: 10_000,
    });
    await expect(body.getByTestId('capability-gate-content')).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );
    return true;
  }

  /** Assert whether the CapabilityGate off-state hint is currently shown. */
  async expectOffHintVisible(visible: boolean): Promise<void> {
    if (visible) {
      await expect(this.capabilityOffHint).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(this.capabilityOffHint).toHaveCount(0, { timeout: 10_000 });
    }
  }

  // ── Grading-setup config form ────────────────────────────────────────────

  /**
   * Fills and persists the grading-setup form (switches to the "Grading
   * setup" sub-tab first; only the provided fields are changed) via the SDK
   * helper. Completion is gated on the Save button returning to disabled
   * once the config POST/PATCH resolves and the form rehydrates from the
   * server copy.
   */
  saveConfig(values: {
    instructions?: string;
    gradingMode?: GraderGradingMode;
    feedbackMode?: GraderFeedbackMode;
  }): Promise<void> {
    return saveGraderConfig(this.page, values);
  }

  /** Assert whether the misconfigured-warning banner is shown. */
  expectMisconfiguredWarning(visible: boolean): Promise<void> {
    return expectGraderMisconfiguredWarning(this.page, visible);
  }

  /** Assert the rubric's live "Total possible points: N" readout (switches to the Rubric sub-tab first). */
  expectTotalPoints(total: number): Promise<void> {
    return expectGraderTotalPoints(this.page, total);
  }

  // ── Rubric criteria ──────────────────────────────────────────────────────

  /** Adds a rubric criterion through the Add-criterion modal (switches to the Rubric sub-tab first). */
  addCriterion(criterion: GraderCriterionInput): Promise<void> {
    return addGraderCriterion(this.page, criterion);
  }

  /**
   * Edits an existing rubric criterion via its row's three-dots menu → Edit
   * modal (switches to the Rubric sub-tab first). `GraderCriterionInput`
   * requires all three fields (mirrors the SDK helper, which always
   * rewrites name/criteria/points together) — pass the unchanged values
   * alongside whichever field is actually being updated.
   */
  editCriterion(
    currentName: string,
    updates: GraderCriterionInput,
  ): Promise<void> {
    return editGraderCriterion(this.page, currentName, updates);
  }

  /** Deletes a rubric criterion via its row's three-dots menu → confirm modal → Delete. */
  deleteCriterion(name: string): Promise<void> {
    return deleteGraderCriterion(this.page, name);
  }

  /**
   * Asserts the given (last remaining) criterion's Delete menu action is
   * disabled and the explanatory hint is shown. Switches to the Rubric
   * sub-tab, opens the row's actions menu, checks the "Delete" menuitem's
   * `aria-disabled`, then closes the menu again — all handled by the SDK
   * helper.
   */
  expectLastCriterionDeleteDisabled(name: string): Promise<void> {
    return expectLastCriterionDeleteDisabled(this.page, name);
  }

  /**
   * Locates a criterion row by its visible name on the Rubric sub-tab.
   * Re-implements the SDK helpers' own internal (unexported) `criterionRow`
   * query — needed for the cancel-delete flow and row-count checks, neither
   * of which has a dedicated exported helper. Switches to the Rubric
   * sub-tab first (its `TabsContent` isn't `forceMount`ed, so the row simply
   * isn't in the DOM at all while the Grading setup sub-tab is active).
   */
  async criterionRowByName(name: string): Promise<Locator> {
    await switchToGraderSubTab(this.page, 'rubric');
    return graderTabBody(this.page)
      .getByTestId('grader-criteria-section')
      .locator('[data-testid^="grader-criterion-row-"]')
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /** Number of criterion rows currently rendered (switches to the Rubric sub-tab first). */
  async criterionCount(): Promise<number> {
    await switchToGraderSubTab(this.page, 'rubric');
    return graderTabBody(this.page)
      .getByTestId('grader-criteria-section')
      .locator('[data-testid^="grader-criterion-row-"]')
      .count();
  }

  /**
   * Opens the delete-confirmation modal for `name` (via its row's
   * three-dots menu → Delete) and clicks Cancel instead of confirming. No
   * SDK helper covers the cancel path (only the confirm path, via
   * `deleteGraderCriterion`). The menu trigger's aria-label comes from
   * `GRADER_LABELS.menu.actionsAria(name)`; the modal's Cancel button is
   * matched by `GRADER_LABELS.modal.cancel` (shared with the add/edit
   * criterion modal) scoped to the delete modal's own testid so it can't be
   * confused with any other open dialog's Cancel button.
   */
  async cancelDeleteCriterion(name: string): Promise<void> {
    await switchToGraderSubTab(this.page, 'rubric');

    const row = await this.criterionRowByName(name);
    const trigger = row.getByRole('button', {
      name: GRADER_LABELS.menu.actionsAria(name),
    });
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const deleteItem = this.page.getByRole('menuitem', {
      name: GRADER_LABELS.menu.delete,
      exact: true,
    });
    await expect(deleteItem).toBeVisible({ timeout: 10_000 });
    await deleteItem.click();

    const modal = this.page.getByTestId('grader-criterion-delete-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal
      .getByRole('button', { name: GRADER_LABELS.modal.cancel, exact: true })
      .click();
    await expect(modal).toBeHidden({ timeout: 10_000 });

    await expect(row).toBeVisible({ timeout: 5_000 });
  }

  // ── Results (grade results table) ────────────────────────────────────────

  /** The Results sub-tab's section container. Switches to the sub-tab first (mirrors `criteriaSection` internally). */
  async resultsSection(): Promise<Locator> {
    await switchToGraderSubTab(this.page, 'results');
    return graderTabBody(this.page).getByTestId('grader-results-section');
  }

  /**
   * Asserts the Results table's empty state, distinguishing the
   * zero-filters copy ("No grades yet…") from the filtered-to-zero copy
   * ("No grades match the current filters…") — neither string is exported
   * by `GRADER_LABELS`, see `UNEXPORTED_LABELS.results`.
   */
  async expectResultsEmpty(opts: { filtered: boolean }): Promise<void> {
    const section = await this.resultsSection();
    const text = opts.filtered
      ? GraderTab.UNEXPORTED_LABELS.results.emptyFiltered
      : GraderTab.UNEXPORTED_LABELS.results.emptyState;
    await expect(section.getByText(text, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Filters the grade-results list by learner email (switches to the Results sub-tab first; debounced, gated on the matching row rendering). */
  filterResultsByEmail(email: string): Promise<void> {
    return filterGradeResultsByEmail(this.page, email);
  }

  /** Asserts a grade-result row for the given learner email is visible (switches to the Results sub-tab first). */
  expectResultRow(email: string): Promise<void> {
    return expectGradeResultRow(this.page, email);
  }

  /**
   * Overrides a learner's grade via their row's Override button → modal
   * (switches to the Results sub-tab first). Points are in rubric points (0
   * to the rubric's total, enforced client-side by the modal).
   */
  overrideResult(
    email: string,
    values: { points: number; feedback?: string },
  ): Promise<void> {
    return overrideGradeResult(this.page, email, values);
  }

  /** Clears a learner's grade override via the modal, restoring the AI score (switches to the Results sub-tab first). */
  clearResultOverride(email: string): Promise<void> {
    return clearGradeResultOverride(this.page, email);
  }
}
