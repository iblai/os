import { Page, Locator, Request, expect, test } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { safeWaitForURL } from './navigation';

/**
 * Navigate to the workflows list page via the sidebar Workflows button.
 * This avoids a full page.goto() which can lose client-side auth tokens.
 */
export async function navigateToWorkflowsPage(page: Page): Promise<void> {
  // Sidebar "Workflows" is now a collapsible section (same pattern as
  // Agents / Chats / Projects / Analytics). Scope to the `<aside>`
  // landmark, then idempotently expand via `aria-expanded` so we don't
  // accidentally collapse an already-open section by clicking twice.
  const sidebar = page.locator('aside').first();
  const workflowsButton = sidebar.getByRole('button', {
    name: 'Workflows',
    exact: true,
  });
  await expect(workflowsButton).toBeVisible({ timeout: 15_000 });
  const expanded = await workflowsButton
    .getAttribute('aria-expanded')
    .catch(() => null);
  if (expanded !== 'true') {
    await workflowsButton.click();
    await expect(workflowsButton).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5_000,
    });
  }

  const myWorkflowsLink = sidebar.getByRole('button', {
    name: 'My Workflows',
    exact: true,
  });
  await expect(myWorkflowsLink).toBeVisible({ timeout: 10_000 });
  await myWorkflowsLink.click();

  await safeWaitForURL(page, (url) => url.href.includes('/workflows/'), {
    timeout: 60_000,
  });

  const heading = page.getByRole('heading', {
    name: 'Workflows',
    level: 1,
    exact: true,
  });
  const errorFallback = page.getByText('Failed to load workflows');
  const searchInput = page.getByPlaceholder('Search workflows...');

  // Readiness race. The <h1> "Workflows" is the obvious success signal,
  // but it is matched by ROLE — so a stale `aria-hidden` lingering on the
  // app shell (e.g. left by a dialog/overlay close earlier in the flow)
  // drops it from the accessibility tree even though it renders, and the
  // role query returns nothing. The search input is matched by its
  // `placeholder` attribute, which survives a hidden ancestor, so include
  // it as an aria-hidden-immune success signal. Race both against the
  // error branch (the page renders only an error placeholder when
  // useGetWorkflowsQuery fails on a transient 401/403 auth-token race)
  // so we still fail fast with a clear message. 60s absorbs a slow
  // AppLayout mentor-settings gate under CI load. `.first()` because the
  // h1 and the search input both render on success, so the union resolves
  // to >1 element — `toBeVisible` is strict-mode and would otherwise throw.
  await expect(heading.or(searchInput).or(errorFallback).first()).toBeVisible({
    timeout: 60_000,
  });
  if (await errorFallback.isVisible().catch(() => false)) {
    throw new Error(
      'Workflows page rendered error state (useGetWorkflowsQuery failed) — likely auth/token race after sidebar navigation',
    );
  }
  // The search input is the stable, aria-hidden-immune signal callers
  // care about — assert it directly as the final readiness gate.
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
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
  // Exact name — NOT a loose 'Save' substring match. The always-present
  // chat-privacy toggle's aria-label ("...This chat won't be saved to
  // history...") substring-matches "Save", so a non-exact locator resolves
  // to BOTH that toggle and the real Save button → strict-mode violation.
  const saveButton = page.getByRole('button', { name: 'Save', exact: true });
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

  const heading = page.getByRole('heading', {
    name: 'Workflows',
    level: 1,
    exact: true,
  });
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

  const heading = page.getByRole('heading', {
    name: 'Workflows',
    level: 1,
    exact: true,
  });
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
  // Exact name — see waitForWorkflowEditorReady: a loose 'Save' also matches
  // the chat-privacy toggle's aria-label ("...won't be saved to history...").
  const saveButton = page.getByRole('button', { name: 'Save', exact: true });
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

export const WORKFLOW_PANEL = '[data-testid="workflow-node-panel"]';

type NodeData = Record<string, any>;

export interface SavedNode {
  id: string;
  type: string;
  data: NodeData;
}

export interface SavedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface SavedDefinition {
  nodes: SavedNode[];
  edges: SavedEdge[];
}

export interface AutosaveResult {
  definition: SavedDefinition;
  /** Raw body of the validate call that follows the auto-save. */
  validation: string;
}

export function generateWorkflowName(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `E2E Workflow ${Date.now()}-${test.info().parallelIndex}-${rand}`;
}

export function nodeOfType(
  definition: SavedDefinition,
  type: string,
): SavedNode | undefined {
  return definition.nodes.find((node) => node.type === type);
}

/**
 * Run `body`, then delete the open workflow. After a failure the delete is
 * best-effort, so a cleanup error never hides the real one.
 */
export async function deleteWorkflowAfter(
  page: Page,
  body: () => Promise<void>,
): Promise<void> {
  let passed = false;
  try {
    await body();
    passed = true;
  } finally {
    const cleanup = (async () => {
      // The open panel's header buttons would sit over "More workflow options".
      const closeButton = nodePanel(page).getByRole('button', {
        name: 'Close',
        exact: true,
      });
      if ((await closeButton.count()) > 0) await closeButton.click();
      await deleteCurrentWorkflow(page);
    })();
    if (passed) await cleanup;
    else await cleanup.catch(() => {});
  }
}

export async function withFreshWorkflow(
  page: Page,
  body: () => Promise<void>,
): Promise<void> {
  await navigateToWorkflowsPage(page);
  await createWorkflow(page, generateWorkflowName());
  await waitForWorkflowEditorReady(page);
  await deleteWorkflowAfter(page, body);
}

const WORKFLOW_PATCH_URL = /\/workflows\/[^/?]+\/?(\?.*)?$/;
const WORKFLOW_VALIDATE_URL = /\/workflows\/[^/]+\/validate\/?$/;

function savedDefinitionOf(body: unknown): SavedDefinition | null {
  const definition = (body as { definition?: SavedDefinition } | null)
    ?.definition;
  return definition && Array.isArray(definition.nodes) ? definition : null;
}

/**
 * Run `action`, then return the first auto-save PATCH body that satisfies
 * `matches` together with the validate response that follows it. The editor
 * debounces edits by 1s, so intermediate saves are skipped by the predicate.
 */
export async function captureAutosave(
  page: Page,
  action: () => Promise<void>,
  matches: (definition: SavedDefinition) => boolean = () => true,
): Promise<AutosaveResult> {
  const timeout = 60_000;
  // Armed before `action` runs. The editor validates only after its PATCH
  // returns, and an earlier save's validate call can still be in flight, so
  // the validate request is taken only once the matched PATCH has answered.
  let saved: Request | null = null;
  let savedAnswered = false;
  const patchRequest = page.waitForRequest(
    (request) => {
      if (saved || request.method() !== 'PATCH') return false;
      if (!WORKFLOW_PATCH_URL.test(new URL(request.url()).pathname))
        return false;
      try {
        const definition = savedDefinitionOf(request.postDataJSON());
        if (!definition || !matches(definition)) return false;
      } catch {
        return false;
      }
      saved = request;
      return true;
    },
    { timeout },
  );
  const patchResponse = page.waitForResponse(
    (response) => {
      if (!saved || response.request() !== saved) return false;
      savedAnswered = true;
      return true;
    },
    { timeout },
  );
  const validateRequest = page.waitForRequest(
    (request) =>
      savedAnswered &&
      request.method() === 'POST' &&
      WORKFLOW_VALIDATE_URL.test(new URL(request.url()).pathname),
    { timeout },
  );
  for (const waiter of [patchRequest, patchResponse, validateRequest]) {
    waiter.catch(() => {});
  }

  await action();
  const request = await patchRequest;
  await patchResponse;
  const validation = await (await validateRequest).response();
  expect(validation, 'validate call after the auto-save').not.toBeNull();

  return {
    definition: savedDefinitionOf(request.postDataJSON()) as SavedDefinition,
    validation: await validation!.text(),
  };
}

/**
 * Run `action` (a Save click) and return the definition of the PATCH it sends.
 * Unlike an auto-save, a manual save is not followed by a validate call.
 */
export async function captureManualSave(
  page: Page,
  action: () => Promise<void>,
): Promise<SavedDefinition> {
  const patchRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' &&
      WORKFLOW_PATCH_URL.test(new URL(request.url()).pathname),
    { timeout: 30_000 },
  );
  patchRequest.catch(() => {});
  await action();
  const request = await patchRequest;
  const definition = savedDefinitionOf(request.postDataJSON());
  expect(definition, 'definition in the Save request').not.toBeNull();
  return definition as SavedDefinition;
}

export function recordWorkflowPatches(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'PATCH' &&
      WORKFLOW_PATCH_URL.test(new URL(request.url()).pathname)
    ) {
      urls.push(request.url());
    }
  });
  return urls;
}

export function canvasNode(page: Page, nodeId: string): Locator {
  return page.locator(`[data-testid="workflow-node-${nodeId}"]`);
}

export function canvasEdge(page: Page, edgeId: string): Locator {
  return page.locator(`[data-testid="workflow-edge-${edgeId}"]`);
}

export function nodePanel(page: Page): Locator {
  return page.locator(WORKFLOW_PANEL);
}

/**
 * Click a sidebar item (e.g. "Set State") and return the id of the node it
 * adds to the canvas.
 */
export async function addNodeFromSidebar(
  page: Page,
  label: string,
  nodeType: string,
): Promise<string> {
  const item = page.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();

  const node = page.locator(`[data-node-type="${nodeType}"]`).last();
  await expect(node).toBeVisible({ timeout: 10_000 });
  const testId = await node.getAttribute('data-testid');
  return testId!.replace('workflow-node-', '');
}

export async function openNodePanel(
  page: Page,
  nodeId: string,
): Promise<Locator> {
  await canvasNode(page, nodeId).click();
  const panel = nodePanel(page);
  await expect(panel).toBeVisible({ timeout: 10_000 });
  return panel;
}

export async function closeNodePanel(page: Page): Promise<void> {
  const panel = nodePanel(page);
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(panel).toBeHidden({ timeout: 5_000 });
}

/** Add a state variable through the Start step's "Add State Variable" dialog. */
export async function addStartVariable(
  page: Page,
  variable: {
    name: string;
    type: 'String' | 'Number' | 'Boolean' | 'Object' | 'List';
    defaultValue?: string;
  },
): Promise<void> {
  await nodePanel(page)
    .getByRole('button', { name: 'Add', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Add State Variable' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  await dialog
    .getByRole('button', { name: variable.type, exact: true })
    .click();
  await dialog.locator('#var-name').fill(variable.name);
  if (variable.defaultValue !== undefined) {
    const defaultField = dialog.locator('#var-default');
    if (variable.type === 'Boolean') {
      if (variable.defaultValue === 'true') await defaultField.click();
    } else {
      await defaultField.fill(variable.defaultValue);
    }
  }
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

/** Create a variable from a Set State row: "New" -> "New Variable" dialog. */
export async function createVariableFromSetState(
  page: Page,
  name: string,
): Promise<void> {
  await nodePanel(page)
    .getByRole('button', { name: 'New', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'New Variable' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.locator('#new-variable-name').fill(name);
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

/**
 * Select a connection by pressing on its hit path. The press lands a third of
 * the way along the path: the midpoint is where the Delete Connection button
 * appears on hover, and it would swallow the press.
 */
export async function selectConnection(
  page: Page,
  edgeId: string,
): Promise<void> {
  const hitPath = canvasEdge(page, edgeId);
  await expect(hitPath).toBeAttached({ timeout: 10_000 });
  const point = await hitPath.evaluate((element) => {
    const path = element as unknown as SVGGeometryElement;
    const onPath = path.getPointAtLength(path.getTotalLength() * 0.35);
    const matrix = path.getScreenCTM()!;
    return {
      x: matrix.a * onPath.x + matrix.c * onPath.y + matrix.e,
      y: matrix.b * onPath.x + matrix.d * onPath.y + matrix.f,
    };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(
    page.locator(`[data-testid="workflow-edge-delete-${edgeId}"]`),
  ).toBeVisible({ timeout: 5_000 });
}

/**
 * Zoom the canvas out to its 50% minimum. A new step goes inside the canvas
 * only when a free spot fits there: beside the default steps a 280px If / Else
 * or While card can still land past the clipped right edge, or with its lower
 * handle under the zoom toolbar. At 50% every step sits clear of both.
 */
async function zoomCanvasOut(page: Page): Promise<void> {
  const canvas = page.locator('[data-testid="workflow-canvas"]');
  const zoomOut = page.getByRole('button', { name: 'Zoom Out', exact: true });
  for (let click = 0; click < 5; click++) await zoomOut.click();
  await expect(canvas.getByText(/^\d+%$/)).toHaveText('50%');
}

/**
 * Drag from a step's output handle onto another step. The handle is
 * transparent until its step is hovered, but it takes the pointer all the same.
 */
export async function connectHandle(
  page: Page,
  fromNodeId: string,
  handle: string,
  toNodeId: string,
): Promise<void> {
  await zoomCanvasOut(page);
  await page
    .locator(`[data-testid="workflow-handle-${fromNodeId}-${handle}"]`)
    .hover();
  await page.mouse.down();
  const target = canvasNode(page, toNodeId);
  // The drop target comes from the step's mouseenter state, so the second
  // move gives React time to commit it before the button is released.
  await target.hover();
  await target.hover();
  await page.mouse.up();
  await expect(
    canvasEdge(page, `e-${fromNodeId}-${handle}-${toNodeId}`),
  ).toBeAttached({ timeout: 5_000 });
}
