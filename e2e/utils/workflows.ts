import {
  Page,
  Locator,
  Request,
  Response,
  expect,
  test,
} from '@playwright/test';
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

  const modal = page.getByRole('dialog', { name: 'Create Workflow' });
  await expect(modal).toBeVisible({ timeout: 10_000 });

  const nameInput = modal.getByRole('textbox');
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill(workflowName);

  const submitButton = modal.getByRole('button', {
    name: 'Create',
    exact: true,
  });
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
 * Return to the workflows list through the sidebar: the editor has no back
 * arrow.
 */
export async function navigateBackToWorkflowsList(page: Page): Promise<void> {
  await navigateToWorkflowsPage(page);

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
 * The editor header shows Delete, Activate / Deactivate, Preview, Save and
 * Publish as buttons while they fit and moves them, in that order, into "More
 * workflow options" as it narrows. Returns the inline button when the header
 * shows one, otherwise opens the menu and returns its item.
 */
export async function workflowHeaderAction(
  page: Page,
  name: string,
): Promise<Locator> {
  const header = page.getByTestId('workflow-header-actions');
  // Settle first: until it has measured, the header guesses which actions fit
  // and can still move one between the bar and the menu.
  await expect(header).toHaveAttribute('data-fit', 'done', {
    timeout: 10_000,
  });
  const inline = header.getByRole('button', { name, exact: true });
  const moreButton = page.getByRole('button', {
    name: 'More workflow options',
  });
  // A menu just closed with Escape stays in the page while it fades out; only
  // an open one counts, so a closing menu is opened again.
  const menuItem = page
    .locator('[role="menu"][data-state="open"]')
    .getByRole('menuitem', { name, exact: true });
  let action = menuItem;
  // Retried: a resize just before (a test changing the window) can move the
  // action between the bar and the menu while this looks for it.
  await expect(async () => {
    if (await inline.isVisible()) {
      action = inline;
      return;
    }
    if (!(await menuItem.isVisible())) {
      await moreButton.click({ timeout: 2_000 });
    }
    await expect(menuItem).toBeVisible({ timeout: 2_000 });
    action = menuItem;
  }).toPass({ timeout: 15_000 });
  return action;
}

/**
 * Delete the currently open workflow from its header.
 */
export async function deleteCurrentWorkflow(page: Page): Promise<void> {
  const deleteAction = await workflowHeaderAction(page, 'Delete');
  await expect(deleteAction).toBeVisible({ timeout: 5_000 });
  await deleteAction.click();

  const deleteModal = page.getByRole('alertdialog', {
    name: 'Delete Workflow',
  });
  await expect(deleteModal).toBeVisible({ timeout: 10_000 });

  const confirmButton = deleteModal.getByRole('button', {
    name: 'Delete',
    exact: true,
  });
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
  const nameButton = page.getByRole('button', { name: 'Edit Workflow Name' });
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

const WORKFLOW_PUBLISH_URL = /\/workflows\/[^/]+\/publish\/?$/;

/**
 * Click the Publish button.
 */
export async function publishWorkflow(page: Page): Promise<Response> {
  const publishButton = page.getByRole('button', { name: 'Publish' });
  await expect(publishButton).toBeVisible({ timeout: 10_000 });
  await expect(publishButton).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        WORKFLOW_PUBLISH_URL.test(new URL(resp.url()).pathname),
      { timeout: 30_000 },
    ),
    publishButton.click(),
  ]);
  logger.info(`Published workflow: ${response.status()}`);
  return response;
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
      // A failure can leave a dialog open (the agent picker, Edit Agent), and
      // a modal one hides the editor from every locator below.
      if (!passed) {
        for (let press = 0; press < 2; press++) {
          await page.keyboard.press('Escape');
        }
      }
      // Delete is only in the edit header, and the open panel's header
      // buttons would sit over it.
      const closePreview = page.getByRole('button', { name: 'Close preview' });
      if ((await closePreview.count()) > 0) await exitPreviewMode(page);
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

function savesDefinition(
  request: Request,
  matches: (definition: SavedDefinition) => boolean,
): boolean {
  if (request.method() !== 'PATCH') return false;
  if (!WORKFLOW_PATCH_URL.test(new URL(request.url()).pathname)) return false;
  try {
    const definition = savedDefinitionOf(request.postDataJSON());
    return !!definition && matches(definition);
  } catch {
    return false;
  }
}

/**
 * Resolve with the first saved definition that satisfies `matches`, whether
 * an auto-save or a save the editor makes before another action sends it.
 * Call it before the change that leads to the save.
 */
export function waitForDefinitionSave(
  page: Page,
  matches: (definition: SavedDefinition) => boolean,
): Promise<SavedDefinition> {
  const saved = page
    .waitForRequest((request) => savesDefinition(request, matches), {
      timeout: 60_000,
    })
    .then(
      (request) => savedDefinitionOf(request.postDataJSON()) as SavedDefinition,
    );
  saved.catch(() => {});
  return saved;
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
      if (saved || !savesDefinition(request, matches)) return false;
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

/**
 * Add a step, wait until it is auto-saved and return it as saved. The editor
 * only saves a graph that differs from its last save, so a step added and
 * removed within one debounce window never sends a request.
 */
export async function addSavedNodeFromSidebar(
  page: Page,
  label: string,
  nodeType: string,
): Promise<SavedNode> {
  const before = await page.locator(`[data-node-type="${nodeType}"]`).count();
  let nodeId = '';
  const { definition } = await captureAutosave(
    page,
    async () => {
      nodeId = await addNodeFromSidebar(page, label, nodeType);
    },
    (saved) =>
      saved.nodes.filter((node) => node.type === nodeType).length > before,
  );
  const node = nodeById(definition, nodeId);
  expect(node, `${label} step in the saved definition`).toBeDefined();
  return node!;
}

export function nodeById(
  definition: SavedDefinition,
  nodeId: string,
): SavedNode | undefined {
  return definition.nodes.find((node) => node.id === nodeId);
}

/** The "Not connected" note a branch row shows until its output is wired. */
export function unconnectedBranch(
  page: Page,
  nodeId: string,
  handle: string,
): Locator {
  return page.getByTestId(`workflow-branch-unconnected-${nodeId}-${handle}`);
}

/** Every error and warning in a validate response body. */
export function validationMessages(body: string): string[] {
  const { errors = [], warnings = [] } = JSON.parse(body) as {
    errors?: string[];
    warnings?: string[];
  };
  return [...errors, ...warnings];
}

/**
 * The validation messages about one step's own settings, however they are
 * worded, leaving out the ones about its connections. Backend #3218 ties each
 * message to its step in error_details / warning_details; before it, a
 * message carried " at nodes[<index>]..." for the step's place in the saved
 * definition.
 */
export function stepMessages(
  body: string,
  definition: SavedDefinition,
  nodeId: string,
): string[] {
  const index = definition.nodes.findIndex((node) => node.id === nodeId);
  expect(index, `${nodeId} in the saved definition`).toBeGreaterThanOrEqual(0);
  const parsed = JSON.parse(body) as {
    error_details?: IssueDetail[];
    warning_details?: IssueDetail[];
  };
  if (parsed.error_details || parsed.warning_details) {
    return [...(parsed.error_details ?? []), ...(parsed.warning_details ?? [])]
      .filter(
        (detail) =>
          detail.node_id === nodeId &&
          !detail.edge_id &&
          !/connect/i.test(detail.message),
      )
      .map((detail) => detail.message);
  }
  return validationMessages(body).filter((message) =>
    message.includes(` at nodes[${index}]`),
  );
}

interface IssueDetail {
  message: string;
  node_id: string | null;
  edge_id: string | null;
}

/**
 * The missing End error in either backend wording: #3163 says the workflow
 * "must have an 'end' node", #3218 says "Add an End step".
 */
export const MISSING_END = /'end' node|an End step\b/;

/**
 * A backend validation message without the " at <context> (field: <name>)"
 * the API appends, so a check matches the banner line with or without it.
 */
export function validationMessageText(message: string): string {
  return message.replace(/ at \S+( \(field: [^)]*\))?$/, '');
}

const WORKFLOW_DETAIL_URL =
  /\/api\/ai-mentor\/orgs\/[^/]+\/workflows\/[^/?]+\/?(\?.*)?$/;

/**
 * Answer every workflow GET with the real workflow plus the fields `fields`
 * returns at that moment, so a test can change what the next refetch says.
 */
export async function overrideWorkflowFields(
  page: Page,
  fields: () => Record<string, unknown>,
): Promise<void> {
  await page.route(WORKFLOW_DETAIL_URL, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    // workflows/node-types/ matches this pattern too; only the workflow
    // itself carries a definition.
    if (!body?.unique_id || !Array.isArray(body.definition?.nodes)) {
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({ response, json: { ...body, ...fields() } });
  });
}

/**
 * Give the next workflow the editor loads an End step after its Agent step.
 * The backend refuses to publish a workflow without one, and a new workflow
 * has only Start and Agent. Call it before the workflow is opened.
 */
export async function addEndStepOnLoad(page: Page): Promise<void> {
  let added = false;
  await page.route(WORKFLOW_DETAIL_URL, async (route) => {
    if (added || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    // workflows/node-types/ matches this pattern too; only the workflow
    // itself carries a definition.
    if (!body?.unique_id || !Array.isArray(body.definition?.nodes)) {
      await route.fulfill({ response });
      return;
    }
    added = true;
    body.definition.nodes = [
      ...body.definition.nodes,
      {
        id: 'end-1',
        type: 'end',
        position: { x: 700, y: 250 },
        data: { label: 'End' },
      },
    ];
    body.definition.edges = [
      ...(body.definition.edges ?? []),
      {
        id: 'e-mentor-1-right-end-1',
        source: 'mentor-1',
        target: 'end-1',
        sourceHandle: 'right',
      },
    ];
    await route.fulfill({ response, json: body });
  });
}

const CLASSIFIER_TEST_URL = /\/workflows\/[^/]+\/classifier-test\/?(\?.*)?$/;

/**
 * Answer every classifier Try with `result` instead of calling the decision
 * model (each real try uses credits). Returns the Try requests as they come.
 */
export async function mockClassifierTry(
  page: Page,
  result: Record<string, unknown>,
): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route(CLASSIFIER_TEST_URL, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    requests.push(route.request());
    await route.fulfill({ json: result });
  });
  return requests;
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

/**
 * Open the Insert Variable or Step picker of the one reference field in
 * `scope`, search for `query` and choose the item that matches it.
 */
export async function insertFromPicker(
  page: Page,
  scope: Locator,
  query: string,
): Promise<void> {
  await scope
    .getByRole('button', { name: 'Insert Variable or Step', exact: true })
    .click();
  const search = page.getByPlaceholder('Search variables and steps');
  await expect(search).toBeVisible({ timeout: 5_000 });
  await search.fill(query);
  await page.getByRole('option', { name: new RegExp(query) }).click();
  await expect(search).toBeHidden({ timeout: 5_000 });
}

/** Where the caret sits in a text field. */
export async function caretOf(field: Locator): Promise<number | null> {
  return field.evaluate(
    (element) =>
      (element as HTMLInputElement | HTMLTextAreaElement).selectionStart,
  );
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
 * The screen point `fraction` of the way along a connection's hit path. A
 * point, not the path's box: a level connection's box has no height.
 */
export async function connectionPoint(
  page: Page,
  edgeId: string,
  fraction: number,
): Promise<Point> {
  const hitPath = canvasEdge(page, edgeId);
  await expect(hitPath).toBeAttached({ timeout: 10_000 });
  return hitPath.evaluate((element, along) => {
    const path = element as unknown as SVGGeometryElement;
    const onPath = path.getPointAtLength(path.getTotalLength() * along);
    const matrix = path.getScreenCTM()!;
    return {
      x: matrix.a * onPath.x + matrix.c * onPath.y + matrix.e,
      y: matrix.b * onPath.x + matrix.d * onPath.y + matrix.f,
    };
  }, fraction);
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
  const point = await connectionPoint(page, edgeId, 0.35);
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
 * Drag from a step's output handle onto another step: `right` for a step with
 * one output, otherwise the branch's handle (`condition-0`, `else`, …). The
 * handle is transparent until its step is hovered, but it takes the pointer
 * all the same.
 */
export async function connectHandle(
  page: Page,
  fromNodeId: string,
  handle: string,
  toNodeId: string,
): Promise<void> {
  await zoomCanvasOut(page);
  // Only branch outputs have a test id. A step's single output dot is the one
  // element on its card positioned with -right-2.
  const dot =
    handle === 'right'
      ? canvasNode(page, fromNodeId).locator('[class~="-right-2"]')
      : page.locator(`[data-testid="workflow-handle-${fromNodeId}-${handle}"]`);
  await dot.hover();
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

export const REFUND_CONDITION = "'refund' in input";
export const REFUND_REPLY = 'Refund path';
export const GENERAL_REPLY = 'General path';

export interface RefundRouter extends AutosaveResult {
  ifElseId: string;
  refundId: string;
  generalId: string;
  endId: string;
}

/**
 * Replace the default Agent step with Start -> If / Else (REFUND_CONDITION on
 * the user's message) -> one Transform per branch -> End, and return it once
 * it is saved. Each Transform sets `output`, which the backend's End step
 * sends as the reply, so a run answers REFUND_REPLY or GENERAL_REPLY exactly,
 * with no model involved.
 */
export async function buildRefundRouter(page: Page): Promise<RefundRouter> {
  const agentNode = canvasNode(page, 'mentor-1');
  await agentNode.hover();
  await captureAutosave(
    page,
    () => agentNode.getByRole('button', { name: /^Delete / }).click(),
    (definition) => !nodeOfType(definition, 'mentor'),
  );

  // The If / Else goes last: with it in the middle of the view, every spot
  // the editor tries for a new step overlaps it, and the steps added after it
  // all land on the same fallback spot, one on top of the other.
  const refundId = await addNodeFromSidebar(page, 'Transform', 'transform');
  const generalId = await addNodeFromSidebar(page, 'Transform', 'transform');
  const endId = await addNodeFromSidebar(page, 'End', 'end');
  const ifElseId = await addNodeFromSidebar(page, 'If / Else', 'conditional');

  const ifPanel = await openNodePanel(page, ifElseId);
  await ifPanel
    .getByRole('textbox', { name: 'If', exact: true })
    .fill(REFUND_CONDITION);
  await closeNodePanel(page);
  const replies: [string, string][] = [
    [refundId, REFUND_REPLY],
    [generalId, GENERAL_REPLY],
  ];
  for (const [nodeId, reply] of replies) {
    const panel = await openNodePanel(page, nodeId);
    await panel.getByLabel('Key', { exact: true }).fill('output');
    await panel.getByLabel('Value', { exact: true }).fill(`'${reply}'`);
    await closeNodePanel(page);
  }

  const connections: [string, string, string][] = [
    ['start', 'right', ifElseId],
    [ifElseId, 'condition-0', refundId],
    [ifElseId, 'else', generalId],
    [refundId, 'right', endId],
    [generalId, 'right', endId],
  ];
  const isBuilt = (definition: SavedDefinition) =>
    connections.every(([source, handle, target]) =>
      definition.edges.some(
        (edge) =>
          edge.source === source &&
          edge.sourceHandle === handle &&
          edge.target === target,
      ),
    ) &&
    nodeById(definition, ifElseId)?.data.conditions?.[0]?.expression ===
      REFUND_CONDITION &&
    replies.every(([nodeId, reply]) => {
      const row = nodeById(definition, nodeId)?.data.expressions?.[0];
      return row?.target === 'output' && row?.expression === `'${reply}'`;
    });
  for (const connection of connections.slice(0, -1)) {
    await connectHandle(page, ...connection);
  }
  const saved = await captureAutosave(
    page,
    () => connectHandle(page, ...connections[connections.length - 1]),
    isBuilt,
  );
  return { ...saved, ifElseId, refundId, generalId, endId };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * withFreshWorkflow at the test's phone size. The list is reached at desktop
 * width, where the app's sidebar is on screen, and the workflow is created at
 * phone size so the editor opens as it does on a phone. Cleanup runs at
 * desktop width, where exitPreviewMode finds Preview as a header button.
 */
export async function withFreshPhoneWorkflow(
  page: Page,
  body: () => Promise<void>,
): Promise<void> {
  const phone = page.viewportSize();
  expect(phone, 'phone viewport from test.use').not.toBeNull();
  const desktop = { width: 1280, height: phone!.height };
  await page.setViewportSize(desktop);
  await navigateToWorkflowsPage(page);
  await page.setViewportSize(phone!);
  await createWorkflow(page, generateWorkflowName());
  await deleteWorkflowAfter(page, async () => {
    try {
      await expect(
        page.getByRole('button', { name: 'Add Step', exact: true }),
      ).toBeVisible({ timeout: 30_000 });
      // The first validation adds the banner above the canvas a second or so
      // after load and moves every step down, so a tap aimed before it lands
      // on the wrong spot. A new workflow always has the missing End error.
      await expect(
        page.getByTestId('workflow-validation-list').getByText(MISSING_END),
        'the banner from the validation on open',
      ).toBeVisible({ timeout: 30_000 });
      // Unfitted, the Agent step starts at x 350 and runs past a 393px
      // screen; only the editor's fit-to-view puts the whole of it on screen.
      // 0.99, not 1: the fitted edge can fall a fraction of a pixel off it.
      await expect(canvasNode(page, 'start')).toBeInViewport({
        ratio: 0.99,
        timeout: 15_000,
      });
      await expect(canvasNode(page, 'mentor-1')).toBeInViewport({
        ratio: 0.99,
        timeout: 15_000,
      });
      await body();
    } finally {
      await page.setViewportSize(desktop);
    }
  });
}

/**
 * Phone counterpart of addNodeFromSidebar: below 768px the step list is a
 * sheet behind the canvas's Add Step button, and tapping a step adds it and
 * closes the sheet.
 */
export async function addNodeFromStepSheet(
  page: Page,
  label: string,
  nodeType: string,
): Promise<string> {
  const nodes = page.locator(`[data-node-type="${nodeType}"]`);
  const before = await nodes.count();
  await page.getByRole('button', { name: 'Add Step', exact: true }).tap();
  const sheet = page.getByRole('dialog', { name: 'Add Step', exact: true });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await sheet.getByRole('button', { name: label, exact: true }).tap();
  await expect(sheet).toBeHidden({ timeout: 5_000 });
  await expect(nodes).toHaveCount(before + 1, { timeout: 10_000 });
  const testId = await nodes.last().getAttribute('data-testid');
  return testId!.replace('workflow-node-', '');
}

/**
 * A one- or two-finger touch gesture: each finger goes down at `from`, moves
 * to `to` in even steps, and all lift together. Sent through CDP because
 * Playwright's touchscreen only taps, so Chromium only.
 */
export async function touchGesture(
  page: Page,
  fingers: { from: Point; to: Point }[],
  steps = 12,
): Promise<void> {
  const at = (step: number) =>
    fingers.map(({ from, to }, id) => ({
      id,
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    }));
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: at(0),
    });
    for (let step = 1; step <= steps; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: at(step),
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}

/**
 * A point on bare canvas `offsetX` from the middle, 100px from the top: below
 * the Add Step button and above the steps a phone fits into view.
 */
export async function bareCanvasPoint(page: Page, offsetX = 0): Promise<Point> {
  const box = await page.getByTestId('workflow-canvas').boundingBox();
  expect(box, 'canvas on screen').not.toBeNull();
  const point = { x: box!.x + box!.width / 2 + offsetX, y: box!.y + 100 };
  const bare = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return (
      !!hit?.closest('[data-testid="workflow-canvas"]') &&
      !hit.closest(
        '[data-node-type], [data-testid="workflow-node-panel"], button',
      )
    );
  }, point);
  expect(
    bare,
    `bare canvas at ${Math.round(point.x)},${Math.round(point.y)}`,
  ).toBe(true);
  return point;
}

export async function centreOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  expect(box, 'element on screen').not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** centreOf once two reads 150ms apart agree, for a raw touch to aim at. */
export async function settledCentreOf(locator: Locator): Promise<Point> {
  let point: Point = { x: 0, y: 0 };
  let last = '';
  await expect
    .poll(
      async () => {
        point = await centreOf(locator);
        const now = `${Math.round(point.x)},${Math.round(point.y)}`;
        const settled = now === last;
        last = now;
        return settled;
      },
      { message: 'the canvas stops moving', intervals: [150], timeout: 10_000 },
    )
    .toBe(true);
  return point;
}
