import { Page, Locator, expect } from '@playwright/test';

import { SidebarPage } from './sidebar.page';

export type SecretsSection = 'llms' | 'services' | 'env';

/** The columns of the LLMs and Services tables. */
export const KEY_COLUMNS = ['Name', 'Key', 'Actions'] as const;
export const ENV_VAR_COLUMNS = [
  'Name',
  'Variable Name',
  'Allowed Hosts',
  'Actions',
] as const;

const ADD_BUTTON_TEST_IDS: Record<SecretsSection, string> = {
  llms: 'secrets-add-llm',
  services: 'secrets-add-service',
  env: 'vm-secret-new',
};

/**
 * Page object for the organization's **Secrets** page: the SDK `SecretsTab`
 * (`@iblai/web-containers`) that the admin sidebar's "Secrets" footer row opens
 * in a dialog titled "Secrets". It has one sub-tab per kind of key and opens on
 * the first: LLMs (an AI provider's key), Services (a known service's key) and
 * Environment Variables (every VM secret). Each tab has its own sentence, Add
 * button and table, and only the open tab is mounted. Add LLM and Add Service open
 * the SDK `VmSecretDialog` on a type-to-search box whose suggestions sit in the
 * form itself; Add Environment Variable opens straight on its form.
 *
 * ── Dialog-first locators ────────────────────────────────────────────────
 *
 * The form and the delete confirmation portal to `document.body` on top of the
 * "Secrets" dialog and repeat names ("Name", "Cancel"), so each layer is first
 * resolved by role AND accessible name and everything inside is queried from it.
 * While one is open Radix hides the "Secrets" dialog from the accessibility
 * tree, so anything rooted on `dialog` resolves to nothing until it has closed:
 * wait for the nested layer to be hidden before asserting on the rows.
 */
export class SecretsPage {
  readonly page: Page;

  readonly dialog: Locator;
  readonly tabs: Locator;
  readonly section: Locator;
  readonly table: Locator;
  readonly columnHeaders: Locator;
  readonly rows: Locator;
  readonly emptyMessage: Locator;

  /** The add / edit form under any of its titles. */
  readonly secretDialog: Locator;
  readonly addDialog: Locator;
  readonly editDialog: Locator;
  /** The form's first box, where a name is typed. */
  readonly serviceSearch: Locator;
  /** The sentence in the open list when nothing matches what was typed. */
  readonly serviceNoMatch: Locator;
  /** The row that replaces the box once a suggestion is clicked. */
  readonly servicePicked: Locator;
  /** That row's Change button, which brings the box back. */
  readonly serviceChangeButton: Locator;
  /** The sentence under the box after picking an LLM. */
  readonly aiHint: Locator;
  /** The sentence under the box after picking a service agents can use. */
  readonly agentHint: Locator;
  /** The sentence and Try Again under the box when a list of choices failed. */
  readonly choicesFailed: Locator;
  readonly choicesRetry: Locator;
  readonly nameInput: Locator;
  readonly keyInput: Locator;
  readonly envVarInput: Locator;
  readonly hostsInput: Locator;
  readonly hostsList: Locator;
  /** The chip input's `aria-live` line: why an entry was refused. */
  readonly hostsError: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;

  private readonly footerButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.footerButton = new SidebarPage(page).secretsButton;

    this.dialog = page.getByRole('dialog', { name: 'Secrets', exact: true });
    this.tabs = this.dialog.getByRole('tab');
    this.section = this.dialog.getByTestId('vm-secrets-section');
    this.table = this.section.getByRole('table');
    this.columnHeaders = this.table.locator('th');
    this.rows = this.table.locator('tbody tr');
    this.emptyMessage = this.table.getByTestId('vm-secrets-empty');

    this.secretDialog = page.getByRole('dialog', {
      name: /^(Add|Edit) (LLM|Service|Environment Variable)$/,
    });
    this.addDialog = page.getByRole('dialog', {
      name: /^Add (LLM|Service|Environment Variable)$/,
    });
    this.editDialog = page.getByRole('dialog', {
      name: /^Edit (LLM|Service|Environment Variable)$/,
    });
    this.serviceSearch = this.secretDialog.getByTestId(
      'vm-secret-service-select',
    );
    this.serviceNoMatch = this.secretDialog.getByTestId(
      'vm-secret-service-no-match',
    );
    this.servicePicked = this.secretDialog.getByTestId(
      'vm-secret-service-picked',
    );
    this.serviceChangeButton = this.secretDialog.getByTestId(
      'vm-secret-service-change',
    );
    this.aiHint = this.secretDialog.getByTestId('vm-secret-ai-hint');
    this.agentHint = this.secretDialog.getByTestId(
      'vm-secret-service-agent-hint',
    );
    this.choicesFailed = this.secretDialog.getByTestId(
      'vm-secret-choices-failed',
    );
    this.choicesRetry = this.secretDialog.getByTestId(
      'vm-secret-choices-retry',
    );
    this.nameInput = this.secretDialog.getByLabel('Name', { exact: true });
    this.keyInput = this.secretDialog.getByTestId('vm-secret-value');
    this.envVarInput = this.secretDialog.getByTestId('vm-secret-env-var');
    const hosts = this.secretDialog.getByTestId('vm-secret-hosts');
    this.hostsInput = hosts.getByRole('textbox');
    this.hostsList = hosts.getByRole('list', {
      name: 'Allowed Hosts',
      exact: true,
    });
    this.hostsError = hosts.locator('p[aria-live="polite"]');
    this.saveButton = this.secretDialog.getByTestId('vm-secret-save');
    this.cancelButton = this.secretDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });

    this.deleteDialog = page.getByRole('dialog', {
      name: /^Delete (LLM|Service|Environment Variable)$/,
    });
    this.deleteConfirmButton = this.deleteDialog.getByTestId(
      'vm-secret-delete-confirm',
    );
  }

  /** Opens the page, which lands on its first tab. */
  async open(): Promise<void> {
    await expect(this.footerButton).toBeVisible({ timeout: 15_000 });
    await this.footerButton.click();
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
    await expect(this.section).toBeVisible({ timeout: 30_000 });
  }

  async close(): Promise<void> {
    const closeButton = this.dialog
      .getByRole('button', { name: /close/i })
      .last();
    await closeButton.click();
    await expect(this.dialog).not.toBeVisible({ timeout: 10_000 });
  }

  tab(section: SecretsSection): Locator {
    return this.dialog.getByTestId(`secrets-tab-${section}`);
  }

  async openTab(section: SecretsSection): Promise<void> {
    await this.tab(section).click();
    await expect(this.tab(section)).toHaveAttribute('data-state', 'active', {
      timeout: 5_000,
    });
  }

  addButton(section: SecretsSection): Locator {
    return this.section.getByTestId(ADD_BUTTON_TEST_IDS[section]);
  }

  /** Waits for the tab's lists to answer, since its button is greyed out until then. */
  async openAdd(section: SecretsSection): Promise<void> {
    await expect(this.addButton(section)).toBeEnabled({ timeout: 30_000 });
    await this.addButton(section).click();
    await expect(this.addDialog).toBeVisible({ timeout: 10_000 });
  }

  /** A suggestion in the box's list: a service's slug, or `ai-<slug>` for an LLM. */
  serviceOption(choice: string): Locator {
    return this.secretDialog.getByTestId(`vm-secret-service-${choice}`);
  }

  async pickService(name: string, choice: string): Promise<void> {
    await this.serviceSearch.fill(name);
    const option = this.serviceOption(choice);
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(this.servicePicked).toBeVisible({ timeout: 5_000 });
  }

  /** A service's or an LLM's own box. */
  field(name: string): Locator {
    return this.secretDialog.getByTestId(`vm-secret-field-${name}`);
  }

  /** Types one address and commits it with Enter. */
  async addHost(host: string): Promise<void> {
    await this.hostsInput.fill(host);
    await this.hostsInput.press('Enter');
  }

  hostChip(host: string): Locator {
    return this.hostsList.getByRole('listitem').filter({ hasText: host });
  }

  /**
   * A row by its id: `ai-<slug>` for an LLM and `ai-<slug>-<model>` for an Azure
   * OpenAI model; `service-<slug>` for an app no agent uses yet; the `ENV_VAR`
   * for an app agents use and for every row on Environment Variables.
   */
  row(id: string): Locator {
    return this.section.getByTestId(`vm-secret-row-${id}`);
  }

  /** The Key cell of a row on LLMs or Services; an Azure OpenAI model's row has the same columns. */
  keyCell(id: string): Locator {
    return this.row(id).locator('td').nth(KEY_COLUMNS.indexOf('Key'));
  }

  /** The Variable Name cell of a row on Environment Variables. */
  envVarCell(id: string): Locator {
    return this.row(id)
      .locator('td')
      .nth(ENV_VAR_COLUMNS.indexOf('Variable Name'));
  }

  /** The Allowed Hosts cell of a row on Environment Variables. */
  hostsCell(id: string): Locator {
    return this.row(id)
      .locator('td')
      .nth(ENV_VAR_COLUMNS.indexOf('Allowed Hosts'));
  }

  async openEdit(id: string): Promise<void> {
    await this.row(id).getByTestId(`vm-secret-row-${id}-edit`).click();
    await expect(this.editDialog).toBeVisible({ timeout: 10_000 });
  }

  async openDelete(id: string): Promise<void> {
    await this.row(id).getByTestId(`vm-secret-row-${id}-delete`).click();
    await expect(this.deleteDialog).toBeVisible({ timeout: 10_000 });
  }

  async expectToast(text: string, timeout = 30_000): Promise<void> {
    await expect(
      this.page.getByText(text, { exact: true }).first(),
    ).toBeVisible({ timeout });
  }
}
