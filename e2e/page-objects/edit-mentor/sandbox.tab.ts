import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the Sandbox tab inside the Edit Mentor dialog.
 *
 * Renders the SandboxConfig component from @iblai/web-containers. The
 * component has two distinct states keyed off `mentorConfig`:
 *
 *  - NOT CONNECTED: instance picker (search input + Add Instance + table).
 *  - CONNECTED: "Connected Instance" panel + Disconnect + config switches.
 *
 * The component fires sonner toasts as the externally observable success
 * signal for every mutation. We key off those rather than DOM transitions
 * where possible — they're the contract between the SDK and consumers.
 *
 * Toasts (from @iblai/web-containers/dist):
 *   "Instance created"      — handleCreateInstance success
 *   "Instance updated"      — EditInstanceDialog save success
 *   "Instance connected"    — handleConnect success
 *   "Instance disconnected" — handleDisconnect success
 *   "Instance deleted"      — handleDeleteInstance success
 *   "Configuration updated" — auto_push toggle success
 *
 * All locators are scoped to the parent `dialog` Locator so they cannot
 * accidentally match elements outside the Edit Mentor modal.
 *
 * Web-first assertions: methods rely on Playwright's auto-retry and the
 * suite-level expect timeout — no hand-tuned `{ timeout }` values inside
 * the page object. The only exception is `isConnected(timeout)` which is
 * intentionally a timed probe used to branch between states.
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
  readonly editInstanceTokenInput: Locator;
  readonly saveInstanceButton: Locator;
  readonly cancelEditInstanceButton: Locator;

  // ── Connected state ──────────────────────────────────────────────────────
  readonly connectedHeading: Locator;
  readonly disconnectButton: Locator;
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

    // New Instance dialog — OverlayModal portals to document.body so scope
    // to `page`. Match by accessible name (DialogPrimitive.Title="New
    // Instance") rather than `hasText` because the parent Edit Mentor
    // dialog can also contain "New Instance" trigger text.
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
    // The Create button text is "Create" (or "Creating..." while saving).
    // Match the leading "Creat" so both states resolve the same locator.
    this.createInstanceButton = this.newInstanceDialog.getByRole('button', {
      name: /^Creat/i,
    });
    this.cancelNewInstanceButton = this.newInstanceDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });

    // Edit Instance dialog
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
    this.editInstanceTokenInput = this.editInstanceDialog.locator(
      '#edit-instance-token',
    );
    this.saveInstanceButton = this.editInstanceDialog.getByRole('button', {
      name: /^Sav/i,
    });
    this.cancelEditInstanceButton = this.editInstanceDialog.getByRole(
      'button',
      { name: 'Cancel', exact: true },
    );

    // Connected state — the bundle renders <h4>Connected Instance</h4>.
    this.connectedHeading = dialog.getByRole('heading', {
      name: 'Connected Instance',
      exact: true,
    });
    this.disconnectButton = dialog.getByRole('button', {
      name: /disconnect/i,
    });
    this.autoPushToggle = dialog.getByRole('switch', {
      name: /auto push/i,
    });
    this.pushButton = dialog.getByRole('button', { name: /^push$/i });
  }

  // ── State detection ──────────────────────────────────────────────────────

  /**
   * Returns true when the sandbox is in "connected" state. This is a timed
   * probe so callers can branch between connected/not-connected flows; the
   * default is generous enough to ride out the initial settings refetch
   * but still fail fast on truly not-connected envs.
   */
  async isConnected(timeout = 5_000): Promise<boolean> {
    return this.connectedHeading
      .first()
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /** Returns the number of data rows in the instance table (0 if absent). */
  async getInstanceCount(): Promise<number> {
    if (
      !(await this.instanceTable
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      return 0;
    }
    const rows = await this.instanceTable.getByRole('row').count();
    return Math.max(0, rows - 1); // header row
  }

  // ── Instance table operations ────────────────────────────────────────────

  /** Types into the search input and waits for the table to settle. */
  async searchInstances(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await expect(this.instanceTable.getByRole('row').first()).toBeVisible();
  }

  /**
   * Returns the table row locator whose text contains `name`. Names are
   * timestamp-suffixed in tests (e.g. `e2e-instance-1779…`) so substring
   * matching is collision-free.
   */
  getInstanceRowByName(name: string): Locator {
    return this.instanceTable.getByRole('row').filter({ hasText: name });
  }

  /**
   * Opens the per-row dropdown menu. The SandboxConfig dropdown trigger
   * uses `aria-label="Actions"` (or "Connecting instance" while a connect
   * mutation is in flight) — match the leading "Action" prefix.
   */
  async openRowMenu(row: Locator): Promise<void> {
    await row.getByRole('button', { name: /actions/i }).click();
  }

  /**
   * Clicks the Connect item in the open row dropdown and waits for the
   * "Instance connected" toast — the bundle's authoritative signal that
   * `createConfig.unwrap()` resolved.
   */
  async clickConnect(row: Locator): Promise<void> {
    await this.openRowMenu(row);
    await this.page.getByRole('menuitem', { name: /^connect$/i }).click();
    await expect(
      this.page.getByText('Instance connected', { exact: true }),
    ).toBeVisible();
    // Belt + braces: the connected state UI must also reflect the wiring
    // before the next test step runs.
    await expect(this.connectedHeading.first()).toBeVisible();
  }

  /**
   * Clicks the Edit item in the open row dropdown. The Edit Instance
   * dialog is rendered conditionally via `editingInstance && (...)` —
   * waiting for its accessible name asserts mount + visibility.
   */
  async clickEditInRow(row: Locator): Promise<void> {
    await this.openRowMenu(row);
    await this.page.getByRole('menuitem', { name: /^edit$/i }).click();
    await expect(this.editInstanceDialog).toBeVisible();
  }

  /**
   * Clicks the Delete item, confirms in the "Delete Instance" modal
   * (`OverlayModal title="Delete Instance"`), and waits for the
   * "Instance deleted" toast.
   */
  async clickDeleteInRow(row: Locator): Promise<void> {
    await this.openRowMenu(row);
    await this.page.getByRole('menuitem', { name: /^delete$/i }).click();

    const confirmDialog = this.page.getByRole('dialog', {
      name: 'Delete Instance',
      exact: true,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole('button', { name: /^delete$/i })
      .first()
      .click();
    await expect(confirmDialog).toBeHidden();
    await expect(
      this.page.getByText('Instance deleted', { exact: true }),
    ).toBeVisible();
  }

  // ── Add Instance dialog ──────────────────────────────────────────────────

  async openAddInstanceDialog(): Promise<void> {
    await this.addInstanceButton.click();
    await expect(this.newInstanceDialog).toBeVisible();
  }

  /**
   * Fills the New Instance form. `type` defaults to "OpenClaw" when omitted.
   * The Type field is a Radix Select — we click + pick by option role.
   */
  async fillNewInstance(opts: {
    name: string;
    url: string;
    type?: string;
    token?: string;
  }): Promise<void> {
    const { name, url, type = 'OpenClaw', token } = opts;

    await this.newInstanceNameInput.fill(name);

    // The type is a Radix Select (combobox). Native <select> behaviour was
    // never an option in the bundle but the legacy fallback is harmless.
    const isNativeSelect =
      (await this.newInstanceTypeSelect
        .evaluate((el) => el.tagName.toLowerCase())
        .catch(() => '')) === 'select';
    if (isNativeSelect) {
      await this.newInstanceTypeSelect.selectOption(type);
    } else {
      await this.newInstanceTypeSelect.click();
      await this.page
        .getByRole('option', { name: new RegExp(type, 'i') })
        .first()
        .click();
    }

    await this.newInstanceUrlInput.fill(url);
    if (token) {
      await this.newInstanceTokenInput.fill(token);
    }
  }

  /**
   * Clicks Create and waits for the "Instance created" toast (bundle
   * fires this after `createInstance.unwrap()` resolves), then asserts
   * the dialog closed and the row appeared in the table.
   */
  async submitNewInstance(name: string): Promise<void> {
    await expect(this.createInstanceButton).toBeEnabled();
    await this.createInstanceButton.click();
    await expect(
      this.page.getByText('Instance created', { exact: true }),
    ).toBeVisible();
    await expect(this.newInstanceDialog).toBeHidden();
    await expect(this.getInstanceRowByName(name)).toBeVisible();
  }

  // ── Edit Instance dialog ─────────────────────────────────────────────────

  /**
   * Clicks Save in the Edit Instance dialog. Bundle fires "Instance
   * updated" via `updateInstance.unwrap()` then closes the modal.
   */
  async saveInstanceEdit(): Promise<void> {
    await expect(this.saveInstanceButton).toBeEnabled();
    await this.saveInstanceButton.click();
    await expect(
      this.page.getByText('Instance updated', { exact: true }),
    ).toBeVisible();
    await expect(this.editInstanceDialog).toBeHidden();
  }

  // ── Disconnect ───────────────────────────────────────────────────────────

  /**
   * Reads the currently-connected instance name from the connected-state
   * UI. The bundle renders the connected panel as
   *   <p>Name</p><p>{instanceName}</p>
   * one per column (Name / URL / Status / Health / Last Check). Anchor
   * on the "Name" label paragraph by exact text and walk to the value
   * paragraph immediately after it.
   *
   * Returns null when not connected or when the value cannot be parsed.
   */
  async getConnectedInstanceName(): Promise<string | null> {
    if (!(await this.isConnected())) return null;
    const valueParagraph = this.dialog
      .getByText('Name', { exact: true })
      .first()
      .locator('xpath=following-sibling::p[1]');
    return valueParagraph
      .innerText()
      .then((t) => t.trim() || null)
      .catch(() => null);
  }

  /**
   * Clicks Disconnect, confirms in the "Disconnect Instance" modal, and
   * waits for the "Instance disconnected" toast (bundle's success signal).
   * The bundle closes the confirm modal up front via `setShowDisconnectConfirm(false)`,
   * so we don't need to wait for the modal to disappear.
   */
  async disconnect(): Promise<void> {
    await this.disconnectButton.click();

    const confirmDialog = this.page.getByRole('dialog', {
      name: 'Disconnect Instance',
      exact: true,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole('button', { name: /^disconnect$/i })
      .first()
      .click();

    await expect(
      this.page.getByText('Instance disconnected', { exact: true }),
    ).toBeVisible();
    // Not-connected UI restored.
    await expect(this.addInstanceButton).toBeVisible();
  }

  /**
   * Reconnects to a known instance by name. Best-effort: returns false if
   * the named row isn't found or if Connect doesn't wire the mentor.
   */
  async reconnectByName(name: string): Promise<boolean> {
    try {
      await expect(this.addInstanceButton).toBeVisible();
      const row = this.getInstanceRowByName(name);
      await expect(row).toBeVisible();
      await this.clickConnect(row);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Walks the instance table and returns the name of the first OpenClaw
   * instance whose STATUS is *not* "Error" — the SandboxConfig Connect
   * menu item is dimmed (`opacity-50 cursor-not-allowed`) and its
   * `onSelect` short-circuits via `e.preventDefault()` when
   * `isInstanceUnhealthy(status)` is true.
   *
   * `isInstanceUnhealthy(s)` returns true only when status is set AND not
   * one of HEALTHY_STATUS_VALUES (`active|running|connected|ok|ready`).
   * Null/empty status is treated as connectable; StatusDot renders that as
   * "—". Anything else (e.g. "Error") is unconnectable.
   *
   * Returns null when no connectable OpenClaw instance exists.
   */
  async findConnectableOpenClawInstance(): Promise<string | null> {
    if (
      !(await this.instanceTable
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      return null;
    }
    const rows = this.instanceTable.getByRole('row');
    const rowCount = await rows.count();
    // nth(0) is the header row.
    for (let i = 1; i < rowCount; i++) {
      const cells = rows.nth(i).getByRole('cell');
      // Columns: NAME(0) URL(1) TYPE(2) STATUS(3) HEALTH(4) VERSION(5) LAST CHECK(6) ACTIONS(7)
      const typeText = (
        await cells
          .nth(2)
          .innerText()
          .catch(() => '')
      )
        .trim()
        .toLowerCase();
      if (!typeText.includes('openclaw')) continue;
      const statusText = (
        await cells
          .nth(3)
          .innerText()
          .catch(() => '')
      )
        .trim()
        .toLowerCase();
      if (statusText === 'error') continue;
      const name = (
        await cells
          .nth(0)
          .innerText()
          .catch(() => '')
      ).trim();
      if (name) return name;
    }
    return null;
  }

  /**
   * Ensures the mentor's sandbox is wired to a Claw instance. If already
   * connected, returns the connected instance name without changing state.
   * If not connected, finds a healthy OpenClaw instance and connects to it.
   *
   * `createdConnection: true` signals the caller that THEY connected the
   * mentor (and may want to disconnect afterwards to restore env state).
   * Returns `instanceName: null` when no connectable instance exists.
   */
  async ensureConnected(): Promise<{
    instanceName: string | null;
    createdConnection: boolean;
  }> {
    if (await this.isConnected()) {
      return {
        instanceName: await this.getConnectedInstanceName(),
        createdConnection: false,
      };
    }
    const targetName = await this.findConnectableOpenClawInstance();
    if (!targetName) {
      return { instanceName: null, createdConnection: false };
    }
    try {
      await this.clickConnect(this.getInstanceRowByName(targetName));
      return { instanceName: targetName, createdConnection: true };
    } catch {
      return { instanceName: null, createdConnection: false };
    }
  }

  // ── Connected-state operations ───────────────────────────────────────────

  /** Clicks Push and waits for the "Configuration push queued" toast. */
  async pushConfiguration(): Promise<void> {
    await this.pushButton.click();
    await expect(
      this.page.getByText('Configuration push queued', { exact: true }),
    ).toBeVisible();
  }
}
