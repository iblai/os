import { Page, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL, parsePlatformUrl } from './navigation';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

/**
 * Navigate to the workflows list page for the current mentor.
 * Extracts tenantKey and mentorId from the current platform URL.
 */
export async function navigateToWorkflowsPage(page: Page): Promise<void> {
  const { platformKey: tenantKey, mentorId } = parsePlatformUrl(page.url());

  // Log localStorage tokens before navigating to help diagnose redirect-to-login issues
  const tokenSnapshot = await page.evaluate(() => {
    const keys = [
      'dm_token',
      'axd_token',
      'axd_token_expires',
      'edx_jwt_token',
    ];
    return Object.fromEntries(
      keys.map((k) => [k, localStorage.getItem(k) ? 'present' : 'NULL']),
    );
  });
  logger.info(
    `[navigateToWorkflowsPage] localStorage before goto: ${JSON.stringify(tokenSnapshot)}`,
  );

  await page.goto(
    `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/workflows/${mentorId}`,
    { waitUntil: 'domcontentloaded', timeout: 60_000 },
  );

  logger.info(`[navigateToWorkflowsPage] URL after goto: ${page.url()}`);

  await safeWaitForURL(page, (url) => url.href.includes('/workflows/'), {
    timeout: 60_000,
  });

  logger.info(
    `[navigateToWorkflowsPage] URL after safeWaitForURL: ${page.url()}`,
  );

  const heading = page.getByRole('heading', { name: 'Workflows' });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  logger.info('Navigated to workflows list page');
}

/**
 * Open the create workflow modal and create a workflow with the given name.
 * Returns the workflow name used.
 */
export async function createWorkflow(
  page: Page,
  name?: string,
): Promise<string> {
  const workflowName = name || `Test Workflow ${Date.now()}`;

  const createButton = page.getByRole('button', { name: 'Create Workflow' });
  await expect(createButton).toBeVisible({ timeout: 10_000 });
  await createButton.click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10_000 });

  const nameInput = modal.getByRole('textbox');
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill(workflowName);

  const submitButton = modal.getByRole('button', { name: /create/i });
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();

  await safeWaitForURL(page, (url) => url.href.includes('/workflows/'), {
    timeout: 30_000,
  });

  logger.info(`Created workflow: ${workflowName}`);
  return workflowName;
}

/**
 * Wait for the workflow editor to be ready (canvas loaded).
 */
export async function waitForWorkflowEditorReady(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible({ timeout: 30_000 });

  const canvas = page.locator('[data-testid="workflow-canvas"]');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  logger.info('Workflow editor is ready');
}

/**
 * Click the back button to return to the workflows list.
 */
export async function navigateBackToWorkflowsList(page: Page): Promise<void> {
  const backButton = page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-chevron-left') });
  await expect(backButton).toBeVisible({ timeout: 10_000 });
  await backButton.click();

  const heading = page.getByRole('heading', { name: 'Workflows' });
  await expect(heading).toBeVisible({ timeout: 30_000 });

  logger.info('Navigated back to workflows list');
}

/**
 * Search for a workflow by name on the list page.
 */
export async function searchWorkflow(
  page: Page,
  searchTerm: string,
): Promise<void> {
  const searchInput = page.getByPlaceholder('Search workflows...');
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(searchTerm);

  await page.waitForTimeout(1_000);
  logger.info(`Searched for workflow: ${searchTerm}`);
}

/**
 * Click on a workflow card by name to open it.
 */
export async function openWorkflowByName(
  page: Page,
  workflowName: string,
): Promise<void> {
  const card = page.locator('h3').filter({ hasText: workflowName }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await waitForWorkflowEditorReady(page);
  logger.info(`Opened workflow: ${workflowName}`);
}

/**
 * Delete the currently open workflow via the more options menu.
 */
export async function deleteCurrentWorkflow(page: Page): Promise<void> {
  const moreButton = page.getByRole('button', {
    name: 'More workflow options',
  });
  await expect(moreButton).toBeVisible({ timeout: 10_000 });
  await moreButton.click();

  const deleteItem = page.getByRole('menuitem', { name: 'Delete' });
  await expect(deleteItem).toBeVisible({ timeout: 5_000 });
  await deleteItem.click();

  const deleteModal = page.getByRole('alertdialog');
  await expect(deleteModal).toBeVisible({ timeout: 10_000 });

  const confirmButton = deleteModal.getByRole('button', { name: /delete/i });
  await expect(confirmButton).toBeVisible({ timeout: 5_000 });
  await confirmButton.click();

  const heading = page.getByRole('heading', { name: 'Workflows' });
  await expect(heading).toBeVisible({ timeout: 30_000 });

  logger.info('Deleted workflow');
}

/**
 * Edit the workflow name inline.
 */
export async function editWorkflowName(
  page: Page,
  newName: string,
): Promise<void> {
  const nameButton = page.getByRole('button', { name: 'Edit workflow name' });
  await expect(nameButton).toBeVisible({ timeout: 10_000 });
  await nameButton.click();

  const nameInput = page.getByRole('textbox', { name: 'Enter workflow name' });
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill(newName);
  await nameInput.press('Enter');

  logger.info(`Renamed workflow to: ${newName}`);
}

/**
 * Click the Preview button to enter preview mode.
 */
export async function enterPreviewMode(page: Page): Promise<void> {
  const previewButton = page.getByRole('button', { name: 'Preview' });
  await expect(previewButton).toBeVisible({ timeout: 10_000 });
  await previewButton.click();

  const closePreview = page.getByRole('button', { name: 'Close preview' });
  await expect(closePreview).toBeVisible({ timeout: 10_000 });

  logger.info('Entered preview mode');
}

/**
 * Exit preview mode.
 */
export async function exitPreviewMode(page: Page): Promise<void> {
  const closePreview = page.getByRole('button', { name: 'Close preview' });
  await expect(closePreview).toBeVisible({ timeout: 10_000 });
  await closePreview.click();

  const previewButton = page.getByRole('button', { name: 'Preview' });
  await expect(previewButton).toBeVisible({ timeout: 10_000 });

  logger.info('Exited preview mode');
}

/**
 * Click the Save button.
 */
export async function saveWorkflow(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible({ timeout: 10_000 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await page.waitForTimeout(2_000);
  logger.info('Saved workflow');
}

/**
 * Click the Publish button.
 */
export async function publishWorkflow(page: Page): Promise<void> {
  const publishButton = page.getByRole('button', { name: 'Publish' });
  await expect(publishButton).toBeVisible({ timeout: 10_000 });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();

  await page.waitForTimeout(3_000);
  logger.info('Published workflow');
}

/**
 * Get the workflow status badge text (Active or Draft).
 */
export async function getWorkflowStatus(page: Page): Promise<string> {
  const activeBadge = page
    .locator('span')
    .filter({ hasText: /^Active$/ })
    .first();
  if (await activeBadge.isVisible().catch(() => false)) return 'Active';

  const draftBadge = page
    .locator('span')
    .filter({ hasText: /^Draft$/ })
    .first();
  if (await draftBadge.isVisible().catch(() => false)) return 'Draft';

  return 'Unknown';
}
