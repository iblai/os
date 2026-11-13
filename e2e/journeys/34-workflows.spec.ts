import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';
import { ChatPage } from '../page-objects/chat.page';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { parsePlatformUrl } from '../utils/navigation';
import { putMentorVmNetworkSettings } from '../utils/virtual-machine-api';
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
  addEndStepOnLoad,
  getWorkflowStatus,
  withFreshWorkflow,
  deleteWorkflowAfter,
  generateWorkflowName,
  captureAutosave,
  captureManualSave,
  addNodeFromSidebar,
  addSavedNodeFromSidebar,
  openNodePanel,
  closeNodePanel,
  addStartVariable,
  createVariableFromSetState,
  selectConnection,
  connectionPoint,
  connectHandle,
  canvasNode,
  canvasEdge,
  nodePanel,
  nodeOfType,
  nodeById,
  recordWorkflowPatches,
  unconnectedBranch,
  validationMessages,
  stepMessages,
  validationMessageText,
  waitForDefinitionSave,
  mockClassifierTry,
  workflowHeaderAction,
  overrideWorkflowFields,
  withFreshPhoneWorkflow,
  addNodeFromStepSheet,
  touchGesture,
  bareCanvasPoint,
  settledCentreOf,
  insertFromPicker,
  caretOf,
  buildRefundRouter,
  REFUND_REPLY,
  GENERAL_REPLY,
  MISSING_END,
} from '../utils/workflows';

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

  test('admin goes to workflow editor and sees default Start and Agent nodes', async ({
    page,
  }) => {
    await navigateToWorkflowsPage(page);
    await createWorkflow(page);
    await waitForWorkflowEditorReady(page);

    const canvas = page.locator('[data-testid="workflow-canvas"]');
    const startNode = canvas.locator('span').filter({ hasText: 'Start' });
    await expect(startNode).toBeVisible({ timeout: 15_000 });

    const agentNode = canvas.locator('p').filter({ hasText: 'Agent' });
    await expect(agentNode).toBeVisible({ timeout: 15_000 });

    const edges = canvas.locator(
      'path[stroke="#38A1E5"]:not([stroke-dasharray])',
    );
    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(1);

    await deleteCurrentWorkflow(page);
  });

  test('admin goes to workflow editor and finds Deactivate and Delete in its header or More workflow options', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      // Delete is the first to leave the bar: once it is found, Deactivate is
      // either inline too or in the menu that finding Delete opened.
      await expect(await workflowHeaderAction(page, 'Delete')).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        page
          .getByTestId('workflow-header-actions')
          .getByRole('button', { name: 'Deactivate', exact: true })
          .or(page.getByRole('menuitem', { name: 'Deactivate', exact: true })),
      ).toBeVisible({ timeout: 5_000 });

      await page.keyboard.press('Escape');
    });
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
    await addEndStepOnLoad(page);
    await withFreshWorkflow(page, async () => {
      const published = await publishWorkflow(page);

      expect(published.status()).toBe(200);
      // A new workflow is already Active, so the publish time is the proof.
      expect((await published.json()).workflow?.published_at).toBeTruthy();
      await expect(page.getByText('Workflow published')).toBeVisible({
        timeout: 10_000,
      });
      await expect
        .poll(() => getWorkflowStatus(page), { timeout: 10_000 })
        .toBe('Active');
    });
  });

  test('admin goes to workflow editor and the backend refuses to publish a workflow with no End step', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const refused = await publishWorkflow(page);

      expect(refused.status()).toBe(400);
      const body = await refused.json();
      expect(body.is_valid).toBe(false);
      expect(
        (body.errors as string[]).some((error) => MISSING_END.test(error)),
      ).toBe(true);
      await expect(page.getByText('Workflow published')).toHaveCount(0);
    });
  });

  test('admin goes to workflow editor and deactivates an active workflow', async ({
    page,
  }) => {
    await addEndStepOnLoad(page);
    await withFreshWorkflow(page, async () => {
      const published = await publishWorkflow(page);
      expect(published.status()).toBe(200);
      await expect
        .poll(() => getWorkflowStatus(page), { timeout: 10_000 })
        .toBe('Active');

      const deactivateItem = await workflowHeaderAction(page, 'Deactivate');
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
    });
  });

  const DEFAULT_EDGE_ID = 'e-start-mentor-1';
  const hasNoDefaultEdge = (definition: { edges: { id: string }[] }) =>
    !definition.edges.some((edge) => edge.id === DEFAULT_EDGE_ID);

  test('admin hovers a step and deletes it with its trash button', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const { id: nodeId } = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      const node = canvasNode(page, nodeId);

      await node.hover();
      const { definition } = await captureAutosave(
        page,
        () => node.getByRole('button', { name: 'Delete Transform' }).click(),
        (def) => !nodeOfType(def, 'transform'),
      );

      await expect(node).toHaveCount(0);
      expect(nodeOfType(definition, 'transform')).toBeUndefined();
    });
  });

  test('admin opens a step panel and deletes the step with the panel Delete button', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const { id: nodeId } = await addSavedNodeFromSidebar(
        page,
        'Set State',
        'set-state',
      );
      const panel = await openNodePanel(page, nodeId);

      const { definition } = await captureAutosave(
        page,
        () => panel.getByRole('button', { name: 'Delete Set State' }).click(),
        (def) => !nodeOfType(def, 'set-state'),
      );

      await expect(canvasNode(page, nodeId)).toHaveCount(0);
      await expect(nodePanel(page)).toBeHidden();
      expect(nodeOfType(definition, 'set-state')).toBeUndefined();
    });
  });

  test('admin deletes the Agent step with its trash button and its connection goes with it', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const agentNode = canvasNode(page, 'mentor-1');
      await expect(agentNode).toBeVisible({ timeout: 15_000 });

      await agentNode.hover();
      const { definition } = await captureAutosave(
        page,
        () => agentNode.getByRole('button', { name: /^Delete / }).click(),
        (def) => !nodeOfType(def, 'mentor'),
      );

      await expect(agentNode).toHaveCount(0);
      await expect(canvasEdge(page, DEFAULT_EDGE_ID)).toHaveCount(0);
      expect(hasNoDefaultEdge(definition)).toBe(true);
    });
  });

  test('admin selects a connection and deletes it with the Delete Connection button', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      await selectConnection(page, DEFAULT_EDGE_ID);

      const { definition } = await captureAutosave(
        page,
        () => page.getByRole('button', { name: 'Delete Connection' }).click(),
        hasNoDefaultEdge,
      );

      await expect(canvasEdge(page, DEFAULT_EDGE_ID)).toHaveCount(0);
      expect(hasNoDefaultEdge(definition)).toBe(true);
      await expect(canvasNode(page, 'mentor-1')).toBeVisible();
    });
  });

  test('admin selects a connection and deletes it with the Delete key', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      // The editor ignores the key after a press inside a step panel or a
      // dialog, so the press on the connection must come right before it.
      await selectConnection(page, DEFAULT_EDGE_ID);

      await captureAutosave(
        page,
        () => page.keyboard.press('Delete'),
        hasNoDefaultEdge,
      );

      await expect(canvasEdge(page, DEFAULT_EDGE_ID)).toHaveCount(0);
      await expect(canvasNode(page, 'mentor-1')).toBeVisible();
      await expect(canvasNode(page, 'start')).toBeVisible();
    });
  });

  test('admin adds Number and Boolean state variables to Start and the saved defaults are typed', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const panel = await openNodePanel(page, 'start');
      await expect(panel.getByText('input', { exact: true })).toBeVisible();

      await addStartVariable(page, {
        name: 'counter',
        type: 'Number',
        defaultValue: '5',
      });
      const { definition } = await captureAutosave(
        page,
        () =>
          addStartVariable(page, {
            name: 'is_ready',
            type: 'Boolean',
            defaultValue: 'true',
          }),
        (def) =>
          (nodeOfType(def, 'start')?.data.stateVariables ?? []).length === 2,
      );

      await expect(panel.getByText('counter', { exact: true })).toBeVisible();
      await expect(panel.getByText('is_ready', { exact: true })).toBeVisible();

      const variables = nodeOfType(definition, 'start')!.data.stateVariables;
      expect(variables).toEqual([
        expect.objectContaining({
          name: 'counter',
          type: 'number',
          defaultValue: 5,
        }),
        expect.objectContaining({
          name: 'is_ready',
          type: 'boolean',
          defaultValue: true,
        }),
      ]);
    });
  });

  test('admin removes a Start state variable and an invalid name keeps Save disabled', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const panel = await openNodePanel(page, 'start');
      await addStartVariable(page, { name: 'counter', type: 'Number' });
      await addStartVariable(page, { name: 'keeper', type: 'String' });

      await panel.getByRole('button', { name: 'Remove counter' }).click();
      const confirm = page.getByRole('dialog', {
        name: 'Delete Variable',
      });
      await expect(confirm).toBeVisible({ timeout: 10_000 });
      await confirm
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
      await expect(confirm).toBeHidden({ timeout: 10_000 });
      await expect(panel.getByText('counter', { exact: true })).toBeVisible();

      const { definition } = await captureAutosave(
        page,
        async () => {
          await panel.getByRole('button', { name: 'Remove counter' }).click();
          await expect(confirm).toBeVisible({ timeout: 10_000 });
          await confirm
            .getByRole('button', { name: 'Delete', exact: true })
            .click();
        },
        (def) =>
          JSON.stringify(
            (nodeOfType(def, 'start')?.data.stateVariables ?? []).map(
              (variable: { name: string }) => variable.name,
            ),
          ) === '["keeper"]',
      );
      await expect(panel.getByText('counter', { exact: true })).toHaveCount(0);
      await expect(panel.getByText('keeper', { exact: true })).toBeVisible();
      expect(nodeOfType(definition, 'start')!.data.stateVariables).toEqual([
        expect.objectContaining({ name: 'keeper' }),
      ]);

      await panel.getByRole('button', { name: 'Add', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Add State Variable' });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.locator('#var-name').fill('1 bad name');
      await expect(
        dialog.getByRole('button', { name: 'Save', exact: true }),
      ).toBeDisabled();
      await expect(
        dialog.getByText(
          'Start with a letter and use only letters, numbers and underscores.',
        ),
      ).toBeVisible();

      await dialog.locator('#var-name').fill('keeper');
      await expect(
        dialog.getByText('A variable with this name already exists.'),
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Save', exact: true }),
      ).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });

  test('admin opens Set State and picks a Start variable or creates one with New', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const startPanel = await openNodePanel(page, 'start');
      await addStartVariable(page, { name: 'counter', type: 'Number' });
      await closeNodePanel(page);
      await expect(startPanel).toBeHidden();

      const nodeId = await addNodeFromSidebar(page, 'Set State', 'set-state');
      const panel = await openNodePanel(page, nodeId);
      const toVariable = panel.getByRole('combobox', { name: 'To Variable' });

      await toVariable.click();
      await expect(page.getByRole('option', { name: 'counter' })).toBeVisible();
      await expect(
        page.getByRole('option', { name: 'Variable 1' }),
      ).toHaveCount(0);
      await page.keyboard.press('Escape');

      await createVariableFromSetState(page, 'total');
      await expect(toVariable).toHaveText('total');
    });
  });

  test('admin sets a Set State expression and the saved step uses assignments the backend accepts', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const nodeId = await addNodeFromSidebar(page, 'Set State', 'set-state');
      const panel = await openNodePanel(page, nodeId);
      await createVariableFromSetState(page, 'total');

      const expression = "variables['total'] + 1";
      const { definition, validation } = await captureAutosave(
        page,
        () => panel.getByLabel('Assign Value').fill(expression),
        (def) =>
          nodeOfType(def, 'set-state')?.data.assignments?.[0]?.expression ===
          expression,
      );

      const data = nodeOfType(definition, 'set-state')!.data;
      expect(data.assignments).toEqual([
        expect.objectContaining({ variable: 'total', expression }),
      ]);
      expect(data).not.toHaveProperty('setStateAssignments');
      expect(stepMessages(validation, definition, nodeId)).toEqual([]);
    });
  });

  test('admin fills a Transform Key and Value and the saved step uses expressions the backend accepts', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const nodeId = await addNodeFromSidebar(page, 'Transform', 'transform');
      const panel = await openNodePanel(page, nodeId);

      const expression = "step_results['mentor-1']['output']";
      await panel.getByLabel('Key', { exact: true }).fill('reply');
      const { definition, validation } = await captureAutosave(
        page,
        () => panel.getByLabel('Value', { exact: true }).fill(expression),
        (def) =>
          nodeOfType(def, 'transform')?.data.expressions?.[0]?.expression ===
          expression,
      );

      const data = nodeOfType(definition, 'transform')!.data;
      expect(data.expressions).toEqual([
        expect.objectContaining({ target: 'reply', expression }),
      ]);
      expect(data).not.toHaveProperty('transformExpressions');
      expect(data).not.toHaveProperty('transformMode');
      expect(stepMessages(validation, definition, nodeId)).toEqual([]);
    });
  });

  test('admin fills a While Condition and Max Iterations and the saved step carries both', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const nodeId = await addNodeFromSidebar(page, 'While', 'while');
      const panel = await openNodePanel(page, nodeId);

      const condition = "variables['attempts'] < 3";
      await panel.getByLabel('Condition', { exact: true }).fill(condition);

      await panel.getByLabel('Max Iterations').fill('0');
      await expect(
        panel.getByText('Enter a whole number of 1 or more.'),
      ).toBeVisible();

      const { definition, validation } = await captureAutosave(
        page,
        () => panel.getByLabel('Max Iterations').fill('5'),
        (def) =>
          nodeOfType(def, 'while')?.data.condition === condition &&
          nodeOfType(def, 'while')?.data.maxIterations === 5,
      );

      const data = nodeOfType(definition, 'while')!.data;
      expect(data.condition).toBe(condition);
      expect(data.maxIterations).toBe(5);
      expect(data).not.toHaveProperty('whileExpression');
      expect(stepMessages(validation, definition, nodeId)).toEqual([]);
    });
  });

  test('admin connects the While Loop and Done handles to other steps', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const whileId = await addNodeFromSidebar(page, 'While', 'while');
      const endId = await addNodeFromSidebar(page, 'End', 'end');

      await connectHandle(page, whileId, 'continue', endId);
      const { definition } = await captureAutosave(
        page,
        () => connectHandle(page, whileId, 'done', 'mentor-1'),
        (def) => def.edges.some((edge) => edge.sourceHandle === 'done'),
      );

      expect(definition.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: whileId,
            target: endId,
            sourceHandle: 'continue',
          }),
          expect.objectContaining({
            source: whileId,
            target: 'mentor-1',
            sourceHandle: 'done',
          }),
        ]),
      );
      await expect(
        canvasEdge(page, `e-${whileId}-continue-${endId}`),
      ).toBeAttached();
      await expect(
        canvasEdge(page, `e-${whileId}-done-mentor-1`),
      ).toBeAttached();
    });
  });

  test('admin fills an If / Else condition and the saved step carries it in conditions', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const nodeId = await addNodeFromSidebar(page, 'If / Else', 'conditional');
      const panel = await openNodePanel(page, nodeId);

      const expression = "variables['score'] > 5";
      const { definition, validation } = await captureAutosave(
        page,
        () =>
          panel
            .getByRole('textbox', { name: 'If', exact: true })
            .fill(expression),
        (def) =>
          nodeOfType(def, 'conditional')?.data.conditions?.[0]?.expression ===
          expression,
      );

      expect(nodeOfType(definition, 'conditional')!.data.conditions[0]).toEqual(
        expect.objectContaining({ expression }),
      );
      expect(stepMessages(validation, definition, nodeId)).toEqual([]);
    });
  });

  test('admin connects the If / Else condition and Else handles to other steps', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const ifId = await addNodeFromSidebar(page, 'If / Else', 'conditional');
      const endId = await addNodeFromSidebar(page, 'End', 'end');

      await connectHandle(page, ifId, 'condition-0', endId);
      const { definition } = await captureAutosave(
        page,
        () => connectHandle(page, ifId, 'else', 'mentor-1'),
        (def) => def.edges.some((edge) => edge.sourceHandle === 'else'),
      );

      expect(definition.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: ifId,
            target: endId,
            sourceHandle: 'condition-0',
          }),
          expect.objectContaining({
            source: ifId,
            target: 'mentor-1',
            sourceHandle: 'else',
          }),
        ]),
      );
    });
  });

  test('admin opens a workflow saved with old field names and Save stores the new names', async ({
    page,
  }) => {
    const legacyNodes = [
      {
        id: 'set-state-legacy',
        type: 'set-state',
        position: { x: 300, y: 450 },
        data: {
          label: 'Set State',
          setStateAssignments: [
            {
              id: 'a1',
              variable: 'counter',
              value: "variables['counter'] + 1",
            },
          ],
        },
      },
      {
        id: 'transform-legacy',
        type: 'transform',
        position: { x: 550, y: 450 },
        data: {
          label: 'Transform',
          transformMode: 'expressions',
          transformExpressions: [
            {
              id: 't1',
              key: 'reply',
              value: "step_results['mentor-1']['output']",
            },
          ],
        },
      },
      {
        id: 'while-legacy',
        type: 'while',
        position: { x: 800, y: 450 },
        data: { label: 'While', whileExpression: "variables['counter'] < 3" },
      },
      {
        id: 'if-legacy',
        type: 'conditional',
        position: { x: 1050, y: 450 },
        data: { label: 'If / Else', condition: "variables['counter'] > 1" },
      },
    ];
    const legacyEdges = [
      {
        id: 'e-if-legacy-true',
        source: 'if-legacy',
        target: 'set-state-legacy',
        sourceHandle: 'true',
      },
      {
        id: 'e-if-legacy-false',
        source: 'if-legacy',
        target: 'transform-legacy',
        sourceHandle: 'false',
      },
    ];
    let injected = false;
    await page.route(
      /\/api\/ai-mentor\/orgs\/[^/]+\/workflows\/[^/?]+\/?(\?.*)?$/,
      async (route) => {
        if (injected || route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const response = await route.fetch();
        const body = await response.json().catch(() => null);
        // workflows/node-types/ matches this pattern too and loads alongside
        // the workflow; only the workflow itself carries a definition.
        if (!body?.unique_id || !Array.isArray(body.definition?.nodes)) {
          await route.fulfill({ response });
          return;
        }
        injected = true;
        body.definition.nodes = [...body.definition.nodes, ...legacyNodes];
        body.definition.edges = [
          ...(body.definition.edges ?? []),
          ...legacyEdges,
        ];
        await route.fulfill({ response, json: body });
      },
    );

    const workflowPatches = recordWorkflowPatches(page);
    await navigateToWorkflowsPage(page);
    await deleteWorkflowAfter(page, async () => {
      await createWorkflow(page, generateWorkflowName());
      await waitForWorkflowEditorReady(page);

      // Edits auto-save one second after the change and clear Unsaved, so
      // wait past that before checking that opening sent nothing.
      const unsaved = page.getByText('Unsaved', { exact: true });
      await expect(unsaved).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(2_000);
      expect(workflowPatches).toEqual([]);
      await expect(unsaved).toBeVisible();

      const definition = await captureManualSave(page, () =>
        page.getByRole('button', { name: 'Save', exact: true }).click(),
      );
      await expect(unsaved).toBeHidden({ timeout: 10_000 });

      const setState = nodeOfType(definition, 'set-state')!.data;
      expect(setState.assignments).toEqual([
        expect.objectContaining({
          variable: 'counter',
          expression: "variables['counter'] + 1",
        }),
      ]);
      expect(setState).not.toHaveProperty('setStateAssignments');
      const transform = nodeOfType(definition, 'transform')!.data;
      expect(transform.expressions).toEqual([
        expect.objectContaining({
          target: 'reply',
          expression: "step_results['mentor-1']['output']",
        }),
      ]);
      expect(transform).not.toHaveProperty('transformExpressions');
      expect(transform).not.toHaveProperty('transformMode');
      const whileData = nodeOfType(definition, 'while')!.data;
      expect(whileData.condition).toBe("variables['counter'] < 3");
      expect(whileData).not.toHaveProperty('whileExpression');

      const ifData = nodeOfType(definition, 'conditional')!.data;
      expect(ifData.conditions[0].expression).toBe("variables['counter'] > 1");
      const ifEdges = definition.edges.filter(
        (edge) => edge.source === 'if-legacy',
      );
      expect(ifEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: 'set-state-legacy',
            sourceHandle: 'condition-0',
          }),
          expect.objectContaining({
            target: 'transform-legacy',
            sourceHandle: 'else',
          }),
        ]),
      );
      expect(ifEdges.map((edge) => edge.sourceHandle)).not.toContain('true');
      expect(ifEdges.map((edge) => edge.sourceHandle)).not.toContain('false');
    });
  });

  test('admin rewires an If / Else output to a second step and it keeps a single connection', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const ifId = await addNodeFromSidebar(page, 'If / Else', 'conditional');
      const firstEndId = await addNodeFromSidebar(page, 'End', 'end');
      const secondEndId = await addNodeFromSidebar(page, 'End', 'end');

      await connectHandle(page, ifId, 'condition-0', firstEndId);
      const { definition } = await captureAutosave(
        page,
        () => connectHandle(page, ifId, 'condition-0', secondEndId),
        (def) => {
          const fromIf = def.edges.filter(
            (edge) =>
              edge.source === ifId && edge.sourceHandle === 'condition-0',
          );
          return fromIf.length === 1 && fromIf[0].target === secondEndId;
        },
      );

      expect(
        definition.edges.filter(
          (edge) => edge.source === ifId && edge.sourceHandle === 'condition-0',
        ),
      ).toHaveLength(1);
      await expect(
        page.locator(`[data-testid^="workflow-edge-e-${ifId}-condition-0-"]`),
      ).toHaveCount(1);
      await expect(
        canvasEdge(page, `e-${ifId}-condition-0-${secondEndId}`),
      ).toBeAttached();
    });
  });

  test('admin cannot remove a Start variable that a Set State step uses', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const startPanel = await openNodePanel(page, 'start');
      await addStartVariable(page, { name: 'counter', type: 'Number' });
      await closeNodePanel(page);

      const nodeId = await addNodeFromSidebar(page, 'Set State', 'set-state');
      const setStatePanel = await openNodePanel(page, nodeId);
      await setStatePanel
        .getByRole('combobox', { name: 'To Variable' })
        .click();
      await page.getByRole('option', { name: 'counter' }).click();
      await closeNodePanel(page);

      await openNodePanel(page, 'start');
      await startPanel.getByRole('button', { name: 'Remove counter' }).click();
      const inUse = page.getByRole('dialog', { name: 'Variable In Use' });
      await expect(inUse).toBeVisible({ timeout: 10_000 });
      await expect(inUse.getByText('Set State', { exact: true })).toBeVisible();
      await inUse.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(inUse).toBeHidden({ timeout: 10_000 });
      await expect(
        startPanel.getByText('counter', { exact: true }),
      ).toBeVisible();
    });
  });

  test('admin adds a Note and the editor never warns that it is not connected', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      // The editor validates when the workflow opens. Collapsing that banner
      // means the End message can only come back from the validation after
      // the Note is saved.
      const endOnOpen = page
        .getByTestId('workflow-validation-list')
        .getByText(MISSING_END);
      await expect(endOnOpen).toBeVisible({ timeout: 15_000 });
      await page
        .getByRole('button', { name: /^Warnings and Errors\b/ })
        .click();
      await expect(endOnOpen).toHaveCount(0);

      let noteId = '';
      const { validation } = await captureAutosave(
        page,
        async () => {
          noteId = await addNodeFromSidebar(page, 'Note', 'note');
        },
        (def) => !!nodeOfType(def, 'note'),
      );
      const endMessage = validationMessages(validation).find((message) =>
        MISSING_END.test(message),
      );
      expect(
        endMessage,
        'missing End message in the validate body',
      ).toBeTruthy();

      // The banner was collapsed before the Note was added, so the End
      // message reappearing proves the post-save validation is on screen.
      await expect(
        page.getByText(validationMessageText(endMessage!)),
      ).toBeVisible({ timeout: 10_000 });
      // Backend #3163 warns that the Note is not connected and names it by
      // its quoted id; #3218 leaves Notes out. Either way no line is about it.
      await expect(page.getByText(`'${noteId}'`)).toHaveCount(0);
      await expect(
        page.getByTestId('workflow-validation-list').getByText(/\bNote\b/),
      ).toHaveCount(0);
    });
  });

  test('admin opens the step list and it offers Classifier but no steps that cannot run yet', async ({
    page,
  }) => {
    const nodeTypesResponse = page.waitForResponse(
      (response) =>
        /\/workflows\/node-types\/?$/.test(new URL(response.url()).pathname),
      { timeout: 60_000 },
    );
    await withFreshWorkflow(page, async () => {
      const { node_types: nodeTypes } = (await (
        await nodeTypesResponse
      ).json()) as {
        node_types: Record<string, { label: string; status?: string }>;
      };
      // Until node types load, the step list is a built-in one that already
      // leaves the planned steps out. Its "Set state" becomes the backend's
      // "Set State" once the backend's list is on screen.
      await expect(
        page.getByRole('button', {
          name: nodeTypes['set-state'].label,
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole('button', { name: 'Classifier', exact: true }),
      ).toBeVisible();
      const planned = Object.values(nodeTypes).filter(
        (nodeType) => nodeType.status === 'planned',
      );
      for (const { label } of planned) {
        await expect(
          page.getByRole('button', { name: label, exact: true }),
        ).toHaveCount(0);
      }
    });
  });

  test('admin adds a Classifier, renames a category and connects its Fallback, and each change is saved', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const classifier = await addSavedNodeFromSidebar(
        page,
        'Classifier',
        'classifier',
      );
      expect(classifier.type).toBe('classifier');
      expect(classifier.data).toMatchObject({
        answer_type: 'choice',
        model: 'iblai',
      });
      expect(
        classifier.data.categories.map(
          (category: { id: string }) => category.id,
        ),
      ).toEqual(['category_1', 'category_2']);

      const panel = await openNodePanel(page, classifier.id);
      const renamed = await captureAutosave(
        page,
        () =>
          panel
            .getByLabel('Label for Category 1', { exact: true })
            .fill('Billing'),
        (def) =>
          nodeById(def, classifier.id)?.data.categories?.[0]?.id === 'billing',
      );
      expect(
        nodeById(renamed.definition, classifier.id)!.data.categories[0],
      ).toMatchObject({ id: 'billing', label: 'Billing' });
      await closeNodePanel(page);

      const endId = await addNodeFromSidebar(page, 'End', 'end');
      const connected = await captureAutosave(
        page,
        () => connectHandle(page, classifier.id, 'fallback', endId),
        (def) =>
          def.edges.some(
            (edge) =>
              edge.source === classifier.id && edge.sourceHandle === 'fallback',
          ),
      );
      expect(connected.definition.edges).toContainEqual(
        expect.objectContaining({
          source: classifier.id,
          target: endId,
          sourceHandle: 'fallback',
        }),
      );
    });
  });

  test('admin adds an Agent step, clicks it to open its Step Settings and its Output Variable is saved', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const agent = await addSavedNodeFromSidebar(page, 'Agent', 'mentor');
      expect(agent.data.mentor_id).toBeFalsy();
      await expect(
        canvasNode(page, agent.id).getByRole('button', {
          name: 'Agent Settings',
          exact: true,
        }),
      ).toHaveCount(0);
      // The backend words this in terms of mentors; the banner never does.
      await expect(page.getByTestId('workflow-validation-list')).toContainText(
        'An Agent step has no agent selected.',
        { timeout: 10_000 },
      );

      const panel = await openNodePanel(page, agent.id);
      await expect(
        panel.getByLabel('Instructions', { exact: true }),
      ).toHaveValue('');

      const { definition } = await captureAutosave(
        page,
        () =>
          panel.getByLabel('Output Variable', { exact: true }).fill('summary'),
        (def) => nodeById(def, agent.id)?.data.output_variable === 'summary',
      );
      expect(nodeById(definition, agent.id)!.data.output_variable).toBe(
        'summary',
      );
    });
  });

  test('admin adds an If / Else and it is saved with one empty condition', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const ifElse = await addSavedNodeFromSidebar(
        page,
        'If / Else',
        'conditional',
      );
      expect(ifElse.data.conditions).toEqual([
        expect.objectContaining({ caseName: '', expression: '' }),
      ]);
    });
  });

  test('admin adds a While and its Loop and Done show Not connected until each is connected', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const whileId = await addNodeFromSidebar(page, 'While', 'while');
      const loop = unconnectedBranch(page, whileId, 'continue');
      const done = unconnectedBranch(page, whileId, 'done');
      await expect(loop).toHaveText('Not connected');
      await expect(done).toHaveText('Not connected');

      const endId = await addNodeFromSidebar(page, 'End', 'end');
      await connectHandle(page, whileId, 'continue', endId);
      await expect(loop).toHaveCount(0);
      await expect(done).toHaveText('Not connected');

      await connectHandle(page, whileId, 'done', 'mentor-1');
      await expect(done).toHaveCount(0);
    });
  });

  test('admin tries a Classifier on a sample message and sees its answer', async ({
    page,
  }) => {
    const tries = await mockClassifierTry(page, {
      answer: 'billing',
      confidence: 0.9,
      probabilities: null,
      route: 'billing',
      uncertain: false,
      output: 'Billing (0.90)',
      model: 'typesafe/jev-1.14',
    });
    await withFreshWorkflow(page, async () => {
      const { id: classifierId } = await addSavedNodeFromSidebar(
        page,
        'Classifier',
        'classifier',
      );
      const panel = await openNodePanel(page, classifierId);

      const instructions = 'Classify what the user needs right now.';
      const sample = 'I was charged twice this month';
      // The backend tries the saved step, so the editor saves before a try;
      // the auto-save may get there first.
      const saved = waitForDefinitionSave(
        page,
        (def) =>
          nodeById(def, classifierId)?.data.instructions === instructions,
      );
      await panel
        .getByLabel('Instructions', { exact: true })
        .fill(instructions);
      await panel.getByLabel('Sample Message', { exact: true }).fill(sample);
      await panel.getByRole('button', { name: 'Try', exact: true }).click();
      await saved;

      await expect(panel.getByTestId('classifier-try-result')).toContainText(
        'Billing (0.90)',
        { timeout: 30_000 },
      );
      expect(tries[0].postDataJSON()).toMatchObject({
        node_id: classifierId,
        input: sample,
      });
    });
  });

  test('admin sends a message in Preview and the chat runs the draft', async ({
    page,
    chatPage,
  }) => {
    const frames = chatPage.recordChatFrames();
    await withFreshWorkflow(page, async () => {
      await enterPreviewMode(page);
      // Nothing loaded the workflow agent's permissions on this page, so the
      // input stayed disabled with "You don't have permission to chat".
      const composer = chatPage.getComposerTextarea();
      await expect(composer).toBeEditable({ timeout: 15_000 });
      await expect(composer).not.toHaveAttribute(
        'placeholder',
        /permission to chat/,
      );
      // The editor was as tall as the window under the app's top bar, so once
      // the chat outgrew the page the bottom of the message box was cut off. A
      // short window makes even the empty chat outgrow it. Checked before
      // typing: Playwright scrolls the page to reach the box, hiding the cut.
      const viewport = page.viewportSize();
      await page.setViewportSize({
        width: viewport?.width ?? 1280,
        height: 360,
      });
      await expect(page.locator('form', { has: composer })).toBeInViewport({
        ratio: 1,
      });
      const overflow = await page
        .locator('#main-content-container')
        .evaluate((main) => main.scrollHeight - main.clientHeight);
      expect(overflow).toBeLessThanOrEqual(1);
      if (viewport) await page.setViewportSize(viewport);
      const message = `Workflow preview check ${Date.now()}`;
      await chatPage.sendMessage(message);

      await expect
        .poll(() => frames.find((frame) => frame.prompt === message)?.preview, {
          timeout: 30_000,
        })
        .toBe(true);
      await exitPreviewMode(page);
    });
  });

  // ── Running a Workflow ────────────────────────────────────────────────────

  const errorsOf = (validation: string) =>
    (JSON.parse(validation) as { errors?: string[] }).errors ?? [];

  // A workflow's End step sends its reply in one piece, so the newest reply is
  // complete once it shows; the stop button going away ends the turn.
  async function expectLastReply(chat: ChatPage, text: string): Promise<void> {
    await expect(chat.getAiMessageBody(chat.getLastAiMessage())).toHaveText(
      text,
      { timeout: 60_000 },
    );
    await expect(chat.stopStreamingButton).toHaveCount(0, { timeout: 30_000 });
  }

  test('admin builds an If / Else with a Transform on each branch, and Preview replies with the branch each message takes', async ({
    page,
    chatPage,
  }) => {
    test.setTimeout(240_000);
    await withFreshWorkflow(page, async () => {
      const { validation } = await buildRefundRouter(page);
      expect(errorsOf(validation)).toEqual([]);

      await enterPreviewMode(page);
      await expect(chatPage.getComposerTextarea()).toBeEditable({
        timeout: 15_000,
      });
      await chatPage.sendMessage('I want a refund');
      await expectLastReply(chatPage, REFUND_REPLY);
      await chatPage.sendMessage('hello');
      await expectLastReply(chatPage, GENERAL_REPLY);
    });
  });

  test("admin connects the Agent step to an End, and Preview shows the agent's own reply", async ({
    page,
    chatPage,
    createMentorPage,
  }) => {
    test.setTimeout(300_000);
    // Its own agent, which the new workflow's Agent step starts with. The
    // end-of-run cleanup deletes it: deleting it now could pull it from under
    // another worker's test that landed on it as the newest agent.
    await createMentorPage.openAndCreate();
    const { mentorId: agentId } = await getPlatformContext(page);
    // New agents can start with their own computer on, and then answer only
    // once it has started, if it starts at all.
    await putMentorVmNetworkSettings(page, agentId, {
      enable_virtual_machine: false,
    });
    await withFreshWorkflow(page, async () => {
      // The editor places a new step as if the Agent card were 140px wide,
      // but it is as wide as the agent's name, so an End added beside it
      // covers its output dot. Scrolled sideways first, the End lands clear.
      const bare = await bareCanvasPoint(page);
      await page.mouse.move(bare.x, bare.y);
      await page.mouse.wheel(400, 0);
      const endId = await addNodeFromSidebar(page, 'End', 'end');
      const { definition, validation } = await captureAutosave(
        page,
        () => connectHandle(page, 'mentor-1', 'right', endId),
        (def) =>
          def.edges.some(
            (edge) => edge.source === 'mentor-1' && edge.target === endId,
          ),
      );
      expect(nodeById(definition, 'mentor-1')?.data.mentor_id).toBe(agentId);
      expect(errorsOf(validation)).toEqual([]);

      await enterPreviewMode(page);
      await expect(chatPage.getComposerTextarea()).toBeEditable({
        timeout: 15_000,
      });
      await chatPage.sendMessage('Say hello in one short sentence.');
      const reply = chatPage.getAiMessageBody(chatPage.getLastAiMessage());
      await expect(reply).toBeVisible({ timeout: 120_000 });
      await expect(chatPage.stopStreamingButton).toHaveCount(0, {
        timeout: 60_000,
      });
      // A run that fails replies with the workflow's apology instead.
      const text = (await reply.innerText()).trim();
      expect(text).not.toBe('');
      expect(text).not.toContain('went wrong');
    });
  });

  test('admin publishes the If / Else workflow, and its own agent replies with the branch in a normal chat', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await withFreshWorkflow(page, async () => {
      await buildRefundRouter(page);
      const published = await publishWorkflow(page);
      expect(published.status()).toBe(200);
      const agentId = (await published.json()).workflow?.entry_mentor_id;
      expect(agentId, "the workflow's own agent").toBeTruthy();

      // A second tab, so the editor stays open for the cleanup to delete the
      // workflow from it.
      const { platformKey } = parsePlatformUrl(page.url());
      const agentPage = await page.context().newPage();
      try {
        await navigateToMentorApp(
          agentPage,
          `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${agentId}`,
        );
        expect(agentPage.url()).toContain(agentId);
        const agentChat = new ChatPage(agentPage);
        await agentChat.sendMessage('I want a refund');
        await expectLastReply(agentChat, REFUND_REPLY);
      } finally {
        await agentPage.close();
      }
    });
  });

  test('admin sees Unpublished changes only while a published copy of the workflow exists', async ({
    page,
  }) => {
    let publishedAt: string | null = '2026-11-01T12:00:00Z';
    await overrideWorkflowFields(page, () => ({
      published_at: publishedAt,
      has_unpublished_changes: true,
    }));
    await withFreshWorkflow(page, async () => {
      const marker = page.getByTestId('workflow-unpublished-changes');
      await expect(marker).toHaveText('Unpublished changes', {
        timeout: 15_000,
      });

      publishedAt = null;
      // A save refetches the workflow, which now reports no published copy.
      await captureManualSave(page, () =>
        page.getByRole('button', { name: 'Save', exact: true }).click(),
      );
      await expect(marker).toHaveCount(0, { timeout: 15_000 });
    });
  });

  test('admin copies a step placeholder from its card and from its settings', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Only Chromium lets a test grant and read the clipboard',
    );
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    await withFreshWorkflow(page, async () => {
      const { id } = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      // What an Agent's Instructions take; the Step IDs rows copy
      // step_results['…'], which only works inside a Value or condition.
      const placeholder = `{{steps.${id}}}`;
      const card = canvasNode(page, id);

      const leftOf = async (locator: Locator) =>
        (await locator.boundingBox())?.x ?? Number.NaN;

      await card.hover();
      const cardCopy = card.getByRole('button', {
        name: `Copy ${placeholder}`,
      });
      expect(await leftOf(cardCopy)).toBeLessThan(
        await leftOf(card.getByRole('button', { name: 'Delete Transform' })),
      );
      await cardCopy.click();
      await expect.poll(clipboard).toBe(placeholder);
      await expect(nodePanel(page)).toBeHidden();

      await page.evaluate(() => navigator.clipboard.writeText(''));
      const panel = await openNodePanel(page, id);
      const panelCopy = panel.getByRole('button', {
        name: `Copy ${placeholder}`,
      });
      const panelDelete = panel.getByRole('button', {
        name: 'Delete Transform',
      });
      expect(await leftOf(panelCopy)).toBeLessThan(await leftOf(panelDelete));
      expect(await leftOf(panelDelete)).toBeLessThan(
        await leftOf(panel.getByRole('button', { name: 'Close', exact: true })),
      );
      await panelCopy.click();
      await expect.poll(clipboard).toBe(placeholder);
    });
  });

  test('admin saves with Cmd+S or Ctrl+S while typing in a step, and the browser Save dialog stays shut', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const { id } = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      const panel = await openNodePanel(page, id);
      await panel.getByLabel('Key', { exact: true }).fill('reply');
      // Installed and awaited before the press, so the key can't arrive first.
      await page.evaluate(() => {
        (window as unknown as { saveKey: Promise<boolean> }).saveKey =
          new Promise((resolve) => {
            window.addEventListener('keydown', (event) => {
              if (event.code === 'KeyS') resolve(event.defaultPrevented);
            });
          });
      });

      // The auto-save waits a second after typing, so the first save after
      // the press is the shortcut's own.
      const saved = await captureManualSave(page, () =>
        page.keyboard.press('ControlOrMeta+s'),
      );

      expect(nodeById(saved, id)?.data.expressions?.[0]?.target).toBe('reply');
      expect(
        await page.evaluate(
          () => (window as unknown as { saveKey: Promise<boolean> }).saveKey,
        ),
      ).toBe(true);
      // The auto-save shows no toast, so this one comes from the shortcut.
      await expect(page.getByText('Workflow saved')).toBeVisible({
        timeout: 15_000,
      });
    });
  });
  test('admin sees the editor header actions as buttons while they fit and in More workflow options once the window narrows', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const header = page.getByTestId('workflow-header-actions');
      const viewport = page.viewportSize();
      const height = viewport?.height ?? 900;

      await page.setViewportSize({ width: 1600, height });
      await expect(header).toHaveAttribute('data-fit', 'done', {
        timeout: 10_000,
      });
      for (const name of [
        'Delete',
        'Deactivate',
        'Preview',
        'Save',
        'Publish',
      ]) {
        await expect(
          header.getByRole('button', { name, exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole('button', { name: 'More workflow options' }),
      ).toHaveCount(0);
      const heights = await header
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map((button) =>
            Math.round(button.getBoundingClientRect().height),
          ),
        );
      expect(new Set(heights)).toEqual(new Set([36]));

      // Delete goes into the menu first and Publish last.
      await page.setViewportSize({ width: 900, height });
      await expect(
        header.getByRole('button', { name: 'Delete', exact: true }),
      ).toHaveCount(0);
      await expect(
        header.getByRole('button', { name: 'Publish', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'More workflow options' }).click();
      await expect(
        page.getByRole('menuitem', { name: 'Delete', exact: true }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      if (viewport) await page.setViewportSize(viewport);
    });
  });

  test('admin undoes adding a step with Cmd+Z or Ctrl+Z, redoes it with Shift, and deletes the selected step with Delete', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const { id } = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      const step = canvasNode(page, id);

      await captureAutosave(
        page,
        () => page.keyboard.press('ControlOrMeta+z'),
        (def) => !nodeById(def, id),
      );
      await expect(step).toHaveCount(0);

      await captureAutosave(
        page,
        () => page.keyboard.press('ControlOrMeta+Shift+z'),
        (def) => !!nodeById(def, id),
      );
      await expect(step).toBeVisible();

      await openNodePanel(page, id);
      await captureAutosave(
        page,
        () => page.keyboard.press('Delete'),
        (def) => !nodeById(def, id),
      );
      await expect(step).toHaveCount(0);
    });
  });

  test('admin clicks an Agent step to open its Step Settings and opens the agent itself with its Agent Settings button', async ({
    page,
    editMentorPage,
  }) => {
    await withFreshWorkflow(page, async () => {
      const panel = await openNodePanel(page, 'mentor-1');
      await expect(
        panel.getByLabel('Instructions', { exact: true }),
      ).toBeVisible();
      await closeNodePanel(page);

      await canvasNode(page, 'mentor-1')
        .getByRole('button', { name: 'Agent Settings', exact: true })
        .click();
      await expect(editMentorPage.dialog).toBeVisible({ timeout: 30_000 });
      await expect(nodePanel(page)).toBeHidden();
      await editMentorPage.close();
    });
  });

  test('admin sees the validation banner titled Warnings and Errors with its count, and alert icons only on its lines', async ({
    page,
  }) => {
    const errorIcon = 'svg.lucide-circle-alert';
    const warningIcon = 'svg.lucide-triangle-alert';
    await withFreshWorkflow(page, async () => {
      // The editor validates when it opens, and a new workflow has no End.
      const header = page.getByRole('button', {
        name: /^Warnings and Errors\b/,
      });
      await expect(header).toBeVisible({ timeout: 15_000 });
      const lines = page
        .getByTestId('workflow-validation-list')
        .locator(':scope > div');
      await expect(lines.first()).toBeVisible();

      const total = await lines.count();
      const errors = await lines
        .filter({ has: page.locator(errorIcon) })
        .count();
      const warnings = await lines
        .filter({ has: page.locator(warningIcon) })
        .count();
      expect(errors + warnings).toBe(total);

      const counts = [
        errors > 0 && `${errors} error${errors === 1 ? '' : 's'}`,
        warnings > 0 && `${warnings} warning${warnings === 1 ? '' : 's'}`,
      ]
        .filter(Boolean)
        .join(', ');
      await expect(header).toContainText(counts);
      await expect(header.locator(`${errorIcon}, ${warningIcon}`)).toHaveCount(
        0,
      );
      // The backend's "Mentor existence will be validated at runtime".
      await expect(page.getByTestId('workflow-validation-list')).toContainText(
        'The agent in each Agent step is checked when the workflow runs.',
      );
    });
  });

  test('admin inserts a Start variable at the cursor with the insert button of a Transform Value and of the Agent Instructions', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      await openNodePanel(page, 'start');
      await addStartVariable(page, { name: 'counter', type: 'Number' });
      await closeNodePanel(page);

      const transformId = await addNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      const transformPanel = await openNodePanel(page, transformId);
      await transformPanel.getByLabel('Key', { exact: true }).fill('next');
      const value = transformPanel.getByLabel('Value', { exact: true });
      const reference = "variables['counter']";
      const expression = `${reference} + 1`;
      await value.fill(' + 1');
      for (let step = 0; step < ' + 1'.length; step++) {
        await page.keyboard.press('ArrowLeft');
      }
      await captureAutosave(
        page,
        () => insertFromPicker(page, transformPanel, 'counter'),
        (def) =>
          nodeById(def, transformId)?.data.expressions?.[0]?.expression ===
          expression,
      );
      await expect(value).toHaveValue(expression);
      await expect(value).toBeFocused();
      expect(await caretOf(value)).toBe(reference.length);
      await closeNodePanel(page);

      const agentPanel = await openNodePanel(page, 'mentor-1');
      const instructions = agentPanel.getByLabel('Instructions', {
        exact: true,
      });
      const greeting = 'Greet {{variables.counter}}';
      await instructions.fill('Greet !');
      await page.keyboard.press('ArrowLeft');
      await captureAutosave(
        page,
        () => insertFromPicker(page, agentPanel, 'counter'),
        (def) =>
          nodeById(def, 'mentor-1')?.data.instructions === `${greeting}!`,
      );
      await expect(instructions).toHaveValue(`${greeting}!`);
      await expect(instructions).toBeFocused();
      expect(await caretOf(instructions)).toBe(greeting.length);
    });
  });

  test('admin copies a selected step with Cmd+C or Ctrl+C, pastes it with V and undoes the paste', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const { id } = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      const transformCount = (def: { nodes: { type: string }[] }) =>
        def.nodes.filter((node) => node.type === 'transform').length;
      await openNodePanel(page, id);

      const pasted = await captureAutosave(
        page,
        async () => {
          await page.keyboard.press('ControlOrMeta+c');
          await page.keyboard.press('ControlOrMeta+v');
        },
        (def) => transformCount(def) === 2,
      );
      const copy = pasted.definition.nodes.find(
        (node) => node.type === 'transform' && node.id !== id,
      );
      expect(copy, 'pasted Transform in the saved definition').toBeDefined();
      await expect(canvasNode(page, copy!.id)).toBeVisible();

      await captureAutosave(
        page,
        () => page.keyboard.press('ControlOrMeta+z'),
        (def) => transformCount(def) === 1 && !!nodeById(def, id),
      );
      await expect(canvasNode(page, copy!.id)).toHaveCount(0);
      await expect(canvasNode(page, id)).toBeVisible();
    });
  });

  test('admin pans the canvas with the mouse wheel and zooms it with the wheel while holding Cmd or Ctrl', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const layer = canvasNode(page, 'start').locator('xpath=..');
      const layerTransform = () =>
        layer.evaluate((element) => (element as HTMLElement).style.transform);
      const zoomLabel = page.getByTestId('workflow-canvas').getByText(/^\d+%$/);
      const zoomPercent = async () =>
        parseInt((await zoomLabel.textContent()) ?? '', 10);

      // A wheel up moves the steps down, away from the pointer, so the zoom
      // below still starts on bare canvas.
      const point = await bareCanvasPoint(page);
      await page.mouse.move(point.x, point.y);
      const startTransform = await layerTransform();
      const startZoom = await zoomPercent();
      await page.mouse.wheel(0, -120);
      await expect.poll(layerTransform).not.toBe(startTransform);
      expect(await zoomPercent()).toBe(startZoom);

      await page.keyboard.down('ControlOrMeta');
      await page.mouse.wheel(0, -100);
      await page.keyboard.up('ControlOrMeta');
      await expect.poll(zoomPercent).toBeGreaterThan(startZoom);
    });
  });

  test('admin hovers Undo and its tooltip shows the keyboard shortcut in brackets', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      // Undo stays disabled, and shows no tooltip, until there is a change.
      await addNodeFromSidebar(page, 'Transform', 'transform');
      const undo = page
        .getByTestId('workflow-canvas')
        .getByRole('button', { name: 'Undo', exact: true });
      await expect(undo).toBeEnabled();
      await expect(undo).toHaveAttribute(
        'aria-keyshortcuts',
        /\b(Meta|Control)\+Z\b/,
      );

      // The same test the app makes, so a device user agent can't split them.
      const onMac = await page.evaluate(() => {
        const { userAgentData, platform, userAgent } =
          navigator as Navigator & {
            userAgentData?: { platform?: string };
          };
        return /mac|iphone|ipad|ipod/i.test(
          userAgentData?.platform || platform || userAgent || '',
        );
      });
      await undo.hover();
      await expect(
        page.getByRole('tooltip', {
          name: onMac ? /^Undo \(⌘Z\)$/ : /^Undo \(Ctrl\+Z\)$/,
        }),
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  test('admin clicks a validation line that names a step and the step settings open', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const { id } = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      await expect(nodePanel(page)).toBeHidden();

      // Found by the step's id, so a backend rewording changes nothing.
      const line = page
        .getByTestId('workflow-validation-list')
        .locator(`[data-step-id="${id}"]`)
        .first();
      await line.hover();
      await expect(
        page.getByRole('tooltip', { name: 'Show Transform' }),
      ).toBeVisible({ timeout: 5_000 });
      await line.click();

      const panel = nodePanel(page);
      await expect(panel).toBeVisible({ timeout: 10_000 });
      await expect(
        panel.getByRole('button', { name: 'Delete Transform' }),
      ).toBeVisible();
      await expect(canvasNode(page, id)).toBeInViewport();
    });
  });

  test('admin takes back typing and an insert in the Agent Instructions with Cmd+Z or Ctrl+Z, one step each, and the canvas keeps its steps', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      // The canvas can undo adding this Transform, so a Cmd+Z that reached
      // the canvas would take it away.
      const transform = await addSavedNodeFromSidebar(
        page,
        'Transform',
        'transform',
      );
      const steps = page.locator('[data-node-type]');
      const stepCount = await steps.count();
      const panel = await openNodePanel(page, 'mentor-1');
      const instructions = panel.getByLabel('Instructions', { exact: true });
      await expect(instructions).toHaveCSS('resize', 'vertical');

      await instructions.click();
      await page.keyboard.press('ControlOrMeta+z');
      await page.keyboard.press('ControlOrMeta+z');
      await expect(canvasNode(page, transform.id)).toBeVisible();
      await expect(steps).toHaveCount(stepCount);

      await page.keyboard.type('Answer briefly');
      await page.keyboard.press('ControlOrMeta+z');
      await expect(instructions).toHaveValue('');
      await page.keyboard.press('ControlOrMeta+Shift+z');
      await expect(instructions).toHaveValue('Answer briefly');

      await insertFromPicker(page, panel, 'User');
      await expect(instructions).toHaveValue('Answer briefly{{input}}');
      await expect(instructions).toBeFocused();
      await page.keyboard.press('ControlOrMeta+z');
      await expect(instructions).toHaveValue('Answer briefly');
      await expect(canvasNode(page, transform.id)).toBeVisible();
      await expect(steps).toHaveCount(stepCount);
    });
  });

  test('admin finds the Add button of a Transform, a Set State and an If / Else right under its rows, above the hint and the Step IDs', async ({
    page,
  }) => {
    const topOf = async (locator: Locator) =>
      (await locator.boundingBox())?.y ?? Number.NaN;
    const steps = [
      {
        label: 'Transform',
        type: 'transform',
        row: (panel: Locator) => panel.getByLabel('Value', { exact: true }),
      },
      {
        label: 'Set State',
        type: 'set-state',
        row: (panel: Locator) => panel.getByLabel('Assign Value'),
      },
      {
        label: 'If / Else',
        type: 'conditional',
        row: (panel: Locator) =>
          panel.getByRole('textbox', { name: 'If', exact: true }),
      },
    ];
    await withFreshWorkflow(page, async () => {
      for (const step of steps) {
        const id = await addNodeFromSidebar(page, step.label, step.type);
        const panel = await openNodePanel(page, id);

        const row = step.row(panel);
        const add = panel.getByRole('button', { name: 'Add', exact: true });
        const hint = panel.getByText(/^Use variables\['name'\]/);
        // The Agent step is always listed, so every one of these has the list.
        const stepIds = panel.getByRole('heading', { name: 'Step IDs' });
        await expect(hint).toBeVisible();
        await expect(stepIds).toBeVisible();

        expect(await topOf(add), step.label).toBeGreaterThan(await topOf(row));
        expect(await topOf(add), step.label).toBeLessThan(await topOf(hint));
        expect(await topOf(add), step.label).toBeLessThan(await topOf(stepIds));
        await closeNodePanel(page);
      }
    });
  });

  test('admin publishes a workflow with no End step and the banner lists what to fix', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      // Collapse the banner the editor shows on open, so its coming back is
      // the refused publish's own list.
      const endLine = page
        .getByTestId('workflow-validation-list')
        .getByText(MISSING_END);
      await expect(endLine).toBeVisible({ timeout: 15_000 });
      await page
        .getByRole('button', { name: /^Warnings and Errors\b/ })
        .click();
      await expect(endLine).toBeHidden();

      const refused = await publishWorkflow(page);

      expect(refused.status()).toBe(400);
      await expect(
        page.getByText('Workflow has validation issues'),
      ).toBeVisible({ timeout: 10_000 });
      await expect(endLine).toBeVisible();
      await expect(page.getByText('Failed to publish workflow')).toHaveCount(0);
    });
  });

  test("admin picks the agent for a new Agent step, and the picker leaves out the workflow's own agent", async ({
    page,
  }) => {
    const workflowName = generateWorkflowName();
    await navigateToWorkflowsPage(page);
    await deleteWorkflowAfter(page, async () => {
      await createWorkflow(page, workflowName);
      await waitForWorkflowEditorReady(page);

      const agent = await addSavedNodeFromSidebar(page, 'Agent', 'mentor');
      const panel = await openNodePanel(page, agent.id);
      await panel.getByRole('button', { name: 'Select', exact: true }).click();
      const picker = page.getByRole('dialog', { name: 'Select Agent' });
      await expect(picker).toBeVisible({ timeout: 10_000 });

      // The backend names the workflow's own agent after the workflow, and a
      // workflow can't use it as a step. Agent search matches each word of a
      // query on its own, so only the name's last word finds that agent
      // alone; the search must return it for the empty list to mean anything.
      const ownAgentWord = workflowName.split(' ').at(-1)!;
      const searched = page.waitForResponse(
        (response) => {
          const url = new URL(response.url());
          return (
            /\/ai-search\/mentors\/?$/.test(url.pathname) &&
            url.searchParams.get('query') === ownAgentWord
          );
        },
        { timeout: 15_000 },
      );
      await picker.getByPlaceholder('Search Agents').fill(ownAgentWord);
      expect(
        JSON.stringify(await (await searched).json()),
        "the search returns the workflow's own agent",
      ).toContain(workflowName);
      await expect(
        picker.getByText('No agents found matching your search.'),
      ).toBeVisible({ timeout: 15_000 });

      await picker.getByPlaceholder('Search Agents').fill('');
      const firstAgent = picker
        .getByRole('button', { name: /^Select agent / })
        .first();
      await expect(firstAgent).toBeVisible({ timeout: 15_000 });
      const { definition } = await captureAutosave(
        page,
        () => firstAgent.click(),
        (def) => !!nodeById(def, agent.id)?.data.mentor_id,
      );

      expect(nodeById(definition, agent.id)!.data.mentor_id).toBeTruthy();
      await expect(picker).toBeHidden({ timeout: 10_000 });
      await expect(
        canvasNode(page, agent.id).getByRole('button', {
          name: 'Agent Settings',
          exact: true,
        }),
      ).toBeAttached();
    });
  });

  test('admin switches a Classifier to Yes or No and turns on Include Chat History, and both are saved', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const classifier = await addSavedNodeFromSidebar(
        page,
        'Classifier',
        'classifier',
      );
      const panel = await openNodePanel(page, classifier.id);

      await captureAutosave(
        page,
        async () => {
          await panel.getByRole('combobox', { name: 'Answer Type' }).click();
          await page.getByRole('option', { name: 'Yes or No' }).click();
        },
        (def) => nodeById(def, classifier.id)?.data.answer_type === 'noul',
      );
      for (const handle of ['true', 'false', 'fallback']) {
        await expect(
          unconnectedBranch(page, classifier.id, handle),
        ).toBeVisible();
      }
      await expect(
        unconnectedBranch(page, classifier.id, 'category_1'),
      ).toHaveCount(0);

      await panel
        .getByRole('button', { name: 'Advanced', exact: true })
        .click();
      const history = panel.getByRole('switch', {
        name: 'Include Chat History',
      });
      const { definition } = await captureAutosave(
        page,
        () => history.click(),
        (def) =>
          nodeById(def, classifier.id)?.data.include_history?.enabled === true,
      );
      expect(
        nodeById(definition, classifier.id)!.data.include_history.enabled,
      ).toBe(true);

      // On is the blue of the admin Users switches (Tailwind's blue-500).
      await expect(history).toHaveAttribute('data-state', 'checked');
      const adminBlue = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'oklch(62.3% 0.214 259.815)';
        document.body.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      });
      await expect(history).toHaveCSS('background-color', adminBlue);
    });
  });

  test.describe('on a phone', () => {
    test.use({
      viewport: { width: 393, height: 852 },
      hasTouch: true,
      isMobile: true,
    });
    test.skip(
      ({ browserName }) => browserName === 'firefox',
      'Firefox has no isMobile',
    );
    const CDP_ONLY =
      'Playwright only taps, so drags and pinches go through CDP, which only Chromium has';

    test('admin on a phone finds no step list beside the canvas and adds a step from the Add Step sheet', async ({
      page,
    }) => {
      await withFreshPhoneWorkflow(page, async () => {
        const railItem = page.getByRole('button', {
          name: 'Transform',
          exact: true,
          includeHidden: true,
        });
        await expect(railItem).toBeAttached();
        await expect(railItem).toBeHidden();
        const id = await addNodeFromStepSheet(page, 'Transform', 'transform');
        await expect(canvasNode(page, id)).toBeInViewport({ ratio: 0.99 });
      });
    });

    test('admin on a phone pans the canvas with one finger and zooms it with a two-finger pinch', async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', CDP_ONLY);
      await withFreshPhoneWorkflow(page, async () => {
        const layer = canvasNode(page, 'start').locator('xpath=..');
        const layerTransform = () =>
          layer.evaluate((element) => (element as HTMLElement).style.transform);
        const zoomLabel = page
          .getByTestId('workflow-canvas')
          .getByText(/^\d+%$/);
        const zoomPercent = async () =>
          parseInt((await zoomLabel.textContent()) ?? '', 10);

        const startTransform = await layerTransform();
        const finger = await bareCanvasPoint(page, 60);
        await touchGesture(page, [
          { from: finger, to: { x: finger.x - 120, y: finger.y } },
        ]);
        await expect.poll(layerTransform).not.toBe(startTransform);

        const startZoom = await zoomPercent();
        const left = await bareCanvasPoint(page, -40);
        const right = await bareCanvasPoint(page, 40);
        await touchGesture(page, [
          { from: left, to: { x: left.x - 80, y: left.y } },
          { from: right, to: { x: right.x + 80, y: right.y } },
        ]);
        await expect.poll(zoomPercent).toBeGreaterThan(startZoom);
      });
    });

    test('admin on a phone sees the whole canvas toolbar and a step panel that fits the screen', async ({
      page,
    }) => {
      await withFreshPhoneWorkflow(page, async () => {
        const canvas = page.getByTestId('workflow-canvas');
        for (const name of [
          'Pan',
          'Select',
          'Undo',
          'Redo',
          'Zoom Out',
          'Zoom In',
        ]) {
          await expect(
            canvas.getByRole('button', { name, exact: true }),
          ).toBeInViewport({ ratio: 1 });
        }

        await canvasNode(page, 'start').tap();
        const panel = nodePanel(page);
        await expect(panel).toBeVisible({ timeout: 10_000 });
        await expect(panel).toBeInViewport({ ratio: 1 });
        await closeNodePanel(page);
      });
    });

    test('admin on a phone drags from a connection dot onto another step and the connection is saved', async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', CDP_ONLY);
      await withFreshPhoneWorkflow(page, async () => {
        // The While's auto-save is validated and the banner grows with its
        // lines, moving the canvas, so positions are read only after that.
        let whileId = '';
        await captureAutosave(
          page,
          async () => {
            whileId = await addNodeFromStepSheet(page, 'While', 'while');
          },
          (def) => !!nodeOfType(def, 'while'),
        );
        const done = unconnectedBranch(page, whileId, 'done');
        await expect(done).toHaveText('Not connected');

        const dot = page.getByTestId(`workflow-handle-${whileId}-done`);
        const agent = canvasNode(page, 'mentor-1');
        await expect(dot).toBeInViewport();
        await expect(agent).toBeInViewport();
        const from = await settledCentreOf(dot);
        const to = await settledCentreOf(agent);

        const { definition } = await captureAutosave(
          page,
          () => touchGesture(page, [{ from, to }]),
          (def) =>
            def.edges.some(
              (edge) => edge.source === whileId && edge.sourceHandle === 'done',
            ),
        );
        expect(definition.edges).toContainEqual(
          expect.objectContaining({
            source: whileId,
            target: 'mentor-1',
            sourceHandle: 'done',
          }),
        );
        await expect(done).toHaveCount(0);
      });
    });

    test('admin on a phone opens Preview and the chat takes the whole width with its message box on screen', async ({
      page,
      chatPage,
    }) => {
      await withFreshPhoneWorkflow(page, async () => {
        await (await workflowHeaderAction(page, 'Preview')).click();
        await expect(
          page.getByRole('button', { name: 'Close Preview', exact: true }),
        ).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('workflow-canvas')).toBeHidden();

        const composer = chatPage.getComposerTextarea();
        await expect(composer).toBeEditable({ timeout: 15_000 });
        const form = page.locator('form', { has: composer });
        await expect(form).toBeInViewport({ ratio: 1 });
        const box = await form.boundingBox();
        // Only the chat's own padding is left either side.
        expect(box!.width).toBeGreaterThanOrEqual(
          page.viewportSize()!.width - 64,
        );
      });
    });

    test('admin on a phone taps the middle of a connection and the corner of a step and deletes neither', async ({
      page,
      browserName,
    }) => {
      // WebKit's touch emulation may not report a coarse pointer, which would
      // leave the hidden Delete pressable and turn the tap into a real press.
      test.skip(
        browserName !== 'chromium',
        'Coarse pointer checked in Chromium',
      );
      await withFreshPhoneWorkflow(page, async () => {
        const connection = canvasEdge(page, DEFAULT_EDGE_ID);
        const agent = canvasNode(page, 'mentor-1');

        // The press selects the connection and shows Delete Connection right
        // under the finger, before the tap's click.
        const middle = await connectionPoint(page, DEFAULT_EDGE_ID, 0.5);
        await page.touchscreen.tap(middle.x, middle.y);
        await expect(
          page.getByTestId(`workflow-edge-delete-${DEFAULT_EDGE_ID}`),
        ).toBeVisible();
        await expect(connection).toBeAttached();

        // The step's Delete is centred on this corner and shows once the press
        // selects the step. The tap goes to its outer part, past the card:
        // inside the card, Chrome's touch targeting moves the tap onto the
        // Agent Settings button nearby, and the step is never pressed.
        const spot = await agent
          .getByRole('button', { name: /^Delete / })
          .boundingBox();
        expect(spot, "the Agent step's Delete spot").not.toBeNull();
        const corner = {
          x: spot!.x + spot!.width * 0.8,
          y: spot!.y + spot!.height * 0.2,
        };
        const reachesStep = await page.evaluate(({ x, y }) => {
          const hit = document.elementFromPoint(x, y);
          return (
            !!hit?.closest('[data-testid="workflow-node-mentor-1"]') &&
            !hit.closest('button')
          );
        }, corner);
        expect(
          reachesStep,
          'a press there reaches the step, not its hidden Delete',
        ).toBe(true);
        await page.touchscreen.tap(corner.x, corner.y);
        // The tap's click opens the step's settings, so by now it has landed.
        await expect(nodePanel(page)).toBeVisible({ timeout: 10_000 });
        await expect(agent).toBeAttached();
        await expect(connection).toBeAttached();
      });
    });
  });
});
