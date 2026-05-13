import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the "Evals" tab inside the Edit Mentor modal.
 *
 * The tab body is rendered by `AgentEvaluationTab` from
 * `@iblai/web-containers` (v1.6.12+), wrapped locally to inject
 * `AgentSettingsProvider`, `getLLMProviderDetails`, and `IblPagination`.
 *
 * Locator strategy mirrors the default AGENT_EVALUATION_TAB_LABELS — if
 * the upstream package changes label text we want the tests to fail loudly
 * so we know to refresh the page object.
 */
export class EvaluationTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly heading: Locator;
  readonly description: Locator;
  readonly datasetCombobox: Locator;
  readonly newEvaluationButton: Locator;
  readonly emptyDatasets: Locator;
  readonly emptyRunsState: Locator;
  readonly runRows: Locator;
  readonly tableHeaderEvaluation: Locator;
  readonly tableHeaderStatus: Locator;
  readonly tableHeaderInitiatedBy: Locator;
  readonly tableHeaderCreated: Locator;
  readonly tableHeaderActions: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.heading = dialog.getByRole('heading', { name: /^evals$/i });
    this.description = dialog.getByText(
      /Run this mentor against a dataset and score the responses/i,
    );
    this.datasetCombobox = dialog
      .getByRole('combobox')
      .or(dialog.getByRole('button', { name: /select a dataset/i }))
      .first();
    this.newEvaluationButton = dialog.getByRole('button', {
      name: /new evaluation/i,
    });
    this.emptyDatasets = dialog.getByText(
      /No datasets yet\. Create one from organization settings/i,
    );
    this.emptyRunsState = dialog.getByText(
      /No evaluations yet for this mentor on dataset/i,
    );
    this.runRows = dialog
      .getByRole('row')
      .filter({ has: dialog.getByRole('button', { name: /actions for /i }) });
    this.tableHeaderEvaluation = dialog
      .getByRole('columnheader', { name: /^evaluation$/i })
      .or(dialog.getByText(/^EVALUATION$/));
    this.tableHeaderStatus = dialog
      .getByRole('columnheader', { name: /^status$/i })
      .or(dialog.getByText(/^STATUS$/));
    this.tableHeaderInitiatedBy = dialog
      .getByRole('columnheader', { name: /^initiated by$/i })
      .or(dialog.getByText(/^INITIATED BY$/));
    this.tableHeaderCreated = dialog
      .getByRole('columnheader', { name: /^created$/i })
      .or(dialog.getByText(/^CREATED$/));
    this.tableHeaderActions = dialog
      .getByRole('columnheader', { name: /^actions$/i })
      .or(dialog.getByText(/^ACTIONS$/));
  }

  /**
   * True when at least one evaluation row is rendered. Returns false on the
   * empty state or when no dataset is selected yet.
   */
  async hasRuns(): Promise<boolean> {
    return this.runRows
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  /**
   * True when the "no datasets" call-to-action is rendered (tenant has no
   * eval datasets defined yet — `AgentEvaluationTab` short-circuits the
   * table in this branch).
   */
  async hasNoDatasetsState(): Promise<boolean> {
    return this.emptyDatasets.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  /**
   * Open the dataset combobox. The picker uses a Radix popover, so we wait
   * for the listbox/menu to attach before returning it.
   */
  async openDatasetPicker(): Promise<Locator> {
    await expect(this.datasetCombobox).toBeVisible({ timeout: 10_000 });
    await this.datasetCombobox.click();
    const listbox = this.page
      .getByRole('listbox')
      .or(this.page.getByRole('menu'))
      .first();
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    return listbox;
  }

  /**
   * Open the "New Evaluation" modal via the primary CTA. Returns the
   * dialog locator filtered by its title so callers can scope further
   * interactions to it.
   */
  async openNewEvaluationModal(): Promise<Locator> {
    await expect(this.newEvaluationButton).toBeEnabled({ timeout: 10_000 });
    await this.newEvaluationButton.click();
    const modal = this.page
      .getByRole('dialog')
      .filter({ hasText: /new evaluation/i })
      .last();
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  /**
   * Open the actions dropdown for a specific run row and return the menu.
   */
  async openRunActionsMenu(runName: string): Promise<Locator> {
    const trigger = this.dialog.getByRole('button', {
      name: new RegExp(`actions for ${escapeRegex(runName)}`, 'i'),
    });
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();
    const menu = this.page.getByRole('menu').first();
    await expect(menu).toBeVisible({ timeout: 10_000 });
    return menu;
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
