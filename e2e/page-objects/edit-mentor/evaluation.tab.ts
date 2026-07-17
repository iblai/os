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
  createBenchmark,
  getBenchmarkItemsDialog,
  openBenchmarkItems,
  expectQaItemListed,
  getAddItemsDialog,
  openAddItemsDialog,
  addQaPairsManually,
  closeBenchmarkItemsDialog,
  closeManageBenchmarksDialog,
  type EvalRunStatus,
} from '@iblai/iblai-js/playwright';

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

  /** Default labels shipped with the SDK — handy for exact-text assertions. */
  static readonly LABELS = EVALS_LABELS;

  /**
   * `AGENT_EVALUATION_TAB_LABELS.actions.notReadyHint` from the tab's
   * `labels.ts` ("Available once the evaluation completes") — the native
   * `title` tooltip on the View results / New review / Export CSV row
   * actions while a run hasn't completed yet. Not re-exported by the SDK's
   * `EVALS_LABELS` helper constant (no exported helper asserts on it
   * directly), so it's hardcoded here against the component source.
   */
  static readonly NOT_READY_HINT = 'Available once the evaluation completes';

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

  /** Column header locator — tries the semantic `columnheader` role first, falls back to plain text. */
  tableHeader(name: string): Locator {
    return this.dialog
      .getByRole('columnheader', { name, exact: true })
      .or(this.dialog.getByText(name, { exact: true }));
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
    const text = (await cell.innerText()).trim();
    if (
      text === 'COMPLETED' ||
      text === 'FAILED' ||
      text === 'PENDING' ||
      text === 'IN_PROGRESS'
    ) {
      return text;
    }
    throw new Error(`Unexpected run status text for "${runName}": "${text}"`);
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
  // LLM-judge ("New review" / "Evaluate") dialog
  // ---------------------------------------------------------------------------

  llmJudgeDialog(): Locator {
    return getLlmJudgeDialog(this.dialog);
  }

  cancelLlmJudge(): Promise<void> {
    return cancelLlmJudge(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Evaluation detail ("View results") dialog
  // ---------------------------------------------------------------------------

  evaluationDetailDialog(): Locator {
    return getEvaluationDetailDialog(this.dialog);
  }

  closeEvaluationDetailDialog(): Promise<void> {
    return closeEvaluationDetailDialog(this.dialog);
  }

  // ---------------------------------------------------------------------------
  // Manage benchmarks (embedded tenant Benchmarks) dialog
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

  createBenchmark(opts: { name: string; description?: string }): Promise<void> {
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
  // Utilities
  // ---------------------------------------------------------------------------

  /** A benchmark/run name unlikely to collide across parallel workers or retries. */
  static uniqueName(prefix: string): string {
    return `${prefix}-${Date.now()}`;
  }
}
