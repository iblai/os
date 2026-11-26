import { Page, Locator, Response, expect } from '@playwright/test';
import {
  GRADER_LABELS,
  graderTabBody,
  isGraderTabVisible,
  switchToGraderTab,
  switchToGraderSubTab,
  isGradingEnabled,
  setGradingEnabled,
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
  type GraderCriterionInput,
} from '@iblai/iblai-js/playwright';

const SETUP_PATH = '/grader-config/';
const RUBRIC_PATH = '/grader-config/criteria/';

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
 * `addGraderCriterion` / `editGraderCriterion` /
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
 * Voice / Screen / Memory / Privacy / LTI. It saves the `capability_grading`
 * flag on the agent's settings (one PUT per click, no Save button). While
 * the rubric the tab has read is empty the switch is locked, with the reason
 * in a `capability-gate-reason` line under the banner.
 *
 * IMPORTANT — model dependency: when the agent's model cannot grade, the
 * switch is locked the same way with the model's reason; `tryEnableGrading`
 * then returns `false` without clicking. When the app cannot tell in advance
 * (the agent's tool list is unreadable) the click goes through, the platform
 * refuses the save, the switch reverts and the gate shows an inline
 * `capability-gate-error` line (no toast); `tryEnableGrading` reads that
 * refusal off the save's own response and returns `false`. The OFF direction
 * never refuses, so `setGradingEnabled` treats a failed save as a genuine
 * bug and throws.
 *
 * ── Lesson Completion row ──────────────────────────────────────────────────
 * A second switch (`capability-toggle-lesson-completion`) sits in a box above
 * the gated content, so it stays usable while Grading is off. It saves
 * `capability_lesson_completion` on the click and toasts
 * "Lesson Completion turned on" / "Lesson Completion turned off".
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
   * the RBAC-aware rebuild: the header description is byte-for-byte unchanged; the two warning strings picked up minor
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
    warnings: {
      // `noConfig` is only a transient flash on a fresh mentor: attaching
      // the Grading tool auto-provisions the config row and useGrader
      // refetches it right after the toggle succeeds, so the settled
      // post-enable wording is `noCriteria` (journey 66 GRD-06).
      noConfig: /not set up yet/i,
      noCriteria: /rubric is empty/i,
    },
    capability: {
      needsCriterion:
        'Add at least one rubric criterion first, then turn Grading on.',
    },
    deleteModal: {
      title: 'Delete Criterion',
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
  /** Inline line the gate shows under its banner after a refused Grading save. */
  readonly capabilityError: Locator;
  /** Lesson Completion row and its switch (rendered above the gated content). */
  readonly lessonCompletionRow: Locator;
  readonly lessonCompletionToggle: Locator;
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
    this.capabilityError = dialog.getByTestId('capability-gate-error');
    this.lessonCompletionRow = dialog.getByTestId(
      'capability-row-lesson-completion',
    );
    this.lessonCompletionToggle = dialog.getByTestId(
      'capability-toggle-lesson-completion',
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

  /**
   * Waits for the tab's first read to finish. On an agent with no grading
   * setup that read is a 404 the app retries for several seconds, which can
   * outlast the 10s the SDK helpers give the sub-tabs to appear.
   */
  async waitUntilLoaded(): Promise<void> {
    await expect(this.body()).toBeVisible({ timeout: 30_000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout: 30_000 });
  }

  /**
   * Switches the dialog to one of its sidebar tabs (each is rendered twice,
   * desktop and compact, with one visible). The switch is a page navigation,
   * and on `next dev` a hot update that lands while it is pending drops it,
   * so the click repeats until the tab is the active one.
   */
  private async openSidebarTab(name: string): Promise<void> {
    const tab = this.dialog
      .getByRole('tab', { name, exact: true })
      .and(this.dialog.locator('[aria-controls^="panel-"]:visible'));
    await expect(async () => {
      await tab.click();
      await expect(tab).toHaveAttribute('data-state', 'active', {
        timeout: 10_000,
      });
    }).toPass({ timeout: 60_000 });
  }

  /** The settings save that carries `field`. Call it before the click that saves. */
  private settingsSave(field: string): Promise<Response> {
    return this.page.waitForResponse(
      (res) =>
        ['PUT', 'PATCH'].includes(res.request().method()) &&
        (res.request().postData() ?? '').includes(field),
      { timeout: 30_000 },
    );
  }

  /**
   * The toast an action is about to show. One left by an earlier action with
   * the same words would satisfy the wait for it, so that one has to go first.
   */
  private async freshToast(text: string): Promise<Locator> {
    const toast = this.page.getByText(text, { exact: true });
    await expect(toast).toHaveCount(0, { timeout: 15_000 });
    return toast;
  }

  /** Whether the Grader tab is currently rendered in the Edit Agent dialog. */
  isTabVisible(): Promise<boolean> {
    return isGraderTabVisible(this.page);
  }

  /**
   * Switch to the Grader tab directly via the SDK helper. NOTE: this does
   * NOT switch the host app's own "Setup" category strip first —
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
   * Idempotently sets Grading OFF (or ON when the agent is known to be able
   * to grade) and waits for the settings save to succeed. A failure here is
   * a genuine one — use `tryEnableGrading` when the model may not grade.
   */
  async setGradingEnabled(enabled: boolean): Promise<void> {
    if ((await this.isGradingEnabled()) === enabled) return;
    // The SDK helper accepts the first toast with these words that it finds.
    await this.freshToast(
      enabled ? GRADER_LABELS.toasts.toggleOn : GRADER_LABELS.toasts.toggleOff,
    );
    const [save] = await Promise.all([
      this.settingsSave('capability_grading'),
      setGradingEnabled(this.page, enabled),
    ]);
    expect(save.ok(), `Grading save answered ${save.status()}`).toBe(true);
  }

  /**
   * Attempts to turn Grading ON, tolerating an agent whose model cannot
   * grade. Returns `true` once the save succeeded and the toggle and its
   * gated content show the ON state, `false` if the switch is locked because
   * of the model or the platform refused the save.
   */
  async tryEnableGrading(): Promise<boolean> {
    const body = this.body();
    const toggle = body.getByTestId('grader-capability-toggle');
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    if (await isGradingEnabled(this.page)) return true;

    const reason = body.getByTestId('capability-gate-reason');
    if ((await toggle.isDisabled()) && (await reason.isVisible())) {
      // An empty rubric locks the switch too. That is a missing
      // prepareRubric(), never a model that cannot grade.
      await expect(reason).not.toHaveText(
        GraderTab.UNEXPORTED_LABELS.capability.needsCriterion,
      );
      return false;
    }

    await expect(toggle).toBeEnabled({ timeout: 10_000 });
    const toast = await this.freshToast(GRADER_LABELS.toasts.toggleOn);
    // Enabling re-reads the setup right after the settings save, and that
    // response resets the form: edits made before it lands are wiped.
    const reread = this.page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        new URL(res.url()).pathname.endsWith(SETUP_PATH),
      { timeout: 15_000 },
    );
    reread.catch(() => {});
    const [save] = await Promise.all([
      this.settingsSave('capability_grading'),
      toggle.click(),
    ]);

    if (save.status() >= 400 && save.status() < 500) {
      await expect(body.getByTestId('capability-gate-error')).toBeVisible({
        timeout: 15_000,
      });
      return false;
    }
    expect(save.ok(), `Grading save answered ${save.status()}`).toBe(true);

    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'true', {
      timeout: 10_000,
    });
    await expect(body.getByTestId('capability-gate-content')).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );
    await reread.catch(() => {});
    return true;
  }

  /**
   * Leaves the tab with a saved grading setup and one rubric criterion
   * ("Clarity", 10 points), which the Grading switch needs before it can be
   * turned on. For an agent that has no grading setup yet.
   */
  async prepareRubric(): Promise<void> {
    await this.saveConfig({
      instructions: 'E2E: grade for clarity and correctness.',
    });
    await this.addCriterion({
      name: 'Clarity',
      criteria: 'The argument is easy to follow.',
      points: 10,
    });
  }

  /** The Grading switch is locked and the gate says a rubric criterion comes first. */
  async expectEnableLockedUntilCriterion(): Promise<void> {
    const body = this.body();
    await expect(body.getByTestId('grader-capability-toggle')).toBeDisabled({
      timeout: 10_000,
    });
    await expect(body.getByTestId('capability-gate-reason')).toHaveText(
      GraderTab.UNEXPORTED_LABELS.capability.needsCriterion,
      { timeout: 10_000 },
    );
  }

  /** Whether the Lesson Completion switch is currently on. */
  async isLessonCompletionEnabled(): Promise<boolean> {
    await expect(this.lessonCompletionToggle).toBeVisible({ timeout: 10_000 });
    return (
      (await this.lessonCompletionToggle.getAttribute('aria-checked')) ===
      'true'
    );
  }

  /**
   * Sets the Lesson Completion switch and waits for the save: the settings
   * PUT that carries `capability_lesson_completion` and the toast. Returns the
   * PUT body, or null when the switch already had the target state.
   */
  async setLessonCompletionEnabled(target: boolean): Promise<string | null> {
    if ((await this.isLessonCompletionEnabled()) === target) return null;
    await expect(this.lessonCompletionToggle).toBeEnabled({ timeout: 10_000 });
    const toast = await this.freshToast(
      `Lesson Completion turned ${target ? 'on' : 'off'}`,
    );
    const [save] = await Promise.all([
      this.settingsSave('capability_lesson_completion'),
      this.lessonCompletionToggle.click(),
    ]);
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(this.lessonCompletionToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 10_000 },
    );
    return save.request().postData() ?? '';
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
   * Fills the instructions on the "Grading Setup" sub-tab, saves, and waits
   * for the save to succeed. After an agent's first save it also waits until
   * the tab shows the saved setup, so a criterion can be added straight away.
   */
  async saveConfig(values: { instructions: string }): Promise<void> {
    await this.waitUntilLoaded();
    await switchToGraderSubTab(this.page, 'setup');
    const instructions = this.body().getByTestId(
      'grader-instructions-textarea',
    );
    const saveButton = this.body().getByTestId('grader-save-button');
    await instructions.fill(values.instructions);
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });

    // Counted from before the save: the rubric's last retry can answer 200
    // in the moment after it, and is not requested again once it has.
    const read = { setup: false, rubric: false };
    const noteRead = (res: Response) => {
      if (res.request().method() !== 'GET' || res.status() !== 200) return;
      const { pathname } = new URL(res.url());
      if (pathname.endsWith(RUBRIC_PATH)) read.rubric = true;
      else if (pathname.endsWith(SETUP_PATH)) read.setup = true;
    };
    this.page.on('response', noteRead);
    try {
      // The SDK's saveGraderConfig waits for the Save button to go disabled.
      // On an agent's first save that lasts only while the request is in
      // flight, too short to catch reliably, so the save is judged by its
      // own response.
      const [save] = await Promise.all([
        this.page.waitForResponse(
          (res) =>
            ['POST', 'PATCH'].includes(res.request().method()) &&
            new URL(res.url()).pathname.endsWith(SETUP_PATH),
          { timeout: 30_000 },
        ),
        saveButton.click(),
      ]);
      expect(save.ok(), `Grading setup save answered ${save.status()}`).toBe(
        true,
      );
      if (save.request().method() !== 'POST') return;

      // Works around the SDK (@iblai/iblai-js 3.0.0 to 3.1.0) not re-reading
      // the setup and rubric after an agent's first save, which leaves Add
      // Criterion disabled: leaving the tab and coming back makes it read
      // them. Remove once the SDK re-reads them itself.
      await this.openSidebarTab('Settings');
      await expect(this.body()).toBeHidden({ timeout: 10_000 });
      await this.openSidebarTab(GRADER_LABELS.tabName);
      await this.waitUntilLoaded();
      await expect
        .poll(() => read.setup && read.rubric, {
          message: 'the tab re-reads the saved setup and the rubric',
          timeout: 30_000,
        })
        .toBe(true);
      await expect(instructions).toHaveValue(values.instructions, {
        timeout: 10_000,
      });
    } finally {
      this.page.off('response', noteRead);
    }
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
   * Opens the delete confirmation for `name` (its row's three-dots menu →
   * Delete) and clicks Cancel instead of confirming. No SDK helper covers the
   * cancel path. The open menu is named after its trigger and the
   * confirmation by its title, so both are resolved by role and name before
   * anything inside them is touched.
   */
  async cancelDeleteCriterion(name: string): Promise<void> {
    const row = await this.criterionRowByName(name);
    const actions = GRADER_LABELS.menu.actionsAria(name);
    await row.getByRole('button', { name: actions, exact: true }).click();

    const menu = this.page.getByRole('menu', { name: actions, exact: true });
    await menu
      .getByRole('menuitem', { name: GRADER_LABELS.menu.delete, exact: true })
      .click();

    const confirmation = this.page.getByRole('dialog', {
      name: GraderTab.UNEXPORTED_LABELS.deleteModal.title,
      exact: true,
    });
    await expect(confirmation).toBeVisible({ timeout: 10_000 });
    await confirmation
      .getByRole('button', { name: GRADER_LABELS.modal.cancel, exact: true })
      .click();
    await expect(confirmation).toBeHidden({ timeout: 10_000 });

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
