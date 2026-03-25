import { Page, Locator, expect } from '@playwright/test';
import { logger, safeWaitForURL } from '@iblai/iblai-js/playwright';
import { MENTOR_NEXTJS_HOST } from '../utils';

/**
 * Navigate to the workflows list page for the current mentor.
 * Extracts tenantKey and mentorId from the current platform URL.
 */
export async function navigateToWorkflowsPage(page: Page): Promise<void> {
  const currentUrl = page.url();
  const { tenantKey, mentorId } = extractTenantAndMentor(currentUrl);

  await page.goto(
    `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/workflows/${mentorId}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );

  await safeWaitForURL(page, (url) => url.href.includes('/workflows/'), {
    timeout: 60000,
  });

  // Wait for the page heading to confirm we're on the workflows page
  const heading = page.getByRole('heading', { name: 'Workflows' });
  await expect(heading).toBeVisible({ timeout: 30000 });
  logger.info('Navigated to workflows list page');
}

/**
 * Extract tenantKey and mentorId from a platform URL.
 */
export function extractTenantAndMentor(url: string): {
  tenantKey: string;
  mentorId: string;
} {
  const match = url.match(/\/platform\/([^/]+)\/([^/?]+)/);
  if (!match) {
    throw new Error(`Could not extract tenantKey and mentorId from URL: ${url}`);
  }
  return { tenantKey: match[1], mentorId: match[2] };
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
  await expect(createButton).toBeVisible({ timeout: 10000 });
  await createButton.click();

  // Wait for the create workflow modal
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });

  // Fill in the workflow name
  const nameInput = modal.getByRole('textbox');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(workflowName);

  // Submit the form
  const submitButton = modal.getByRole('button', { name: /create/i });
  await expect(submitButton).toBeEnabled({ timeout: 5000 });
  await submitButton.click();

  // Wait for navigation to the workflow detail page
  await safeWaitForURL(page, (url) => url.href.includes('/workflows/'), {
    timeout: 30000,
  });

  logger.info(`Created workflow: ${workflowName}`);
  return workflowName;
}

/**
 * Wait for the workflow editor to be ready (canvas loaded).
 */
export async function waitForWorkflowEditorReady(page: Page): Promise<void> {
  // Wait for the Save button to indicate the editor toolbar is loaded
  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible({ timeout: 30000 });

  // Wait for the canvas to render (React Flow viewport)
  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible({ timeout: 30000 });

  logger.info('Workflow editor is ready');
}

/**
 * Click the back button to return to the workflows list.
 */
export async function navigateBackToWorkflowsList(page: Page): Promise<void> {
  // The back button is a ghost button with ChevronLeft icon
  const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') });
  await expect(backButton).toBeVisible({ timeout: 10000 });
  await backButton.click();

  // Wait for the workflows list page to load
  const heading = page.getByRole('heading', { name: 'Workflows' });
  await expect(heading).toBeVisible({ timeout: 30000 });

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
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(searchTerm);

  // Allow debounced search to trigger
  await page.waitForTimeout(1000);
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
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();

  // Wait for the editor to load
  await waitForWorkflowEditorReady(page);
  logger.info(`Opened workflow: ${workflowName}`);
}

/**
 * Delete the currently open workflow via the more options menu.
 */
export async function deleteCurrentWorkflow(page: Page): Promise<void> {
  // Open the more options dropdown
  const moreButton = page.locator('button').filter({ has: page.locator('svg.lucide-more-horizontal') });
  await expect(moreButton).toBeVisible({ timeout: 10000 });
  await moreButton.click();

  // Click Delete
  const deleteItem = page.getByRole('menuitem', { name: 'Delete' });
  await expect(deleteItem).toBeVisible({ timeout: 5000 });
  await deleteItem.click();

  // Confirm deletion in the modal
  const deleteModal = page.getByRole('dialog');
  await expect(deleteModal).toBeVisible({ timeout: 10000 });

  const confirmButton = deleteModal.getByRole('button', { name: /delete/i });
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();

  // Wait for navigation back to the list page
  const heading = page.getByRole('heading', { name: 'Workflows' });
  await expect(heading).toBeVisible({ timeout: 30000 });

  logger.info('Deleted workflow');
}

/**
 * Edit the workflow name inline.
 */
export async function editWorkflowName(
  page: Page,
  newName: string,
): Promise<void> {
  // Click the workflow name button (has pencil icon)
  const nameButton = page.locator('button').filter({ has: page.locator('svg.lucide-pencil') });
  await expect(nameButton).toBeVisible({ timeout: 10000 });
  await nameButton.click();

  // Fill the input that appears
  const nameInput = page.locator('input[autofocus]');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(newName);
  await nameInput.press('Enter');

  logger.info(`Renamed workflow to: ${newName}`);
}

/**
 * Click the Preview button to enter preview mode.
 */
export async function enterPreviewMode(page: Page): Promise<void> {
  const previewButton = page.getByRole('button', { name: 'Preview' });
  await expect(previewButton).toBeVisible({ timeout: 10000 });
  await previewButton.click();

  // Wait for preview mode UI (Close preview button appears)
  const closePreview = page.getByRole('button', { name: 'Close preview' });
  await expect(closePreview).toBeVisible({ timeout: 10000 });

  logger.info('Entered preview mode');
}

/**
 * Exit preview mode.
 */
export async function exitPreviewMode(page: Page): Promise<void> {
  const closePreview = page.getByRole('button', { name: 'Close preview' });
  await expect(closePreview).toBeVisible({ timeout: 10000 });
  await closePreview.click();

  // Wait for the editor toolbar to reappear
  const previewButton = page.getByRole('button', { name: 'Preview' });
  await expect(previewButton).toBeVisible({ timeout: 10000 });

  logger.info('Exited preview mode');
}

/**
 * Click the Save button.
 */
export async function saveWorkflow(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible({ timeout: 10000 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Wait briefly for save operation
  await page.waitForTimeout(2000);
  logger.info('Saved workflow');
}

/**
 * Click the Publish button.
 */
export async function publishWorkflow(page: Page): Promise<void> {
  const publishButton = page.getByRole('button', { name: 'Publish' });
  await expect(publishButton).toBeVisible({ timeout: 10000 });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();

  // Wait for publish to process
  await page.waitForTimeout(3000);
  logger.info('Published workflow');
}

/**
 * Get the workflow status badge text (Active or Draft).
 */
export async function getWorkflowStatus(page: Page): Promise<string> {
  const activeBadge = page.locator('span').filter({ hasText: /^Active$/ }).first();
  const draftBadge = page.locator('span').filter({ hasText: /^Draft$/ }).first();

  const isActive = await activeBadge.isVisible().catch(() => false);
  if (isActive) return 'Active';

  const isDraft = await draftBadge.isVisible().catch(() => false);
  if (isDraft) return 'Draft';

  return 'Unknown';
}
