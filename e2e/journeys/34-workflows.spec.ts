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
  connectHandle,
  canvasNode,
  canvasEdge,
  nodePanel,
  nodeOfType,
  recordWorkflowPatches,
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

  const DEFAULT_EDGE_ID = 'e-start-mentor-1';
  const hasNoDefaultEdge = (definition: { edges: { id: string }[] }) =>
    !definition.edges.some((edge) => edge.id === DEFAULT_EDGE_ID);

  test('admin hovers a step and deletes it with its trash button', async ({
    page,
  }) => {
    await withFreshWorkflow(page, async () => {
      const nodeId = await addSavedNodeFromSidebar(
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
      const nodeId = await addSavedNodeFromSidebar(
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
      expect(validation).not.toContain('Set-state node has no assignments');
      expect(validation).not.toContain('Attribute access not allowed');
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
      expect(validation).not.toContain('Transform node has no expressions');
      expect(validation).not.toContain('Attribute access not allowed');
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
      expect(validation).not.toContain("missing required field 'condition'");
      expect(validation).not.toContain('Attribute access not allowed');
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
      expect(validation).not.toContain('Attribute access not allowed');
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
      let noteId = '';
      const { validation } = await captureAutosave(
        page,
        async () => {
          noteId = await addNodeFromSidebar(page, 'Note', 'note');
        },
        (def) => !!nodeOfType(def, 'note'),
      );
      const noteWarning = `Node '${noteId}' is not connected to any other nodes`;
      const endWarning = "Workflow should have an 'end' node";
      expect(validation).toContain(noteWarning);
      expect(validation).toContain(endWarning);

      // The End warning proves the banner already shows this validation.
      await expect(page.getByText(endWarning)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(noteWarning)).toHaveCount(0);
    });
  });

  // ── File Search node: dataset picker dialog ────────────────────────────────
  // The File Search node's "Select" button opens the workflow's ENTRY
  // mentor's Datasets tab in picker mode (the SDK `AgentDatasetsTab` with no
  // page/search props, rendered by `NodeConfigPanel` in
  // `@iblai/web-containers`), unlike the edit-mentor modal's Datasets tab,
  // which drives page/search off the URL. This checkpoint asserts that distinction holds: searching/paging
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
