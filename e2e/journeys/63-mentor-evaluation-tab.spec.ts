import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { parsePlatformUrl } from '../utils/navigation';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EvaluationTab } from '../page-objects/edit-mentor/evaluation.tab';
import { PHONE_CONTEXT } from '../page-objects/edit-mentor/activity-phone';
import {
  expectNoAccessibilityViolationsOnDialogs,
  logger,
  waitForDialogReady,
} from '@iblai/iblai-js/playwright';

/**
 * `navigateToMentorApp`, wrapped with a single retry for a Next.js dev-server
 * client-side exception ("Application error: a client-side exception has
 * occurred...", the framework's default error-boundary fallback) on a cold
 * navigation. Observed directly on a live run: unrelated to any Evals-tab
 * state (the mentor's own settings are never touched by this journey), and
 * consistent with a dev-server HMR/chunk-loading hiccup under sustained
 * load rather than an app bug — a plain reload/re-navigate recovers. Scoped
 * to this journey rather than the shared `navigateToMentorApp` utility,
 * which every other journey also relies on.
 */
async function navigateToMentorAppWithRetry(
  page: Page,
  url?: string,
): Promise<void> {
  try {
    await navigateToMentorApp(page, url);
    return;
  } catch (err) {
    let hasErrorBoundary = false;
    try {
      await page
        .getByText(/application error/i)
        .waitFor({ state: 'visible', timeout: 2_000 });
      hasErrorBoundary = true;
    } catch {
      hasErrorBoundary = false;
    }
    if (!hasErrorBoundary) throw err;
    logger.warn(
      '[Journey 63] Client-side exception on navigation — retrying once.',
    );
    await navigateToMentorApp(page, url);
  }
}

/**
 * Journey 63 — Mentor Evaluation (Evals) Tab.
 *
 * The Evals tab is rendered by the packaged `AgentEvaluationTab` from
 * `@iblai/iblai-js/web-containers/next`, wrapped locally with
 * `AgentSettingsProvider` + `IblPagination` in
 * `components/modals/edit-mentor-modal/tabs/evaluation-tab/index.tsx`. It
 * exposes an "Evaluate an agent against a benchmark" flow plus an embedded
 * tenant Benchmarks manager, and is gated ADMIN-only in
 * `hooks/use-mentor-segments.ts`.
 *
 * All interactions go through the `EvaluationTab` page object, which
 * thin-delegates to the dedicated eval-tab helpers exported from
 * `@iblai/iblai-js/playwright` (mirrors the `VoiceTab` / `TasksTab` pattern
 * — see journeys 47 / 49).
 *
 * ── Shared state strategy ──────────────────────────────────────────────
 * Eval datasets ("benchmarks") are TENANT-scoped — shared across every
 * mentor and worker — so mutating one from a per-test throwaway mentor
 * would still race against any other worker touching the same tenant.
 * `test.describe.configure({ mode: 'serial' })` pins this whole file to a
 * single worker (mirrors journey 44's file-level serial isolation), and a
 * SINGLE dedicated mentor is created once in `beforeAll` (mirrors journey
 * 14's manual-context setup/teardown) rather than per test:
 *   - it keeps the suite from minting a mentor per checkpoint, and
 *   - it lets an evaluation run started early in the file (EVAL-08) pick up
 *     more wall-clock time before the later, completion-gated checkpoints
 *     (EVAL-11/EVAL-12). The real api.iblai.org backend's completion timing
 *     is not deterministic (a run may stay PENDING for a long time), so
 *     EVAL-11 asks with Check Status for up to three minutes and then skips
 *     with the outcome as the reason, and EVAL-12 skips unless the run has
 *     completed by then. No test in this file fails because a run did not
 *     complete.
 *   - the same wall-clock time also matters for EVAL-13's delete-confirm
 *     step: a run deleted only moments after it was started can 404
 *     against the delete endpoint even though it's already visible in the
 *     runs table (observed directly — the backend hadn't finished
 *     materializing it into the store that endpoint reads from), so
 *     EVAL-13 reuses the primary run rather than starting its own.
 * Two throwaway benchmarks are created per run, both in the New Benchmark
 * dialog (Details step, Next, Q&A step, Create):
 *   - the shared one, `e2e-eval-benchmark-<unique>`, in EVAL-03 with its
 *     first Q&A pair; every later checkpoint that needs a benchmark reuses
 *     it;
 *   - `e2e-eval-empty-benchmark-<unique>`, in EVAL-19 with a name alone
 *     (Q&A is optional in the dialog). A benchmark with no Q&A cannot be
 *     evaluated, and EVAL-19/EVAL-20/EVAL-22 walk that state on this one —
 *     created empty, given Q&A from the tab, emptied again — so the shared
 *     benchmark keeps its Q&A for the evaluation checkpoints.
 *
 * ── What a run leaves behind ───────────────────────────────────────────
 * Benchmarks cannot be deleted or renamed (the UI offers only "View Q&A",
 * see `packages/web-containers/.../profile/benchmarks/index.tsx`), so both
 * stay in the organization for good. That is why there are only two, with
 * throwaway names and descriptions: EVAL-21 walks the dialog's steps and
 * cancels, and EVAL-23 is refused on a name that is taken, so neither
 * creates one. The primary run is deleted by EVAL-13 and by nothing else:
 * when a checkpoint between EVAL-08 and EVAL-13 fails, serial mode skips
 * EVAL-13 and that run stays on its benchmark. The dedicated mentor is left
 * to the mentor sweeper (globalTeardown, once it is 30 minutes old); it is
 * never deleted here, since a worker may still be on it.
 *
 * ── The Manage Benchmarks list ─────────────────────────────────────────
 * It shows 10 benchmarks per page, newest first, and its search box filters
 * only the page showing. Every lookup of a benchmark in it therefore relies
 * on that benchmark still being among the organization's 10 newest, and
 * says so where it happens.
 *
 * ── SDK release ────────────────────────────────────────────────────────
 * The whole journey, not only the pending checkpoints, needs the
 * `@iblai/iblai-js` release that carries the evals changes (the first after
 * 2.73.1): the page object imports helpers and labels that release adds.
 * This file, the page object and the coverage docs land in the same commit
 * as that version bump, never before it.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Journey 63: Mentor Evaluation Tab', () => {
  let mentorId = '';
  let platformKey = '';
  let mentorUrl = '';
  let benchmarkReady = false;
  let emptyBenchmarkReady = false;
  let emptyBenchmarkHasQa = false;
  let emptyBenchmarkEmptied = false;
  let primaryRunName = '';
  let primaryRunCompleted = false;

  const BENCHMARK_NAME = EvaluationTab.uniqueName('e2e-eval-benchmark');
  const EMPTY_BENCHMARK_NAME = EvaluationTab.uniqueName(
    'e2e-eval-empty-benchmark',
  );
  const UNSAVED_BENCHMARK_NAME = EvaluationTab.uniqueName(
    'e2e-eval-unsaved-benchmark',
  );
  const QA_QUESTION = EvaluationTab.uniqueName('E2E eval question');
  const ADDED_QA_QUESTION = EvaluationTab.uniqueName('E2E eval added question');
  const TAB_ADDED_QA_QUESTION = EvaluationTab.uniqueName(
    'E2E eval tab-added question',
  );
  const DUPLICATE_NAME_QA_QUESTION = EvaluationTab.uniqueName(
    'E2E eval duplicate-name question',
  );
  const QA_ANSWER = 'E2E expected answer.';

  test.beforeAll(async ({ browser }, testInfo) => {
    // Mentor creation waits out its own category-list load (with a
    // close/reopen retry baked into CreateMentorPage under contention) on
    // top of the initial platform navigation, so it gets a longer timeout
    // than the default.
    testInfo.setTimeout(180_000);

    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const setupContext = await browser.newContext({ storageState: authFile });
    const setupPage = await setupContext.newPage();

    try {
      await navigateToMentorAppWithRetry(setupPage);
      const isAdmin = await checkAdminStatus(setupPage);
      if (!isAdmin) {
        logger.warn(
          '[Journey 63] Setup account is not admin; every Evals test will self-skip.',
        );
        return;
      }

      const createMentorPage = new CreateMentorPage(setupPage);
      await createMentorPage.openAndCreate(
        EvaluationTab.uniqueName('E2E Eval Mentor'),
      );

      const parsed = parsePlatformUrl(setupPage.url());
      platformKey = parsed.platformKey;
      mentorId = parsed.mentorId;
      mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;
      logger.info(`[Journey 63] Created dedicated eval mentor at ${mentorUrl}`);
    } finally {
      await setupPage.close();
      await setupContext.close();
    }
  });

  test.beforeEach(async ({ page, editMentorPage }) => {
    test.skip(!mentorUrl, 'Dedicated eval mentor was not created in beforeAll');

    await navigateToMentorAppWithRetry(page, mentorUrl);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Evals tab is admin-only');
      return;
    }

    await editMentorPage.open('Evals');
    await waitForPageReady(page);
    await waitForDialogReady(page, editMentorPage.dialog);
    await expect(
      editMentorPage.evaluation.manageBenchmarksButton(),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Once EVAL-03 has created the shared throwaway benchmark, every later
    // checkpoint should be looking at it rather than whatever the toolbar
    // auto-selects (index.tsx auto-selects `benchmarks[0]`, which is not
    // necessarily ours on a tenant that already has other benchmarks).
    // EVAL-20 and EVAL-22 then pick the benchmark created without Q&A.
    if (benchmarkReady) {
      await editMentorPage.evaluation.selectBenchmark(BENCHMARK_NAME);
    }
  });

  // EVAL-01: Tab heading, description, and the new info box all render.
  test('admin opens the Evals tab and sees the heading, description, and info box', async ({
    editMentorPage,
  }) => {
    const { dialog } = editMentorPage;

    const evalTab = dialog.getByRole('tab', {
      name: EvaluationTab.LABELS.tabName,
      exact: true,
    });
    await expect(evalTab).toHaveAttribute('data-state', 'active', {
      timeout: 10_000,
    });

    await expect(
      dialog.getByRole('heading', {
        name: EvaluationTab.LABELS.header.title,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByText(EvaluationTab.LABELS.header.description),
    ).toBeVisible({ timeout: 5_000 });

    const infoBox = dialog.getByTestId('evaluation-info-box');
    await expect(infoBox).toBeVisible({ timeout: 5_000 });
    expect((await infoBox.innerText()).trim().length).toBeGreaterThan(0);

    await editMentorPage.close();
  });

  // EVAL-02: Toolbar (benchmark combobox + New Evaluation + Manage
  // Benchmarks) renders, and New Evaluation is on exactly when the
  // auto-selected benchmark can be evaluated: off with "New Benchmark" on an
  // organization with no benchmarks, off with "Add Q&A" when the selected
  // benchmark has no Q&A, on otherwise.
  test('admin sees the benchmark combobox and both toolbar actions, and New Evaluation reflects whether the selected benchmark can be evaluated', async ({
    editMentorPage,
  }) => {
    const { evaluation } = editMentorPage;

    await expect(evaluation.benchmarkCombobox()).toBeVisible({
      timeout: 10_000,
    });
    await expect(evaluation.newEvaluationButton()).toBeVisible({
      timeout: 5_000,
    });
    await expect(evaluation.manageBenchmarksButton()).toBeVisible({
      timeout: 5_000,
    });

    // The tab auto-selects the organization's first benchmark, and which of
    // its three states that leaves it in is not ours to assume: no
    // benchmarks at all, a first benchmark without Q&A, or one that can be
    // evaluated. Wait for it to settle on one (none of them changes by
    // itself afterwards), then check that state in full.
    const newEvaluation = evaluation.newEvaluationButton();
    const noQaPrompt = evaluation.noQaPrompt();
    const noBenchmarks = editMentorPage.dialog.getByTestId(
      EvaluationTab.LABELS.noBenchmarksTestId,
    );
    const enabledNewEvaluation = newEvaluation.and(
      editMentorPage.dialog.locator(':enabled'),
    );
    await expect(
      noBenchmarks.or(noQaPrompt).or(enabledNewEvaluation),
    ).toBeVisible({ timeout: 30_000 });

    if ((await noBenchmarks.count()) > 0) {
      await expect(newEvaluation).toBeDisabled();
      await evaluation.expectNoBenchmarksNotice();
    } else if ((await noQaPrompt.count()) > 0) {
      await evaluation.expectBenchmarkNeedsQa();
    } else {
      await expect(newEvaluation).toBeEnabled();
    }

    await editMentorPage.close();
  });

  // EVAL-21: The New Benchmark dialog is two steps. Details (Name,
  // Description) ends in Next, which stays off, like the Q&A tab, until Name
  // has text, and refuses a name with a slash. The Q&A step says Q&A can
  // wait, so Create is on with a name alone, and turns off for a CSV file
  // that has no "input" column. Cancel there creates nothing.
  test('the New Benchmark dialog refuses a name with a slash, goes from Details to Q&A with Next, offers Create without any Q&A, refuses a CSV file with no "input" column, and Cancel creates nothing', async ({
    editMentorPage,
  }) => {
    const { evaluation } = editMentorPage;
    const labels = EvaluationTab.LABELS.createBenchmarkDialog;
    const qaForm = EvaluationTab.LABELS.addItemsDialog;

    const manageDialog = await evaluation.openManageBenchmarksDialog();
    const dialog = await evaluation.openNewBenchmarkDialog();

    const detailsTab = dialog.getByRole('tab', {
      name: labels.detailsTab,
      exact: true,
    });
    const qaTab = dialog.getByRole('tab', { name: labels.qaTab, exact: true });
    const name = dialog.getByLabel(labels.nameLabel, { exact: true });
    const next = dialog.getByRole('button', { name: labels.next, exact: true });
    const create = dialog.getByRole('button', {
      name: labels.create,
      exact: true,
    });
    const qaHint = dialog.getByTestId(labels.qaHintTestId);
    const fieldError = dialog.getByRole('alert');

    await expect(detailsTab).toHaveAttribute('data-state', 'active');
    await expect(qaTab).toBeDisabled();
    await expect(next).toBeDisabled();
    await expect(create).toBeHidden();

    await name.fill('e2e/invalid');
    await next.click();
    await expect(fieldError).toHaveText(labels.nameInvalid);
    await expect(detailsTab).toHaveAttribute('data-state', 'active');
    await expect(qaHint).toBeHidden();

    await name.fill(UNSAVED_BENCHMARK_NAME);
    await expect(fieldError).toHaveCount(0);
    await expect(qaTab).toBeEnabled();
    await expect(next).toBeEnabled();

    await evaluation.goToBenchmarkQaStep();
    // The Q&A step stays mounted while Details shows, so the note's text
    // alone would not prove it is on screen.
    await expect(qaHint).toBeVisible();
    await expect(qaHint).toHaveText(labels.qaHint);
    await expect(
      dialog.getByLabel(qaForm.questionLabel, { exact: true }),
    ).toBeFocused();
    await expect(next).toBeHidden();
    await expect(create).toBeEnabled();

    const csvTab = dialog.getByRole('tab', {
      name: qaForm.csvTab,
      exact: true,
    });
    await csvTab.click();
    await expect(csvTab).toHaveAttribute('data-state', 'active');
    await dialog
      .getByLabel(qaForm.csvFileLabel, { exact: true })
      .setInputFiles({
        name: 'no-input-column.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('question,answer\nq,a\n'),
      });
    await expect(fieldError).toHaveText(qaForm.csvNoInputColumn);
    await expect(create).toBeDisabled();

    await detailsTab.click();
    await expect(name).toHaveValue(UNSAVED_BENCHMARK_NAME);
    await expect(next).toBeEnabled();

    await dialog
      .getByRole('button', { name: labels.cancel, exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // The list is newest first and the search box filters only the page
    // showing: a benchmark created by mistake here would be on page 1.
    await evaluation.searchBenchmarks(UNSAVED_BENCHMARK_NAME);
    await expect(
      manageDialog.getByText(
        EvaluationTab.LABELS.manageBenchmarksDialog.empty,
        {
          exact: true,
        },
      ),
    ).toBeVisible();

    await evaluation.closeManageBenchmarksDialog();
    await editMentorPage.close();
  });

  // EVAL-03: Admin creates the shared throwaway benchmark, with its first
  // Q&A pair, in the New Benchmark dialog (Manage Benchmarks → New Benchmark:
  // Details, Next, a Manual row on the Q&A step, Create), and the Evals tab
  // selects it by itself with New Evaluation on.
  test('admin creates a benchmark with its Q&A in the New Benchmark dialog via Manage Benchmarks and the Evals tab selects it', async ({
    page,
    editMentorPage,
  }) => {
    const { evaluation } = editMentorPage;

    await evaluation.openManageBenchmarksDialog();

    // Capability guard: this backend's benchmark endpoints have been seen
    // answering 5xx in CI. Skip with the reason only when the create really
    // failed, so a request the app retried successfully still counts.
    const serverErrors: number[] = [];
    page.on('response', (response) => {
      if (
        response.url().includes('/evaluations/dataset') &&
        response.request().method() === 'POST' &&
        response.status() >= 500
      ) {
        serverErrors.push(response.status());
      }
    });

    // The helper also waits for the dialog to close, for the toast that
    // counts the one Q&A pair saved, and for the new row.
    try {
      await evaluation.createBenchmark({
        name: BENCHMARK_NAME,
        description: 'Throwaway benchmark created by e2e journey 63.',
        qaPairs: [{ question: QA_QUESTION, answer: QA_ANSWER }],
      });
    } catch (createError) {
      test.skip(
        serverErrors.length > 0,
        `benchmark endpoint returned ${serverErrors[0]} on this backend`,
      );
      throw createError;
    }

    await evaluation.closeManageBenchmarksDialog();

    // No picking it in the combobox: creating a benchmark selects it, and
    // the Q&A saved with it is what turns New Evaluation on.
    await evaluation.expectSelectedBenchmark(BENCHMARK_NAME);
    await expect(evaluation.newEvaluationButton()).toBeEnabled({
      timeout: 15_000,
    });
    benchmarkReady = true;

    await editMentorPage.close();
  });

  // EVAL-04: The Q&A pair typed in while creating the benchmark is listed in
  // its Q&A dialog (Manage Benchmarks → View Q&A) with its answer, under the
  // QUESTION / ANSWER / ACTIONS headers and a count, and admin can add
  // another pair from there (Add Q&A, Manual sub-tab), which raises the count.
  test("the benchmark's Q&A dialog lists the pair saved at creation with its answer and a count, and admin adds another pair there", async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    await evaluation.openManageBenchmarksDialog();
    // The list is newest first and the search box filters only the page
    // showing: the benchmark was created one checkpoint ago, so it is on
    // page 1.
    await evaluation.searchBenchmarks(BENCHMARK_NAME);
    await evaluation.expectBenchmarkListed(BENCHMARK_NAME);

    const items = await evaluation.openBenchmarkItems(BENCHMARK_NAME);
    await evaluation.expectQaItemListed(QA_QUESTION);
    await expect(items.getByText('1 Q&A pair', { exact: true })).toBeVisible();
    for (const column of EvaluationTab.LABELS.benchmarkItemsDialog.columns) {
      await expect(
        items.getByRole('columnheader', { name: column, exact: true }),
      ).toBeVisible();
    }
    // The row holds the answer twice (the copy under the question is for
    // phones), so it is read from the row's text, not looked up by itself.
    await expect(
      items.getByRole('row').filter({ hasText: QA_QUESTION }),
    ).toContainText(QA_ANSWER);

    await evaluation.openAddItemsDialog();
    await evaluation.addQaPairsManually([
      { question: ADDED_QA_QUESTION, answer: QA_ANSWER },
    ]);
    await evaluation.expectQaItemListed(ADDED_QA_QUESTION);
    await evaluation.expectQaItemListed(QA_QUESTION);
    await expect(items.getByText('2 Q&A pairs', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await evaluation.closeBenchmarkItemsDialog();
    await evaluation.closeManageBenchmarksDialog();

    await editMentorPage.close();
  });

  // EVAL-14: Manage Benchmarks (titled so) lists the created benchmark, and
  // searching for its name filters down to it.
  test('Manage Benchmarks lists the created benchmark and search filters to it', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    const manageDialog = await evaluation.openManageBenchmarksDialog();
    await expect(
      manageDialog.getByRole('heading', {
        name: EvaluationTab.LABELS.manageBenchmarksDialog.title,
        exact: true,
      }),
    ).toBeVisible();

    // The list is newest first, 10 per page, and the search box filters only
    // the page showing: this runs right after EVAL-03 and EVAL-04, so the
    // benchmark is on page 1.
    await evaluation.expectBenchmarkListed(BENCHMARK_NAME);

    await evaluation.searchBenchmarks(BENCHMARK_NAME);
    await evaluation.expectBenchmarkListed(BENCHMARK_NAME);

    await evaluation.closeManageBenchmarksDialog();
    await editMentorPage.close();
  });

  // EVAL-23: A name another benchmark already has is refused. The backend
  // answers a second create with the same name by updating the benchmark
  // that has it, so Create checks first: the dialog goes back to Details
  // with the reason under Name and the cursor in Name, and the Q&A typed in
  // never reaches the existing benchmark.
  test('the New Benchmark dialog refuses a name that another benchmark already has and leaves that benchmark as it was', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;
    const labels = EvaluationTab.LABELS.createBenchmarkDialog;

    await evaluation.openManageBenchmarksDialog();
    const dialog = await evaluation.openNewBenchmarkDialog();
    const name = dialog.getByLabel(labels.nameLabel, { exact: true });

    await name.fill(BENCHMARK_NAME);
    // Waits for the Q&A step before Create is clicked: Next and Create take
    // the same place in the footer.
    await evaluation.goToBenchmarkQaStep();
    await dialog
      .getByLabel(EvaluationTab.LABELS.addItemsDialog.questionLabel, {
        exact: true,
      })
      .fill(DUPLICATE_NAME_QA_QUESTION);
    await dialog
      .getByRole('button', { name: labels.create, exact: true })
      .click();

    // Create asks the backend whether the name is taken before it answers.
    await expect(dialog.getByRole('alert')).toHaveText(labels.nameTaken, {
      timeout: 15_000,
    });
    await expect(
      dialog.getByRole('tab', { name: labels.detailsTab, exact: true }),
    ).toHaveAttribute('data-state', 'active');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveValue(BENCHMARK_NAME);
    await expect(name).toBeFocused();

    await dialog
      .getByRole('button', { name: labels.cancel, exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Still on page 1 (newest first): the benchmark is a few checkpoints old.
    const items = await evaluation.openBenchmarkItems(BENCHMARK_NAME);
    await evaluation.expectQaItemListed(QA_QUESTION);
    await expect(items.getByText(DUPLICATE_NAME_QA_QUESTION)).toHaveCount(0);

    await evaluation.closeBenchmarkItemsDialog();
    await evaluation.closeManageBenchmarksDialog();
    await editMentorPage.close();
  });

  // EVAL-05: With the fresh (zero-run) benchmark selected, the tab shows
  // only the benchmark-specific empty state (`{dataset}` substituted) — the
  // runs table and its headers appear once there is a run (EVAL-08).
  test('with the fresh benchmark selected, the tab shows the benchmark-specific empty state instead of the runs table', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    await evaluation.expectRunsTableEmpty(BENCHMARK_NAME);
    await expect(
      evaluation.tableHeader(EvaluationTab.TABLE_HEADERS[0]),
    ).toBeHidden();

    await editMentorPage.close();
  });

  // EVAL-19: Q&A is optional in the New Benchmark dialog, but a benchmark
  // with none cannot be evaluated. One created with a name alone is selected
  // by the Evals tab, which says why, offers "Add Q&A" as the one next step,
  // and keeps New Evaluation off with the same sentence as its hover text.
  test('admin creates a benchmark without Q&A, and New Evaluation is off while the tab offers Add Q&A', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    await evaluation.openManageBenchmarksDialog();
    // With no `qaPairs` the helper leaves the Q&A step blank and waits for the
    // toast that says to add Q&A before running an evaluation.
    await evaluation.createBenchmark({
      name: EMPTY_BENCHMARK_NAME,
      description: 'Throwaway benchmark created without Q&A by e2e journey 63.',
    });
    await evaluation.closeManageBenchmarksDialog();

    await evaluation.expectSelectedBenchmark(EMPTY_BENCHMARK_NAME);
    await evaluation.expectBenchmarkNeedsQa();
    emptyBenchmarkReady = true;

    await editMentorPage.close();
  });

  // EVAL-20: "Add Q&A" on the tab opens the Add Q&A dialog for the selected
  // benchmark, and saving a pair there turns New Evaluation on.
  test('admin adds Q&A from the Add Q&A button on the Evals tab and New Evaluation turns on', async ({
    editMentorPage,
  }) => {
    test.skip(
      !emptyBenchmarkReady,
      'The benchmark without Q&A was not created in EVAL-19',
    );
    const { evaluation } = editMentorPage;

    await evaluation.selectBenchmark(EMPTY_BENCHMARK_NAME);
    await expect(evaluation.noQaPrompt()).toBeVisible({ timeout: 15_000 });
    await expect(evaluation.newEvaluationButton()).toBeDisabled();

    const addDialog = await evaluation.openAddQaFromTab();
    await expect(addDialog).toContainText(EMPTY_BENCHMARK_NAME);
    await evaluation.addQaPairsManually([
      { question: TAB_ADDED_QA_QUESTION, answer: QA_ANSWER },
    ]);

    await expect(evaluation.noQaPrompt()).toBeHidden({ timeout: 15_000 });
    await expect(evaluation.newEvaluationButton()).toBeEnabled({
      timeout: 15_000,
    });
    await evaluation.expectRunsTableEmpty(EMPTY_BENCHMARK_NAME);
    emptyBenchmarkHasQa = true;

    await editMentorPage.close();
  });

  // EVAL-22: Deleting a benchmark's only Q&A pair in Manage Benchmarks puts
  // it back in the no-Q&A state: its Q&A dialog loses the count and offers
  // Add Q&A, New Evaluation is off, and the tab offers "Add Q&A".
  test('admin deletes the only Q&A pair of a benchmark and New Evaluation turns off again', async ({
    editMentorPage,
  }) => {
    test.skip(
      !emptyBenchmarkHasQa,
      'Q&A was not added to the second benchmark in EVAL-20',
    );
    const { evaluation } = editMentorPage;

    await evaluation.selectBenchmark(EMPTY_BENCHMARK_NAME);
    await expect(evaluation.newEvaluationButton()).toBeEnabled({
      timeout: 15_000,
    });

    await evaluation.openManageBenchmarksDialog();
    // The list is newest first and the search box filters only the page
    // showing: this benchmark was created two checkpoints ago, so it is on
    // page 1.
    await evaluation.searchBenchmarks(EMPTY_BENCHMARK_NAME);
    const items = await evaluation.openBenchmarkItems(EMPTY_BENCHMARK_NAME);
    const onePair = items.getByText('1 Q&A pair', { exact: true });
    await expect(onePair).toBeVisible();

    await evaluation.deleteQaItem(TAB_ADDED_QA_QUESTION);
    // The helper checks the sentence and the Add Q&A button under it.
    await evaluation.expectBenchmarkItemsEmpty();
    await expect(onePair).toHaveCount(0);
    await evaluation.closeBenchmarkItemsDialog();
    await evaluation.closeManageBenchmarksDialog();

    await evaluation.expectBenchmarkNeedsQa();
    emptyBenchmarkEmptied = true;

    await editMentorPage.close();
  });

  // EVAL-06: New Evaluation dialog shows the benchmark readback + name
  // input + Start button, and Cancel dismisses it without creating a run.
  test('the New Evaluation dialog shows the benchmark readback and name input, and Cancel dismisses it', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    const dialog = await evaluation.openStartEvaluationDialog();
    await expect(dialog.getByText(BENCHMARK_NAME, { exact: true })).toBeVisible(
      { timeout: 5_000 },
    );
    await expect(
      dialog.getByLabel(EvaluationTab.LABELS.startDialog.experimentNameLabel, {
        exact: true,
      }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog.getByRole('button', {
        name: EvaluationTab.LABELS.startDialog.start,
        exact: true,
      }),
    ).toBeVisible();

    await evaluation.cancelStartEvaluation();

    await editMentorPage.close();
  });

  // EVAL-07: New Evaluation dialog can be dismissed via Escape (modal stack
  // hygiene) without creating a run.
  test('the New Evaluation dialog can be dismissed via Escape without creating a run', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    const dialog = await evaluation.openStartEvaluationDialog();
    // The dialog opens with the cursor in the name box, not on an info icon,
    // so no tooltip is open to take the Escape.
    const nameInput = dialog.getByLabel(
      EvaluationTab.LABELS.startDialog.experimentNameLabel,
      { exact: true },
    );
    await expect(nameInput).toBeFocused();
    await nameInput.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // EVAL-08: Admin starts a real evaluation; the dialog closes, the toast
  // names it, and the run appears in the table, under its five column
  // headers, with a valid status. This is the "primary" run the later
  // checkpoints work on.
  test('admin starts a new evaluation and it appears in the table with a valid status', async ({
    editMentorPage,
  }) => {
    test.skip(!benchmarkReady, 'Benchmark was not created in EVAL-03');
    const { evaluation } = editMentorPage;

    primaryRunName = EvaluationTab.uniqueName('e2e-eval-run');
    // The helper also waits for the toast "Evaluation started: <name>".
    await evaluation.startEvaluation({ name: primaryRunName });
    await evaluation.expectRunInTable(primaryRunName);
    for (const header of EvaluationTab.TABLE_HEADERS) {
      await expect(evaluation.tableHeader(header)).toBeVisible();
    }

    const status = await evaluation.readRunStatus(primaryRunName);
    expect(['COMPLETED', 'FAILED', 'PENDING', 'IN_PROGRESS']).toContain(status);

    await editMentorPage.close();
  });

  // EVAL-09: The primary run's row-actions menu reflects its live status —
  // Check Status / Delete are always available; View Results / New Review /
  // Export CSV are enabled once completed and disabled otherwise, with the
  // reason as their description: `failedHint` for a failed run, `notReadyHint`
  // for one still queued or running. Branches on the real status instead of
  // assuming the run is still pending, since completion timing against the
  // real backend is not deterministic. Each item is looked up by its exact
  // name, which pins the Title Case labels.
  test("the primary run's actions menu reflects its live status", async ({
    editMentorPage,
  }) => {
    test.skip(!primaryRunName, 'Primary run was not started in EVAL-08');
    const { evaluation } = editMentorPage;

    const status = await evaluation.readRunStatus(primaryRunName);
    primaryRunCompleted = status === 'COMPLETED';

    const menu = await evaluation.openRunActionsMenu(primaryRunName);
    const viewResults = menu.getByRole('menuitem', {
      name: EvaluationTab.LABELS.actions.viewResults,
      exact: true,
    });
    const newReview = menu.getByRole('menuitem', {
      name: EvaluationTab.LABELS.actions.evaluate,
      exact: true,
    });
    const exportCsv = menu.getByRole('menuitem', {
      name: EvaluationTab.LABELS.actions.exportCsv,
      exact: true,
    });
    const checkStatus = menu.getByRole('menuitem', {
      name: EvaluationTab.LABELS.actions.checkStatus,
      exact: true,
    });
    const del = menu.getByRole('menuitem', {
      name: EvaluationTab.LABELS.actions.delete,
      exact: true,
    });

    // Always available regardless of run status.
    await expect(checkStatus).toBeEnabled({ timeout: 5_000 });
    await expect(del).toBeEnabled({ timeout: 5_000 });

    if (primaryRunCompleted) {
      await expect(viewResults).toBeEnabled({ timeout: 5_000 });
      await expect(newReview).toBeEnabled({ timeout: 5_000 });
      await expect(exportCsv).toBeEnabled({ timeout: 5_000 });
    } else {
      const reason =
        status === 'FAILED'
          ? EvaluationTab.FAILED_HINT
          : EvaluationTab.NOT_READY_HINT;
      for (const item of [viewResults, newReview, exportCsv]) {
        await expect(item).toBeDisabled({ timeout: 5_000 });
        await expect(item).toHaveAccessibleDescription(reason);
      }
    }

    await editMentorPage.page.keyboard.press('Escape');
    await expect(menu).toBeHidden({ timeout: 5_000 });
    await editMentorPage.close();
  });

  // EVAL-10: "Check Status" triggers a fresh fetch and surfaces one of the
  // three outcome toasts.
  test('admin checks the primary run status and sees an outcome toast', async ({
    editMentorPage,
  }) => {
    test.skip(!primaryRunName, 'Primary run was not started in EVAL-08');
    const { evaluation } = editMentorPage;

    const outcome = await evaluation.checkRunStatus(primaryRunName);
    expect(['pending', 'completed', 'failed']).toContain(outcome);
    if (outcome === 'completed') primaryRunCompleted = true;

    await editMentorPage.close();
  });

  // EVAL-11: once the primary run has completed, admin can open View
  // Results and Export CSV. Waits up to three minutes for the run to
  // complete; when it is still running by then, or has failed, the
  // checkpoint skips with that outcome as the reason. It never fails because
  // a run did not complete, and never passes without opening the results.
  test('admin can view results and export CSV once the primary run has completed', async ({
    editMentorPage,
  }) => {
    test.skip(!primaryRunName, 'Primary run was not started in EVAL-08');
    // The wait below is longer than the default test timeout.
    test.setTimeout(360_000);
    const { evaluation } = editMentorPage;

    // Nothing refreshes a run's row except Check Status, so ask until the
    // run leaves "still running" or three minutes pass. Each call first
    // waits for the previous check's toast to go, which paces the loop.
    const deadline = Date.now() + 180_000;
    let outcome: 'pending' | 'completed' | 'failed' = primaryRunCompleted
      ? 'completed'
      : 'pending';
    while (outcome === 'pending' && Date.now() < deadline) {
      outcome = await evaluation.checkRunStatus(primaryRunName);
    }
    primaryRunCompleted = outcome === 'completed';
    test.skip(
      !primaryRunCompleted,
      outcome === 'failed'
        ? 'The primary run failed on the backend, so View Results / Export CSV stay off for it.'
        : 'The primary run was still running after 3 minutes; View Results / Export CSV are only reachable once it completes (real backend, non-deterministic timing).',
    );

    // Check Status re-reads the list; wait for the row to show the result.
    await evaluation.expectRunStatus(primaryRunName, 'COMPLETED');

    const detail = await evaluation.openRunResults(primaryRunName);
    await expect(
      detail.getByRole('button', {
        name: EvaluationTab.LABELS.detailDialog.refreshAriaLabel,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });
    await evaluation.closeEvaluationDetailDialog();

    const filename = await evaluation.exportRunCsv(primaryRunName);
    expect(filename).toContain(primaryRunName);
    expect(filename.endsWith('.csv')).toBe(true);

    await editMentorPage.close();
  });

  // EVAL-12: once the primary run has completed, the New Review (LLM-judge)
  // dialog, titled so, keeps Start Review disabled until criteria + score
  // name + an LLM are all provided. EVAL-11 has already waited for the run;
  // this re-reads its status once and skips when it has not completed.
  // Stops short of actually picking an LLM/submitting — that would spend a
  // real LLM call against the real backend for a check that's already fully
  // covered by the disabled-state assertions below, and model names are
  // prefixes of one another (e.g. "gpt-4o" / "gpt-4o-mini"), which is a real
  // substring-collision risk for any hardcoded model name.
  test('the New Review dialog keeps Start Review disabled until criteria, score name and an LLM are provided, once the primary run has completed', async ({
    editMentorPage,
  }) => {
    test.skip(!primaryRunName, 'Primary run was not started in EVAL-08');
    const { evaluation } = editMentorPage;

    if (!primaryRunCompleted) {
      primaryRunCompleted =
        (await evaluation.readRunStatus(primaryRunName)) === 'COMPLETED';
    }
    test.skip(
      !primaryRunCompleted,
      'New Review is only reachable once the primary run has completed, and it had not after the wait in EVAL-11 (real backend, non-deterministic timing).',
    );

    const judgeDialog = await evaluation.openNewReviewForRun(primaryRunName);
    await expect(
      judgeDialog.getByRole('heading', {
        name: EvaluationTab.LABELS.judgeDialog.title,
        exact: true,
      }),
    ).toBeVisible();
    const submit = judgeDialog.getByRole('button', {
      name: EvaluationTab.LABELS.judgeDialog.submit,
      exact: true,
    });
    await expect(submit).toBeDisabled({ timeout: 5_000 });

    await judgeDialog
      .getByLabel(EvaluationTab.LABELS.judgeDialog.criteriaLabel, {
        exact: true,
      })
      .fill('Score the response for clarity and accuracy.');
    await expect(submit).toBeDisabled({ timeout: 5_000 });

    await judgeDialog
      .getByLabel(EvaluationTab.LABELS.judgeDialog.scoreNameLabel, {
        exact: true,
      })
      .fill('e2e-quality');
    // LLM still unselected — submit must stay disabled even with both text
    // fields filled in.
    await expect(submit).toBeDisabled({ timeout: 5_000 });

    await evaluation.cancelLlmJudge();
    await editMentorPage.close();
  });

  // EVAL-18: Phone view (< 768px) — run cards instead of the table, the
  // per-run action sheet (with the reason an option is off written under its
  // label) and the benchmark picker sheet. Declared before EVAL-13 so the
  // primary run still exists when it runs. The viewport is set on this
  // describe alone.
  test.describe('phone view', () => {
    test.use(PHONE_CONTEXT);

    test('on a phone the Evals tab shows run cards, the run action sheet and the benchmark sheet', async ({
      editMentorPage,
    }) => {
      test.skip(!primaryRunName, 'Primary run was not started in EVAL-08');
      const { evaluation } = editMentorPage;
      const { phone } = evaluation;

      await phone.expectDialogFillsViewport();
      await phone.openAndCloseInfoSheet(EvaluationTab.LABELS.header.title);

      await expect(evaluation.phoneRunCard(primaryRunName)).toBeVisible({
        timeout: 15_000,
      });
      await phone.expectNoHorizontalScroll();

      const actions = await evaluation.openPhoneRunActions(primaryRunName);
      const statusLine = actions.getByText(/^Status: /);
      await expect(statusLine).toBeVisible();
      for (const label of [
        EvaluationTab.LABELS.actions.viewResults,
        EvaluationTab.LABELS.actions.evaluate,
        EvaluationTab.LABELS.actions.checkStatus,
        EvaluationTab.LABELS.actions.exportCsv,
        EvaluationTab.LABELS.actions.delete,
      ]) {
        // An option that is off carries its reason in its name, so the label
        // is matched as the start of the name, case included.
        await expect(
          actions.getByRole('button', { name: new RegExp(`^${label}`) }),
        ).toBeVisible();
      }

      // The sheet shows the run's status as a word; the three options that
      // need a completed run are off until then, each with the reason.
      const statusWords = EvaluationTab.LABELS.detailDialog.reviewStatus;
      const status = (await statusLine.innerText()).trim();
      const notReady = actions.getByText(EvaluationTab.NOT_READY_HINT, {
        exact: true,
      });
      const failed = actions.getByText(EvaluationTab.FAILED_HINT, {
        exact: true,
      });
      if (status.endsWith(statusWords.completed)) {
        await expect(notReady).toHaveCount(0);
        await expect(failed).toHaveCount(0);
      } else if (status.endsWith(statusWords.failed)) {
        await expect(failed).toHaveCount(3);
      } else {
        await expect(notReady).toHaveCount(3);
      }
      await phone.closeSheetByBackdrop(actions);

      await evaluation.benchmarkCombobox().click();
      const benchmarkSheet = evaluation.phoneBenchmarkSheet();
      await expect(benchmarkSheet).toBeVisible({ timeout: 5_000 });
      await expect(
        benchmarkSheet.getByText(BENCHMARK_NAME, { exact: true }),
      ).toBeVisible();
      await phone.closeSheetByBackdrop(benchmarkSheet);
      await phone.expectNoHorizontalScroll();

      await editMentorPage.close();
    });
  });

  // EVAL-13: Cancelling a delete confirmation leaves the row in place;
  // confirming for real removes it. Both helpers first check that the
  // dialog asks about this run by name. Reuses the primary run (several
  // minutes old by this point in the file) rather than starting a fresh one
  // — a run created only moments earlier can 404 on the delete endpoint even
  // though it's already visible in the table (observed directly: the
  // backend hadn't finished materializing a <1-minute-old run into the
  // store the delete endpoint reads from, so every delete attempt against
  // it failed with a 404 and the confirm dialog never closed). The primary
  // run has had several other checkpoints' worth of wall-clock time to
  // settle. This is the only place the run is deleted.
  test('admin can cancel a delete confirmation and then delete a run for real', async ({
    editMentorPage,
  }) => {
    test.skip(!primaryRunName, 'Primary run was not started in EVAL-08');
    const { evaluation } = editMentorPage;

    await evaluation.cancelDeleteEvaluation(primaryRunName);
    await evaluation.expectRunInTable(primaryRunName);

    await evaluation.deleteEvaluation(primaryRunName);
    await evaluation.expectRunNotInTable(primaryRunName);

    await editMentorPage.close();
  });

  // EVAL-24: Phone view (< 768px) of the benchmark surfaces — the no-Q&A
  // state of the tab, and a benchmark's Q&A dialog with each answer under
  // its question and no ANSWER column. Declared after EVAL-13 so a failure
  // here cannot keep the primary run from being deleted. The viewport is set
  // on this describe alone.
  test.describe('phone view of benchmarks', () => {
    test.use(PHONE_CONTEXT);

    test('on a phone a benchmark without Q&A offers Add Q&A with New Evaluation off, and the Q&A dialog shows each answer under its question', async ({
      editMentorPage,
    }) => {
      test.skip(
        !emptyBenchmarkEmptied,
        'The second benchmark was not left without Q&A in EVAL-22',
      );
      const { evaluation } = editMentorPage;
      const { phone } = evaluation;
      const [questionColumn, answerColumn] =
        EvaluationTab.LABELS.benchmarkItemsDialog.columns;

      await evaluation.selectBenchmark(EMPTY_BENCHMARK_NAME);
      const prompt = evaluation.noQaPrompt();
      await expect(prompt).toContainText(EvaluationTab.LABELS.emptyQa, {
        timeout: 15_000,
      });
      await expect(
        prompt.getByRole('button', {
          name: EvaluationTab.LABELS.actions.addQa,
          exact: true,
        }),
      ).toBeVisible();
      await expect(evaluation.newEvaluationButton()).toBeDisabled();
      await phone.expectNoHorizontalScroll();

      await evaluation.openManageBenchmarksDialog();
      // The list is newest first, 10 per page: this relies on the shared
      // benchmark, created at the start of the file, still being among the
      // organization's 10 newest. One run of this journey adds one benchmark
      // after it, and each other browser project running alongside adds two.
      const items = await evaluation.openBenchmarkItems(BENCHMARK_NAME);
      await expect(
        items.getByRole('columnheader', { name: questionColumn, exact: true }),
      ).toBeVisible();
      await expect(
        items.getByRole('columnheader', { name: answerColumn, exact: true }),
      ).toBeHidden();
      // Scoped to the question's own cell: the hidden ANSWER cell holds the
      // same text.
      await expect(
        items
          .getByRole('cell')
          .filter({ hasText: QA_QUESTION })
          .getByText(QA_ANSWER, { exact: true }),
      ).toBeVisible();
      await phone.expectNoHorizontalScroll();

      await evaluation.closeBenchmarkItemsDialog();
      await evaluation.closeManageBenchmarksDialog();
      await editMentorPage.close();
    });
  });

  // EVAL-15: No axe-core accessibility violations on visible dialogs.
  //
  // Excludes the benchmark combobox trigger: it's a pre-existing upstream
  // defect in `@iblai/iblai-js`'s `BenchmarkCombobox` (a plain `<button
  // role="combobox">` with no `aria-label`/`aria-labelledby`), not
  // introduced by this journey and not fixable from the app repo. axe's
  // "button-name" rule fails it unconditionally: `role="combobox"` isn't
  // one of the ARIA roles that support "name from content", so the
  // button's own visible text (the selected benchmark name) never counts
  // toward its accessible name no matter what it renders. Confirmed via a
  // live run this is the ONLY violation on the tab — everything else
  // passes clean.
  test('Evals tab has no accessibility violations on visible dialogs', async ({
    page,
    editMentorPage,
  }) => {
    await expect(
      editMentorPage.dialog.getByRole('heading', {
        name: EvaluationTab.LABELS.header.title,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });
    // `exclude` is a single AxeBuilder selector PATH (used for piercing
    // iframes/shadow roots), not a list of independent selectors — passing
    // ['#embed-mentor-preview', '[data-testid="benchmark-combobox"]']
    // together is read as "find benchmark-combobox nested inside
    // embed-mentor-preview", which matches nothing on this tab and excludes
    // nothing. #embed-mentor-preview (the helper's own default) is
    // irrelevant here — the Evals tab never renders it — so this call only
    // needs its own single-selector path.
    await expectNoAccessibilityViolationsOnDialogs(page, undefined, [
      '[data-testid="benchmark-combobox"]',
    ]);
    await editMentorPage.close();
  });

  // EVAL-16: Leaving the Evals tab and returning re-renders it cleanly
  // (wrapper re-mounts without errors).
  test('admin can leave the Evals tab and return without errors', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'Settings' }),
    ).toHaveAttribute('data-state', 'active', { timeout: 5_000 });

    await editMentorPage.navigateToTab('Evals');
    await expect(
      editMentorPage.dialog.getByRole('heading', {
        name: EvaluationTab.LABELS.header.title,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });

    await editMentorPage.close();
  });
});

// ── Non-admin: Evals tab must stay invisible ─────────────────────────────
//
// EVAL-17. The `evaluation` segment is ADMIN-only in
// `hooks/use-mentor-segments.ts` (`userTypes: [UserType.ADMIN]`), in both
// places a person can reach it: the agent dropdown, which lists every Edit
// Agent tab they may open, and the Edit Agent dialog itself. The dropdown is
// checked always; the dialog only when this account is offered Settings.
test.describe('Journey 63: Mentor Evaluation Tab — Non-Admin', () => {
  test('non-admin does not see the Evals tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorAppWithRetry(nonadminPage);

    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const menu = nonadminPage.getByRole('menu');
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await expect(
      menu.getByRole('menuitem', {
        name: EvaluationTab.LABELS.tabName,
        exact: true,
      }),
    ).toHaveCount(0);

    // Never "Modify": it copies the agent in one click and opens nothing.
    const settingsItem = menu.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });
    if ((await settingsItem.count()) === 0) {
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    await settingsItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });

    // Evals lives in Activity; check there, not in the Setup list.
    await nonadminEditMentorPage.activateCategoryOf('Evals');
    expect(await nonadminEditMentorPage.evaluation.isTabVisible()).toBe(false);

    await nonadminEditMentorPage.close();
  });
});
