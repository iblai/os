import { Page, Locator, expect } from '@playwright/test';
import {
  EVALS_LABELS,
  isEvaluationTabVisible,
  switchToEvaluationTab,
  getBenchmarkCombobox,
  getBenchmarkComboboxDropdown,
  getNewEvaluationButton,
  getManageBenchmarksButton,
  expectSelectedBenchmark,
  selectBenchmark,
  expectNoBenchmarksNotice,
  getNoQaPrompt,
  expectBenchmarkNeedsQa,
  openAddQaFromEvalsTab,
  getRunRow,
  expectRunInTable,
  expectRunNotInTable,
  expectRunStatus,
  expectRunsTableEmpty,
  openRunActionsMenu,
  openRunResults,
  openNewReviewForRun,
  checkRunStatus,
  exportRunCsv,
  getStartEvaluationDialog,
  openStartEvaluationDialog,
  startEvaluation,
  cancelStartEvaluation,
  getDeleteEvaluationDialog,
  deleteEvaluation,
  cancelDeleteEvaluation,
  getLlmJudgeDialog,
  cancelLlmJudge,
  getEvaluationDetailDialog,
  closeEvaluationDetailDialog,
  openManageBenchmarksDialog,
  searchBenchmarks,
  expectBenchmarkListed,
  getCreateBenchmarkDialog,
  openCreateBenchmarkDialog,
  goToBenchmarkQaStep,
  createBenchmark,
  getBenchmarkItemsDialog,
  openBenchmarkItems,
  expectQaItemListed,
  expectBenchmarkItemsEmpty,
  getAddItemsDialog,
  openAddItemsDialog,
  addQaPairsManually,
  deleteQaItem,
  closeBenchmarkItemsDialog,
  closeManageBenchmarksDialog,
  type EvalRunStatus,
} from '@iblai/iblai-js/playwright';
import { ActivityPhoneView } from './activity-phone';

/**
 * Page object for the "Evals" tab inside the Edit Mentor modal.
 *
 * The tab body is rendered by the packaged `AgentEvaluationTab` from
 * `@iblai/iblai-js/web-containers/next` (see
 * `components/modals/edit-mentor-modal/tabs/evaluation-tab/index.tsx`),
 * wrapped locally with `AgentSettingsProvider` + `IblPagination`. The local
 * wrapper passes no `labels` override, so the tab renders the SDK's default
 * `AGENT_EVALUATION_TAB_LABELS` strings verbatim.
 *
 * Every method below thin-delegates to the dedicated eval-tab Playwright
 * helpers re-exported from `@iblai/iblai-js/playwright` (mirrors the
 * `VoiceTab` / `TasksTab` page objects) so label or DOM changes upstream are
 * picked up with a single `@iblai/iblai-js` bump rather than by editing
 * selectors here. Every helper call is scoped to this tab's parent `dialog`
 * Locator, never the bare `page` — dialogs spawned from this tab are
 * resolved by the helpers via a page-level `[aria-label]` attribute query
 * regardless of the scope passed in (they're Radix portals rendered outside
 * the Edit Agent dialog subtree), so passing `dialog` here purely supplies
 * `.page()`; toolbar-level locators (combobox, buttons) genuinely scope to
 * the dialog subtree.
 */
export class EvaluationTab {
  readonly page: Page;
  readonly dialog: Locator;
  readonly phone: ActivityPhoneView;

  /** Default labels shipped with the SDK — handy for exact-text assertions. */
  static readonly LABELS = EVALS_LABELS;

  /**
   * Why View Results / New Review / Export CSV are off until a run completes.
   * It is each disabled item's accessible description (and its hover text,
   * shown by the SDK tooltip on the wrapper around the item).
   */
  static readonly NOT_READY_HINT = EVALS_LABELS.actions.notReadyHint;

  /** The reason the same three items stay off for a run that failed. */
  static readonly FAILED_HINT = EVALS_LABELS.actions.failedHint;

  /** Canonical runs-table column headers (index.tsx `table.*Column` labels — also not re-exported by `EVALS_LABELS`). */
  static readonly TABLE_HEADERS = [
    'EVALUATION',
    'STATUS',
    'INITIATED BY',
    'CREATED',
    'ACTIONS',
  ] as const;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.phone = new ActivityPhoneView(page, dialog);
  }

  // ---------------------------------------------------------------------------
  // Tab navigation
  // ---------------------------------------------------------------------------

  /** True when the Evals tab is rendered (permission-gated tab guard — ADMIN-only). */
  isTabVisible(): Promise<boolean> {
    return isEvaluationTabVisible(this.page);
  }

  /** Click the Evals tab and wait for the toolbar to be interactive. */
  switchToTab(): Promise<void> {
    return switchToEvaluationTab(this.page);
  }

  // ---------------------------------------------------------------------------
  // Toolbar: benchmark picker + action buttons
  // ---------------------------------------------------------------------------

  benchmarkCombobox(): Locator {
    return getBenchmarkCombobox(this.dialog);
  }

  benchmarkComboboxDropdown(): Locator {
    return getBenchmarkComboboxDropdown(this.dialog);
  }

  newEvaluationButton(): Locator {
    return getNewEvaluationButton(this.dialog);
  }

  manageBenchmarksButton(): Locator {
    return getManageBenchmarksButton(this.dialog);
  }

  expectSelectedBenchmark(benchmarkName: string): Promise<void> {
    return expectSelectedBenchmark(this.dialog, benchmarkName);
  }

  selectBenchmark(
    benchmarkName: string,
    opts?: { search?: boolean },
  ): Promise<void> {
    return selectBenchmark(this.dialog, benchmarkName, opts);
  }

  expectNoBenchmarksNotice(): Promise<void> {
    return expectNoBenchmarksNotice(this.dialog);
  }

  /**
   * What the tab shows while the selected benchmark has no Q&A: the sentence
   * and the "Add Q&A" button, in the empty state or (when the benchmark has
   * evaluations) in the line above the runs table.
   */
  noQaPrompt(): Locator {
    return getNoQaPrompt(this.dialog);
  }

  /** The no-Q&A sentence and "Add Q&A" show, and New Evaluation is off with that sentence as its hover text. */
  expectBenchmarkNeedsQa(): Promise<void> {
    return expectBenchmarkNeedsQa(this.dialog);
  }

  /** Click the tab's own "Add Q&A" (no-Q&A state only); returns the Add Q&A dialog. */
  openAddQaFromTab(): Promise<Locator> {
    return openAddQaFromEvalsTab(this.dialog);
  }

  /** A column header of the runs table, by its exact name. */
  tableHeader(name: string): Locator {
    return this.dialog.getByRole('columnheader', { name, exact: true });
  }

  // ---------------------------------------------------------------------------
  // Runs table
  // ---------------------------------------------------------------------------

  runRow(runName: string): Locator {
    return getRunRow(this.dialog, runName);
  }

  expectRunInTable(runName: string): Promise<void> {
    return expectRunInTable(this.dialog, runName);
  }

  expectRunNotInTable(runName: string): Promise<void> {
    return expectRunNotInTable(this.dialog, runName);
  }

  expectRunStatus(runName: string, status: EvalRunStatus): Promise<void> {
    return expectRunStatus(this.dialog, runName, status);
  }

  expectRunsTableEmpty(benchmarkName: string): Promise<void> {
    return expectRunsTableEmpty(this.dialog, benchmarkName);
  }

  /**
   * Read a run row's CURRENT status by column position (Status is the 2nd
   * column). Positional indexing is used instead of a text-based lookup so
   * callers can safely branch on whichever status is actually showing —
   * evaluations run against the real backend, so completion timing is not
   * deterministic and tests must never assume a fixed outcome.
   */
  async readRunStatus(runName: string): Promise<EvalRunStatus> {
    const cell = this.runRow(runName).locator('td').nth(1);
    await expect(cell).toBeVisible({ timeout: 15_000 });
    // The icon is named by its translated word; the backend value sits in
    // `data-status` around it, and a run with no status yet has neither.
    const marker = cell.locator('[data-status]');
    const raw = (await marker.count())
      ? await marker.first().getAttribute('data-status')
      : null;
    const status = raw?.toUpperCase();
    if (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'PENDING' ||
      status === 'IN_PROGRESS'
    ) {
      return status;
    }
    throw new Error(
      `Unexpected run status for "${runName}": "${raw ?? 'none'}"`,
    );
  }

  openRunActionsMenu(runName: string): Promise<Locator> {
    return openRunActionsMenu(this.dialog, runName);
  }

  openRunResults(runName: string): Promise<Locator> {
    return openRunResults(this.dialog, runName);
  }

  openNewReviewForRun(runName: string): Promise<Locator> {
    return openNewReviewForRun(this.dialog, runName);
  }

  checkRunStatus(runName: string): Promise<'pending' | 'completed' | 'failed'> {
    return checkRunStatus(this.dialog, runName);
  }

  exportRunCsv(runName: string): Promise<string> {
    return exportRunCsv(this.dialog, runName);
  }

  // ---------------------------------------------------------------------------
  // Start evaluation dialog
  // ---------------------------------------------------------------------------

  startEvaluationDialog(): Locator {
    return getStartEvaluationDialog(this.dialog);
  }

  openStartEvaluationDialog(): Promise<Locator> {
    return openStartEvaluationDialog(this.dialog);
  }

  startEvaluation(opts?: { name?: string }): Promise<void> {
    return startEvaluation(this.dialog, opts);
  }

  cancelStartEvaluation(): Promise<void> {
    return cancelStartEvaluation(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Delete evaluation dialog
  // ---------------------------------------------------------------------------

  deleteEvaluationDialog(): Locator {
    return getDeleteEvaluationDialog(this.dialog);
  }

  deleteEvaluation(runName: string): Promise<void> {
    return deleteEvaluation(this.dialog, runName);
  }

  cancelDeleteEvaluation(runName: string): Promise<void> {
    return cancelDeleteEvaluation(this.dialog, runName);
  }

  // ---------------------------------------------------------------------------
  // New Review (LLM-judge) dialog
  // ---------------------------------------------------------------------------

  llmJudgeDialog(): Locator {
    return getLlmJudgeDialog(this.dialog);
  }

  cancelLlmJudge(): Promise<void> {
    return cancelLlmJudge(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Evaluation detail ("View Results") dialog
  // ---------------------------------------------------------------------------

  evaluationDetailDialog(): Locator {
    return getEvaluationDetailDialog(this.dialog);
  }

  /** Clicks the dialog's own Close button; an Escape can be dropped while the dialog refreshes itself. */
  closeEvaluationDetailDialog(): Promise<void> {
    return closeEvaluationDetailDialog(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Manage Benchmarks (embedded tenant Benchmarks) dialog
  // ---------------------------------------------------------------------------

  openManageBenchmarksDialog(): Promise<Locator> {
    return openManageBenchmarksDialog(this.dialog);
  }

  searchBenchmarks(query: string): Promise<void> {
    return searchBenchmarks(this.dialog, query);
  }

  expectBenchmarkListed(benchmarkName: string): Promise<void> {
    return expectBenchmarkListed(this.dialog, benchmarkName);
  }

  createBenchmarkDialog(): Locator {
    return getCreateBenchmarkDialog(this.dialog);
  }

  /** Click "New Benchmark" in the open Manage Benchmarks dialog; returns the New Benchmark dialog on its Details step. */
  openNewBenchmarkDialog(): Promise<Locator> {
    return openCreateBenchmarkDialog(this.dialog);
  }

  /** Click "Next" in the open New Benchmark dialog and wait for its Q&A step; returns the dialog. */
  goToBenchmarkQaStep(): Promise<Locator> {
    return goToBenchmarkQaStep(this.dialog);
  }

  /**
   * Goes through both steps of New Benchmark (Details, Next, Q&A, Create) and
   * waits for the toast that fits. Q&A is optional: without `qaPairs` the
   * benchmark is created with none, and the toast is the one that says to add
   * Q&A before running an evaluation.
   */
  createBenchmark(opts: {
    name: string;
    description?: string;
    qaPairs?: Array<{ question: string; answer?: string }>;
  }): Promise<void> {
    return createBenchmark(this.dialog, opts);
  }

  closeManageBenchmarksDialog(): Promise<void> {
    return closeManageBenchmarksDialog(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Benchmark items (Q&A) dialogs
  // ---------------------------------------------------------------------------

  benchmarkItemsDialog(): Locator {
    return getBenchmarkItemsDialog(this.dialog);
  }

  openBenchmarkItems(benchmarkName: string): Promise<Locator> {
    return openBenchmarkItems(this.dialog, benchmarkName);
  }

  expectQaItemListed(questionText: string): Promise<void> {
    return expectQaItemListed(this.dialog, questionText);
  }

  expectBenchmarkItemsEmpty(): Promise<void> {
    return expectBenchmarkItemsEmpty(this.dialog);
  }

  deleteQaItem(questionText: string): Promise<void> {
    return deleteQaItem(this.dialog, questionText);
  }

  addItemsDialog(): Locator {
    return getAddItemsDialog(this.dialog);
  }

  openAddItemsDialog(): Promise<Locator> {
    return openAddItemsDialog(this.dialog);
  }

  addQaPairsManually(
    pairs: Array<{ question: string; answer?: string }>,
  ): Promise<void> {
    return addQaPairsManually(this.dialog, pairs);
  }

  closeBenchmarkItemsDialog(): Promise<void> {
    return closeBenchmarkItemsDialog(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Phone view (< 768px): run cards, action sheet, benchmark sheet
  // ---------------------------------------------------------------------------

  /** A run card, matched by (a substring of) the run name. */
  phoneRunCard(runName: string): Locator {
    return this.dialog.getByRole('button').filter({ hasText: runName });
  }

  /** The action sheet a run card opens; titled with the run name. */
  phoneRunActionSheet(runName: string): Locator {
    return this.phone.sheet(runName);
  }

  async openPhoneRunActions(runName: string): Promise<Locator> {
    await this.phoneRunCard(runName).click();
    const sheet = this.phoneRunActionSheet(runName);
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    return sheet;
  }

  /** The benchmark picker opens a sheet titled with its placeholder. */
  phoneBenchmarkSheet(): Locator {
    return this.dialog.getByRole('dialog', {
      name: EVALS_LABELS.benchmarkPicker.placeholder,
      exact: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * A benchmark/run name unique per run and per worker (clock + parallel
   * index + random part). The index is read from the environment because
   * journeys build their names when the file loads, before `test.info()`
   * exists.
   */
  static uniqueName(prefix: string): string {
    const worker = process.env.TEST_PARALLEL_INDEX ?? '0';
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${Date.now()}-${worker}-${rand}`;
  }
}
