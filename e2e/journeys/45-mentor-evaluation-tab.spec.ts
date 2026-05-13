import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  closeWithEsc,
  expectNoAccessibilityViolationsOnDialogs,
  logger,
  reliableClick,
  waitForDialogReady,
} from '@iblai/iblai-js/playwright';

/**
 * Journey 45 — Mentor Evaluation (Evals) Tab.
 *
 * The Evals tab is rendered by the packaged
 * `AgentEvaluationTab` from `@iblai/web-containers`, wrapped locally with
 * `AgentSettingsProvider` + `IblPagination` in
 * `components/modals/edit-mentor-modal/tabs/evaluation-tab/index.tsx`.
 *
 * These tests exercise the wrapper's plumbing — that the tab renders,
 * accepts the dataset picker, opens the New Evaluation modal, and exposes
 * the per-run actions menu — without depending on any pre-seeded eval
 * datasets or runs. Tenant data state is host-specific (eval datasets are
 * managed in tenant settings, not by this journey), so each branch is
 * tolerant of both populated and empty states.
 */
test.describe('Journey 45: Mentor Evaluation Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Evals tab is admin-only');
      return;
    }
    await editMentorPage.open('Evals');
    await waitForPageReady(page);
    await waitForDialogReady(page, editMentorPage.dialog);
  });

  // EVAL-01: Tab label + heading + description render correctly
  test('admin opens the edit mentor modal and the Evals tab heading + description render', async ({
    editMentorPage,
  }) => {
    const evalTab = editMentorPage.dialog.getByRole('tab', { name: 'Evals' });
    await expect(evalTab).toBeVisible({ timeout: 10_000 });
    await expect(evalTab).toHaveAttribute('data-state', 'active');

    await expect(editMentorPage.evaluation.heading).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.evaluation.description).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // EVAL-02: Dataset combobox + New Evaluation CTA both render
  test('admin sees the dataset combobox and the New Evaluation button on the Evals tab', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.evaluation.datasetCombobox).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.evaluation.newEvaluationButton).toBeVisible({
      timeout: 10_000,
    });
    await editMentorPage.close();
  });

  // EVAL-03: New Evaluation button is disabled when no dataset is selected.
  // When the tenant has at least one dataset the picker auto-selects it,
  // so we only assert "disabled" in the empty branch.
  test('admin sees New Evaluation disabled before a dataset is chosen', async ({
    editMentorPage,
  }) => {
    const hasNoDatasets = await editMentorPage.evaluation.hasNoDatasetsState();
    if (hasNoDatasets) {
      await expect(editMentorPage.evaluation.newEvaluationButton).toBeDisabled({
        timeout: 5_000,
      });
    } else {
      // A dataset is auto-selected; the CTA must therefore be enabled.
      await expect(editMentorPage.evaluation.newEvaluationButton).toBeEnabled({
        timeout: 10_000,
      });
    }
    await editMentorPage.close();
  });

  // EVAL-04: Tenant with no eval datasets sees the call-to-action, not the table
  test('admin without datasets sees the "no datasets" call-to-action', async ({
    editMentorPage,
  }) => {
    const hasNoDatasets = await editMentorPage.evaluation.hasNoDatasetsState();
    if (!hasNoDatasets) {
      logger.info(
        '[EVAL-04] Tenant has at least one eval dataset; skipping CTA branch.',
      );
      await editMentorPage.close();
      return;
    }
    await expect(editMentorPage.evaluation.emptyDatasets).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // EVAL-05: With a dataset selected the runs table renders (headers visible).
  // If the dataset has no runs we still expect the empty-state row inside
  // the table body — both states keep the column headers mounted.
  test('admin with a dataset sees the runs table headers (Evaluation, Status, Initiated by, Created, Actions)', async ({
    editMentorPage,
  }) => {
    const hasNoDatasets = await editMentorPage.evaluation.hasNoDatasetsState();
    if (hasNoDatasets) {
      // No datasets means no runs table at all — assert the CTA branch instead.
      await expect(editMentorPage.evaluation.emptyDatasets).toBeVisible({
        timeout: 5_000,
      });
      await editMentorPage.close();
      return;
    }
    await expect(editMentorPage.evaluation.tableHeaderEvaluation).toBeVisible({
      timeout: 15_000,
    });
    await expect(editMentorPage.evaluation.tableHeaderStatus).toBeVisible();
    await expect(
      editMentorPage.evaluation.tableHeaderInitiatedBy,
    ).toBeVisible();
    await expect(editMentorPage.evaluation.tableHeaderCreated).toBeVisible();
    await expect(editMentorPage.evaluation.tableHeaderActions).toBeVisible();
    await editMentorPage.close();
  });

  // EVAL-06: New Evaluation modal opens and shows the dataset readback + name input
  test('admin can open the New Evaluation modal and sees the dataset label + name input', async ({
    page,
    editMentorPage,
  }) => {
    const hasNoDatasets = await editMentorPage.evaluation.hasNoDatasetsState();
    if (hasNoDatasets) {
      // Without a dataset there's nothing to start a run against — skip.
      await editMentorPage.close();
      return;
    }
    const modal = await editMentorPage.evaluation.openNewEvaluationModal();
    await waitForDialogReady(page, modal);
    await expect(
      modal.getByText(
        /Run this mentor against every item in the selected dataset/i,
      ),
    ).toBeVisible({ timeout: 5_000 });
    await expect(modal.getByLabel(/evaluation name/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      modal.getByRole('button', { name: /start evaluation/i }),
    ).toBeVisible();
    // Cancel back out without committing — preserves tenant state.
    const cancelBtn = modal.getByRole('button', { name: /^cancel$/i });
    await reliableClick(page, cancelBtn);
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
    await editMentorPage.close();
  });

  // EVAL-07: New Evaluation modal closes via Escape (modal stack hygiene)
  test('admin can dismiss the New Evaluation modal with Escape', async ({
    page,
    editMentorPage,
  }) => {
    const hasNoDatasets = await editMentorPage.evaluation.hasNoDatasetsState();
    if (hasNoDatasets) {
      await editMentorPage.close();
      return;
    }
    const modal = await editMentorPage.evaluation.openNewEvaluationModal();
    await closeWithEsc(page);
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
    await editMentorPage.close();
  });

  // EVAL-08: When runs exist, the actions dropdown exposes the canonical actions
  test("admin can open a run row's actions menu and sees View results / Evaluate / Export / Delete", async ({
    editMentorPage,
  }) => {
    const hasRuns = await editMentorPage.evaluation.hasRuns();
    if (!hasRuns) {
      logger.info(
        '[EVAL-08] No runs available on this tenant/dataset; skipping menu assertions.',
      );
      await editMentorPage.close();
      return;
    }
    // Resolve the first row's name from the EVALUATION cell so we can
    // target its actions trigger by accessible name.
    const firstRow = editMentorPage.evaluation.runRows.first();
    const firstCell = firstRow.locator('td').first();
    const runName = (await firstCell.innerText()).trim();
    expect(runName.length).toBeGreaterThan(0);

    const menu = await editMentorPage.evaluation.openRunActionsMenu(runName);
    await expect(
      menu.getByRole('menuitem', { name: /view results/i }),
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: /^evaluate$/i }),
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: /export csv/i }),
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: /^delete$/i }),
    ).toBeVisible();
    // Close the menu without picking a destructive option.
    await editMentorPage.page.keyboard.press('Escape');
    await editMentorPage.close();
  });

  // EVAL-09: The Evals tab body has no accessibility violations on visible dialogs.
  // Uses iblai-js axe helper which targets the open mentor dialog.
  test('Evals tab has no accessibility violations on visible dialogs', async ({
    page,
    editMentorPage,
  }) => {
    await expect(editMentorPage.evaluation.heading).toBeVisible({
      timeout: 10_000,
    });
    await expectNoAccessibilityViolationsOnDialogs(page);
    await editMentorPage.close();
  });

  // EVAL-10: Switching off the Evals tab and back preserves the tab body.
  // Smoke-tests that the wrapper re-mounts cleanly when the user navigates
  // away within the modal.
  test('admin can leave the Evals tab and come back without errors', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    await expect(
      editMentorPage.dialog.getByRole('tab', { name: 'Settings' }),
    ).toHaveAttribute('data-state', 'active', { timeout: 5_000 });

    await editMentorPage.navigateToTab('Evals');
    await expect(editMentorPage.evaluation.heading).toBeVisible({
      timeout: 10_000,
    });
    await editMentorPage.close();
    // Spread is a no-op, but keeps lint happy by referencing `page` so the
    // fixture is treated as used by static analysis.
    expect(page).toBeDefined();
  });
});
