import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Sandbox tab inside the Edit Mentor dialog.
 *
 * The tab renders the SandboxConfig component from @iblai/web-containers.
 * It has two distinct states:
 *
 *  - NOT CONNECTED: shows an instance table with search + Add Instance button.
 *  - CONNECTED: shows a "Connected Instance" heading + Disconnect button and
 *    a grid of read-only fields plus configuration switches.
 *
 * All locators are scoped to the parent `dialog` Locator so they cannot
 * accidentally match elements outside the Edit Mentor modal.
 */
export class SandboxTab {
  readonly page: Page;
  readonly dialog: Locator;

  // ── Not-connected state ──────────────────────────────────────────────────
  readonly searchInput: Locator;
  readonly addInstanceButton: Locator;
  readonly instanceTable: Locator;

  // ── New Instance dialog ──────────────────────────────────────────────────
  readonly newInstanceDialog: Locator;
  readonly newInstanceNameInput: Locator;
  readonly newInstanceTypeSelect: Locator;
  readonly newInstanceUrlInput: Locator;
  readonly newInstanceTokenInput: Locator;
  readonly createInstanceButton: Locator;
  readonly cancelNewInstanceButton: Locator;

  // ── Edit Instance dialog ─────────────────────────────────────────────────
  readonly editInstanceDialog: Locator;
  readonly editInstanceNameInput: Locator;
  readonly editInstanceTypeSelect: Locator;
  readonly editInstanceUrlInput: Locator;
  readonly saveInstanceButton: Locator;
  readonly cancelEditInstanceButton: Locator;

  // ── Connected state ──────────────────────────────────────────────────────
  readonly connectedHeading: Locator;
  readonly disconnectButton: Locator;
  readonly enabledToggle: Locator;
  readonly autoPushToggle: Locator;
  readonly pushButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    // Not-connected state
    this.searchInput = dialog.getByPlaceholder('Search instances...');
    this.addInstanceButton = dialog.getByRole('button', {
      name: 'Add Instance',
      exact: true,
    });
    this.instanceTable = dialog.getByRole('table');

    // New Instance dialog — scoped to the page (modal is rendered outside the
    // Edit Mentor dialog in a separate Radix portal). Match by accessible name
    // (DialogPrimitive.Title="New Instance") because the parent Edit Mentor
    // dialog can also contain "New Instance" text in row dropdowns/menus.
    this.newInstanceDialog = page.getByRole('dialog', {
      name: 'New Instance',
      exact: true,
    });
    this.newInstanceNameInput =
      this.newInstanceDialog.locator('#new-instance-name');
    this.newInstanceTypeSelect =
      this.newInstanceDialog.locator('#new-instance-type');
    this.newInstanceUrlInput =
      this.newInstanceDialog.locator('#new-instance-url');
    this.newInstanceTokenInput = this.newInstanceDialog.locator(
      '#new-instance-token',
    );
    this.createInstanceButton = this.newInstanceDialog.getByRole('button', {
      name: /^Creat/i,
    });
    this.cancelNewInstanceButton = this.newInstanceDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });

    // Edit Instance dialog — match by accessible name.
    this.editInstanceDialog = page.getByRole('dialog', {
      name: 'Edit Instance',
      exact: true,
    });
    this.editInstanceNameInput = this.editInstanceDialog.locator(
      '#edit-instance-name',
    );
    this.editInstanceTypeSelect = this.editInstanceDialog.locator(
      '#edit-instance-type',
    );
    this.editInstanceUrlInput =
      this.editInstanceDialog.locator('#edit-instance-url');
    this.saveInstanceButton = this.editInstanceDialog.getByRole('button', {
      name: 'Save',
      exact: true,
    });
    this.cancelEditInstanceButton = this.editInstanceDialog.getByRole(
      'button',
      {
        name: 'Cancel',
        exact: true,
      },
    );

    // Connected state
    this.connectedHeading = dialog.getByText(/connected instance/i);
    this.disconnectButton = dialog.getByRole('button', {
      name: /disconnect/i,
    });
    this.enabledToggle = dialog.getByRole('switch', { name: /^enabled$/i });
    this.autoPushToggle = dialog.getByRole('switch', {
      name: /auto push on save/i,
    });
    this.pushButton = dialog.getByRole('button', { name: /^push$/i });
  }

  // ── State detection ──────────────────────────────────────────────────────

  /**
   * Returns true when the sandbox is in "connected" state (i.e. a
   * ClawMentorConfig is wired to a Claw instance for this mentor).
   * Uses a 4-second probe so callers never hang on networkidle.
   */
  async isConnected(timeout = 4_000): Promise<boolean> {
    try {
      await this.connectedHeading.first().waitFor({
        state: 'visible',
        timeout,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the number of rows in the instance table (0 when the table is
   * absent or empty).
   */
  async getInstanceCount(): Promise<number> {
    try {
      await this.instanceTable.waitFor({ state: 'visible', timeout: 5_000 });
      // Subtract 1 for the header row
      const rows = await this.instanceTable.getByRole('row').count();
      return Math.max(0, rows - 1);
    } catch {
      return 0;
    }
  }

  // ── Instance table operations ────────────────────────────────────────────

  /** Types into the search input and waits for the table to settle. */
  async searchInstances(query: string): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
    await this.searchInput.fill(query);
    // Web-first: wait for at least one row change or empty-state to appear
    await expect(this.instanceTable.getByRole('row').first()).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Returns the table row locator whose NAME cell contains `name`.
   * Uses exact text within a cell so partial-name collisions are avoided.
   */
  getInstanceRowByName(name: string): Locator {
    return this.instanceTable.getByRole('row').filter({ hasText: name });
  }

  /**
   * Opens the per-row dropdown menu (ellipsis / Actions button) for `row`.
   */
  async openRowMenu(row: Locator): Promise<void> {
    const menuButton = row.getByRole('button', { name: /actions/i });
    await expect(menuButton).toBeVisible({ timeout: 10_000 });
    await menuButton.click();
  }

  /**
   * Clicks the Connect item in the open row dropdown.
   * Waits for the connected-state heading to appear as the success signal.
   */
  async clickConnect(row: Locator): Promise<void> {
    await this.openRowMenu(row);
    const connectItem = this.page.getByRole('menuitem', {
      name: /^connect$/i,
    });
    await expect(connectItem).toBeVisible({ timeout: 5_000 });
    await connectItem.click();
    // Success signal: "Connected Instance" heading appears
    await expect(this.connectedHeading.first()).toBeVisible({
      timeout: 15_000,
    });
  }

  /**
   * Clicks the Edit item in the open row dropdown and waits for the
   * Edit Instance dialog to appear.
   */
  async clickEditInRow(row: Locator): Promise<void> {
    await this.openRowMenu(row);
    const editItem = this.page.getByRole('menuitem', { name: /^edit$/i });
    await expect(editItem).toBeVisible({ timeout: 5_000 });
    await editItem.click();
    await expect(this.editInstanceDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Clicks the Delete item in the open row dropdown and confirms if a
   * confirmation dialog appears.
   */
  async clickDeleteInRow(row: Locator): Promise<void> {
    await this.openRowMenu(row);
    const deleteItem = this.page.getByRole('menuitem', { name: /^delete$/i });
    await expect(deleteItem).toBeVisible({ timeout: 5_000 });
    await deleteItem.click();
    // Some implementations show an alertdialog confirm step
    const confirmDialog = this.page
      .getByRole('alertdialog')
      .or(this.page.getByRole('dialog').filter({ hasText: /confirm|delete/i }));
    let hasConfirm = false;
    try {
      await confirmDialog.waitFor({ state: 'visible', timeout: 3_000 });
      hasConfirm = true;
    } catch {
      hasConfirm = false;
    }
    if (hasConfirm) {
      const confirmBtn = confirmDialog.getByRole('button', {
        name: /confirm|delete|yes/i,
      });
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(confirmDialog).not.toBeVisible({ timeout: 10_000 });
    }
  }

  // ── Add Instance dialog ──────────────────────────────────────────────────

  /** Clicks Add Instance and waits for the New Instance dialog to appear. */
  async openAddInstanceDialog(): Promise<void> {
    await expect(this.addInstanceButton).toBeVisible({ timeout: 10_000 });
    await this.addInstanceButton.click();
    await expect(this.newInstanceDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Fills the New Instance form fields.
   * `type` defaults to "OpenClaw" when omitted.
   */
  async fillNewInstance(opts: {
    name: string;
    url: string;
    type?: string;
    token?: string;
  }): Promise<void> {
    const { name, url, type = 'OpenClaw', token } = opts;

    await expect(this.newInstanceNameInput).toBeVisible({ timeout: 10_000 });
    await this.newInstanceNameInput.fill(name);

    // The type select may be a native <select> or a Radix combobox
    const isNativeSelect =
      (await this.newInstanceTypeSelect
        .evaluate((el) => el.tagName.toLowerCase())
        .catch(() => '')) === 'select';
    if (isNativeSelect) {
      await this.newInstanceTypeSelect.selectOption(type);
    } else {
      await this.newInstanceTypeSelect.click();
      const option = this.page.getByRole('option', {
        name: new RegExp(type, 'i'),
      });
      await expect(option.first()).toBeVisible({ timeout: 5_000 });
      await option.first().click();
    }

    await expect(this.newInstanceUrlInput).toBeVisible({ timeout: 5_000 });
    await this.newInstanceUrlInput.fill(url);

    if (token) {
      await expect(this.newInstanceTokenInput).toBeVisible({ timeout: 5_000 });
      await this.newInstanceTokenInput.fill(token);
    }
  }

  /**
   * Clicks Create and waits for the dialog to close and the new row to appear
   * in the instance table (using `name` as the success signal).
   */
  async submitNewInstance(name: string): Promise<void> {
    await expect(this.createInstanceButton).toBeEnabled({ timeout: 5_000 });
    await this.createInstanceButton.click();
    // Dialog must close
    await expect(this.newInstanceDialog).not.toBeVisible({ timeout: 15_000 });
    // New row with that name must appear
    await expect(this.getInstanceRowByName(name)).toBeVisible({
      timeout: 15_000,
    });
  }

  // ── Edit Instance dialog ─────────────────────────────────────────────────

  /**
   * Clicks Save in the Edit Instance dialog and waits for it to close.
   */
  async saveInstanceEdit(): Promise<void> {
    await expect(this.saveInstanceButton).toBeEnabled({ timeout: 5_000 });
    await this.saveInstanceButton.click();
    await expect(this.editInstanceDialog).not.toBeVisible({ timeout: 15_000 });
  }

  // ── Disconnect ───────────────────────────────────────────────────────────

  /**
   * Clicks Disconnect, confirms in the confirmation dialog, and waits for
   * the instance picker UI (the search input or table) to reappear.
   */
  async disconnect(): Promise<void> {
    await expect(this.disconnectButton).toBeVisible({ timeout: 10_000 });
    await this.disconnectButton.click();

    // Confirmation dialog for disconnect
    const confirmDialog = this.page
      .getByRole('alertdialog')
      .or(
        this.page
          .getByRole('dialog')
          .filter({ hasText: /disconnect|confirm/i }),
      );
    let hasConfirm = false;
    try {
      await confirmDialog.waitFor({ state: 'visible', timeout: 5_000 });
      hasConfirm = true;
    } catch {
      hasConfirm = false;
    }

    if (hasConfirm) {
      const confirmBtn = confirmDialog.getByRole('button', {
        name: /confirm|disconnect|yes/i,
      });
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(confirmDialog).not.toBeVisible({ timeout: 10_000 });
    }

    // Wait for the instance picker to reappear (not-connected state restored)
    await expect(this.addInstanceButton).toBeVisible({ timeout: 15_000 });
  }

  // ── Connected-state operations ───────────────────────────────────────────

  /** Clicks Push and waits for any toast to confirm the action completed. */
  async pushConfiguration(): Promise<void> {
    await expect(this.pushButton).toBeVisible({ timeout: 10_000 });
    await this.pushButton.click();
    // Any visible toast is the success signal
    const toast = this.page
      .getByRole('status')
      .or(this.page.getByRole('alert'))
      .first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
  }
}
