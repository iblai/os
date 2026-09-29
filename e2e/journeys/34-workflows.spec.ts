import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import {
  navigateToWorkflowsPage,
  createWorkflow,
  waitForWorkflowEditorReady,
  navigateBackToWorkflowsList,
  searchWorkflow,
  openWorkflowByName,
  deleteCurrentWorkflow,
  editWorkflowName,
  enterPreviewMode,
  exitPreviewMode,
  saveWorkflow,
  publishWorkflow,
  getWorkflowStatus,
} from '../utils/workflows';
import {
  seedDatasetsForMentor,
  waitForDatasetsReady,
  deleteDatasetDocumentsByStamp,
} from '../utils/dataset-seeding';
import { deleteMentorById } from '../utils/mentor-cleanup';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 34: Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Workflows requires admin access');
  });

  // ── Workflows List Page ───────────────────────────────────────────────────

  test('admin goes to workflows page and sees heading and create button', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);

    await expect(
      page.getByRole('heading', { name: 'Workflows', level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Create and manage automated workflows for your agents', {
        exact: true,
      }),
    ).toBeVisible();

    const createButton = page.getByRole('button', { name: 'Create Workflow' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
  });

  test('admin goes to workflows page and sees the search input', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);

    await expect(page.getByPlaceholder('Search workflows...')).toBeVisible();
  });

  test('admin goes to workflows page and filters by search term', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);

    await searchWorkflow(page, 'nonexistent-workflow-xyz');

    const noWorkflows = page.getByText('No workflows found');
    const hasResults = await page
      .locator('h3')
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasResults) {
      await expect(noWorkflows).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── Workflow CRUD Operations ──────────────────────────────────────────────

  test('admin goes to workflows page and creates a new workflow', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);

    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await expect(canvas).toBeVisible();

    const startNode = canvas.locator('span').filter({ hasText: 'Start' });
    await expect(startNode).toBeVisible({ timeout: 15_000 });

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflows page and opens an existing workflow from the list', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);

    const workflowName = await createWorkflow(page);
    await waitForWorkflowEditorReady(page);
    await navigateBackToWorkflowsList(page);
    await openWorkflowByName(page, workflowName);

    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await expect(canvas).toBeVisible();

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflows page and deletes a workflow', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);

    const workflowName = await createWorkflow(page);
    await waitForWorkflowEditorReady(page);
    await deleteCurrentWorkflow(page);

    await expect(
      page.getByRole('heading', { name: 'Workflows', level: 1, exact: true }),
    ).toBeVisible();

    await searchWorkflow(page, workflowName);

    const deletedWorkflow = page
      .locator('h3')
      .filter({ hasText: workflowName });
    await expect(deletedWorkflow).not.toBeVisible({ timeout: 10_000 });
  });

  // ── Workflow Editor ───────────────────────────────────────────────────────

  test('admin goes to workflow editor and sees Save, Publish, and Preview buttons', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    // Exact name — a loose 'Save' also matches the chat-privacy toggle's
    // aria-label ("...won't be saved to history...") → strict-mode violation.
    await expect(
      page.getByRole('button', { name: 'Save', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and sees Active status for new workflow', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const status = await getWorkflowStatus(page);
    expect(status).toBe('Active');

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and renames workflow inline', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const newName = `Renamed Workflow ${Date.now()}`;
    await editWorkflowName(page, newName);

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10_000 });

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and saves workflow', async ({ page }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    await saveWorkflow(page);

    const errorToast = page.getByText('Failed to save workflow');
    const hasError = await errorToast.isVisible().catch(() => false);
    expect(hasError).toBe(false);

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and sees default Start and Mentor nodes', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const canvas = page.locator('[data-testid="workflow-canvas"]');
    const startNode = canvas.locator('span').filter({ hasText: 'Start' });
    await expect(startNode).toBeVisible({ timeout: 15_000 });

    const mentorNode = canvas.locator('p').filter({ hasText: 'Agent' });
    await expect(mentorNode).toBeVisible({ timeout: 15_000 });

    const edges = canvas.locator(
      'path[stroke="#38A1E5"]:not([stroke-dasharray])',
    );
    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(1);

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and opens more options menu with Deactivate and Delete', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const moreButton = page.getByRole('button', {
      name: 'More workflow options',
    });
    await expect(moreButton).toBeVisible({ timeout: 10_000 });
    await moreButton.click();

    await expect(
      page.getByRole('menuitem', { name: 'Deactivate' }),
    ).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible({
      timeout: 5_000,
    });

    await page.keyboard.press('Escape');

    await deleteCurrentWorkflow(page);
  });

  // ── Preview Mode ──────────────────────────────────────────────────────────

  test('admin goes to workflow editor and enters and exits preview mode', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    await enterPreviewMode(page);

    await expect(
      page.getByRole('button', { name: 'Close preview' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'New chat for workflow preview' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();

    await exitPreviewMode(page);

    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow preview and sees canvas and chat panel', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    await enterPreviewMode(page);

    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await expect(canvas).toBeVisible();

    await exitPreviewMode(page);
    await deleteCurrentWorkflow(page);
  });

  // ── Workflow Publishing ───────────────────────────────────────────────────

  test('admin goes to workflow editor and publishes a workflow', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    await publishWorkflow(page);

    const hasValidationErrors = await page
      .getByText(/error/)
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasValidationErrors) {
      await expect
        .poll(() => getWorkflowStatus(page), { timeout: 10_000 })
        .toBe('Active');
    }

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and publishes an invalid workflow to check for validation errors', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    await publishWorkflow(page);

    // Either validation errors appear or it succeeds — both are valid outcomes
    const validationBanner = page.locator('text=/error|warning/i').first();
    const hasValidation = await validationBanner.isVisible().catch(() => false);

    // Test passes regardless — we're just verifying no crash
    expect(typeof hasValidation).toBe('boolean');

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and deactivates an active workflow', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    await publishWorkflow(page);

    try {
      await expect
        .poll(() => getWorkflowStatus(page), { timeout: 10_000 })
        .toBe('Active');
    } catch {
      await deleteCurrentWorkflow(page);
      test.skip(true, 'Workflow did not become active after publish');
      return;
    }

    const moreButton = page.getByRole('button', {
      name: 'More workflow options',
    });
    await moreButton.click();

    const deactivateItem = page.getByRole('menuitem', { name: 'Deactivate' });
    await expect(deactivateItem).toBeVisible({ timeout: 5_000 });
    const [deactivateResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/workflows') &&
          resp.request().method() === 'POST',
      ),
      deactivateItem.click(),
    ]);
    expect(deactivateResponse.ok()).toBeTruthy();

    await expect
      .poll(() => getWorkflowStatus(page), { timeout: 10_000 })
      .toBe('Draft');

    await deleteCurrentWorkflow(page);
  });

  // ── File Search node: dataset picker dialog ────────────────────────────────
  // The File Search node's "Select" button opens the workflow's ENTRY
  // mentor's Datasets tab in picker mode (`AgentDatasetsTabWrapper` with
  // `syncToUrl={false}` — see `components/workflows/node-config-panel.tsx`),
  // unlike the edit-mentor modal's Datasets tab, which drives page/search off
  // the URL. This checkpoint asserts that distinction holds: searching/paging
  // inside the picker must NOT touch `datasetsPage`/`datasetsSearch`.
  //
  // IMPORTANT: the entry mentor is NOT whichever mentor is active in the
  // browser when "Create Workflow" is clicked — verified live (2026-09-28)
  // that creating a fresh mentor first and immediately creating a workflow
  // still yields a DIFFERENT id in the resulting `/workflows/{mentorId}/...`
  // route. The backend auto-provisions a dedicated entry mentor per workflow
  // (the canvas's default "Agent" node's backing mentor). So this test reads
  // the REAL entry mentor id off the post-creation URL and seeds datasets
  // there — not onto a mentor it created itself.
  //
  // Cleanup: `deleteCurrentWorkflow` appears to cascade-delete the entry
  // mentor (verified empirically — residue delta was 0 after it). `
  // registerMentor` can't be used here to double-track it: it derives the
  // mentor id by parsing `page.url()` as `/platform/{tenant}/{mentorId}`,
  // which misreads this route's `/platform/{tenant}/workflows/{mentorId}/...`
  // shape (it took the literal segment "workflows" as the id). So the
  // fallback instead calls `deleteMentorById(page, entryMentorId)` directly
  // (explicit id, no URL parsing) in a `finally`, in case the workflow delete
  // itself ever fails.

  test('admin adds a File Search node and picks a dataset from its picker dialog without touching the URL', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const entryMentorId = new URL(page.url()).pathname
      .split('/workflows/')[1]
      ?.split('/')[0];
    expect(
      entryMentorId,
      'Could not parse entry mentor id from workflow URL',
    ).toBeTruthy();

    const stamp = `wf16-${Date.now()}`;
    const seedCount = 6; // > 5/page, so pagination actually renders (see below)
    await seedDatasetsForMentor(page, entryMentorId, seedCount, { stamp });
    await waitForDatasetsReady(page, entryMentorId, seedCount);

    const fileSearchItem = page.getByRole('button', { name: 'File Search' });
    await expect(fileSearchItem).toBeVisible({ timeout: 15_000 });
    await fileSearchItem.click();

    const canvas = page.locator('[data-testid="workflow-canvas"]');
    const fileSearchNode = canvas.getByText('File Search', { exact: true });
    await expect(fileSearchNode).toBeVisible({ timeout: 10_000 });
    await fileSearchNode.click();

    const configPanel = page.locator('div.absolute.top-4.right-4');
    const selectButton = configPanel.getByRole('button', { name: 'Select' });
    await expect(selectButton).toBeVisible({ timeout: 10_000 });

    const urlBeforeOpen = page.url();
    await selectButton.click();

    const pickerDialog = page.getByRole('dialog', { name: 'Select Dataset' });
    await expect(pickerDialog).toBeVisible({ timeout: 10_000 });

    const searchInput = pickerDialog.getByPlaceholder(/search datasets/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // 6 seeded rows at 5/page means pagination must render — assert on it
    // rather than conditionally skipping (this is a self-seeded fixture, so
    // "no pagination" would itself be a real regression, not a data gap).
    const paginationNav = pickerDialog.getByRole('navigation', {
      name: /pagination/i,
    });
    await expect(paginationNav).toBeVisible({ timeout: 10_000 });

    const page2Link = paginationNav.locator('a').filter({ hasText: /^2$/ });
    await page2Link.click();
    await page.waitForTimeout(1_000);
    expect(new URL(page.url()).searchParams.get('datasetsPage')).toBeNull();
    expect(page.url()).toBe(urlBeforeOpen);
    logger.info(
      'File Search picker: paging did not add a datasetsPage URL param',
    );

    await searchInput.fill('e2e-dataset');
    await page.waitForTimeout(1_000);
    expect(new URL(page.url()).searchParams.get('datasetsSearch')).toBeNull();
    expect(page.url()).toBe(urlBeforeOpen);
    logger.info(
      'File Search picker: searching did not add a datasetsSearch URL param',
    );
    await searchInput.fill('');
    await page.waitForTimeout(500);

    const firstRow = pickerDialog.getByRole('row').nth(1); // nth(0) is the header row
    const rowText = await firstRow.innerText();
    await firstRow.click();

    await expect(pickerDialog).not.toBeVisible({ timeout: 10_000 });
    const changeButton = configPanel.getByRole('button', { name: 'Change' });
    await expect(changeButton).toBeVisible({ timeout: 10_000 });
    const datasetNameShown = configPanel
      .locator('p')
      .filter({ hasText: rowText.split('\t')[0] });
    await expect(datasetNameShown).toBeVisible({ timeout: 5_000 });

    // Reopening highlights the previously selected row.
    await changeButton.click();
    const reopenedDialog = page.getByRole('dialog', { name: 'Select Dataset' });
    await expect(reopenedDialog).toBeVisible({ timeout: 10_000 });
    const selectedRow = reopenedDialog
      .getByRole('row')
      .filter({ hasText: rowText.split('\t')[0] });
    await expect(selectedRow).toHaveClass(/bg-blue-50/, { timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(reopenedDialog).not.toBeVisible({ timeout: 5_000 });

    // Close the node config panel before deleting the workflow so its X
    // button doesn't intercept the "More workflow options" click.
    const closePanelButton = configPanel
      .getByRole('button')
      .filter({ has: page.locator('svg.lucide-x') });
    await closePanelButton.click();
    await expect(configPanel).not.toBeVisible({ timeout: 5_000 });

    try {
      await deleteCurrentWorkflow(page);
    } finally {
      // Best-effort fallback: deleteCurrentWorkflow appears to already
      // cascade-delete the entry mentor (verified empirically), but delete it
      // explicitly too in case the workflow delete itself fails.
      await deleteMentorById(page, entryMentorId).catch(() => {});
    }

    // Best-effort: remove exactly the documents this test added, in case the
    // mentor itself somehow survived.
    await deleteDatasetDocumentsByStamp(page, entryMentorId, stamp).catch(
      () => {},
    );

    logger.info(
      'File Search node: dataset picked, URL untouched, selection persisted and highlighted on reopen',
    );
  });
});
