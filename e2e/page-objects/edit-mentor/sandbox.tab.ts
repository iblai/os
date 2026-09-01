import { Page, Locator, expect } from '@playwright/test';
import {
  verifySandboxKindsVisible,
  isSandboxKindEnabled,
  verifyClawSectionVisible,
  verifyClawSectionHidden,
  type SandboxKind,
} from '@iblai/iblai-js/playwright';

export type { SandboxKind };

/**
 * Page object for the Sandbox tab inside the Edit Mentor dialog.
 *
 * Renders the SandboxConfig component from @iblai/iblai-js/web-containers
 * directly — there is no app-level capability gate around it any more. The
 * component always renders a "Sandbox Type" card with three kind switches
 * (`sandbox-kind-computational-runtime`, `sandbox-kind-virtual-machine`,
 * `sandbox-kind-claw`). The three kinds are MUTUALLY EXCLUSIVE and AT LEAST
 * ONE IS ALWAYS ACTIVE — "Only one sandbox type can be enabled at a time"
 * per the card's own subheading: kinds change ONLY by selecting a different
 * kind, which atomically deactivates whichever kind was previously active in
 * the same PATCH. There is no "disable" operation — toggling the
 * currently-active kind's own switch off (leaving none active) is not a
 * supported flow, so specs should never assert an all-off state; use
 * `selectKind()`, never a boolean on/off toggle, to change which kind is
 * active. (An older SDK build briefly supported an all-off state — that
 * contract is gone; don't trust stray "leaves none enabled" wording in
 * vendored docstrings over this.) Nothing gets a persistent `disabled`
 * state — each switch is only briefly disabled while its own save is in
 * flight (`isSavingSandboxKind`), never because of which kind is active.
 * The claw connected/not-connected sections (instance picker / "Connected
 * Instance" panel) render ONLY while the Claw kind is enabled — they are
 * not merely grayed out when Claw is off, they are absent from the DOM
 * entirely.
 *
 *  - NOT CONNECTED (claw on, no wired instance): instance picker (search
 *    input + Add Instance + table).
 *  - CONNECTED (claw on, wired instance): "Connected Instance" panel +
 *    Disconnect + config switches.
 *
 * The kind switches wrap the SDK's own Playwright helpers
 * (`@iblai/iblai-js/playwright` → `claw-sandbox-helpers`) rather than
 * hand-rolled locators, since the SDK owns that DOM and ships helpers for it.
 * Specs should go through this page object rather than importing those SDK
 * helpers directly, consistent with how the rest of this class wraps SDK
 * behavior for the connected/not-connected sections below.
 *
 * The component otherwise fires sonner toasts as the externally observable
 * success signal for every mutation. We key off those rather than DOM
 * transitions where possible — they're the contract between the SDK and
 * consumers.
 *
 * Toasts (from @iblai/iblai-js/web-containers/dist):
 *   "Sandbox type updated"  — sandbox-kind switch toggle success
 *   "Instance created"      — handleCreateInstance success
 *   "Instance updated"      — EditInstanceDialog save success
 *   "Instance connected"    — handleConnect success
 *   "Instance disconnected" — handleDisconnect success
 *   "Instance deleted"      — handleDeleteInstance success
 *   "Configuration updated" — auto_push toggle success
 *
 * Most locators are scoped to the parent `dialog` Locator so they cannot
 * accidentally match elements outside the Edit Mentor modal. The sandbox-kind
 * switches are the exception — the underlying SDK helpers resolve them via
 * `page.getByTestId`, unscoped, since only one Edit Mentor dialog is ever
 * open at a time in these tests.
 *
 * Web-first assertions: methods rely on Playwright's auto-retry and the
 * suite-level expect timeout — no hand-tuned `{ timeout }` values inside
 * the page object. The only exception is `isConnected(timeout)` which is
 * intentionally a timed probe used to branch between states.
 */
export class SandboxTab {
  readonly page: Page;
  readonly dialog: Locator;

  // ── Sandbox kind selector ────────────────────────────────────────────────
  // Always rendered (no gate). Mutually exclusive AND at least one kind is
  // always active: selecting one kind turns off whichever kind was
  // previously active. There is no "disable" operation.
  readonly computationalRuntimeSwitch: Locator;
  readonly virtualMachineSwitch: Locator;
  readonly clawSwitch: Locator;

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

    // Sandbox kind selector — unscoped page-level testids (matching the SDK
    // helpers), only one Edit Mentor dialog is ever open at a time.
    this.computationalRuntimeSwitch = page.getByTestId(
      'sandbox-kind-computational-runtime',
    );
    this.virtualMachineSwitch = page.getByTestId(
      'sandbox-kind-virtual-machine',
    );
    this.clawSwitch = page.getByTestId('sandbox-kind-claw');

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

  // ── Sandbox kind selector ────────────────────────────────────────────────
  // Thin wrappers around the SDK's own `claw-sandbox-helpers` Playwright
  // helpers — the SDK owns this DOM (SandboxConfig from
  // @iblai/iblai-js/web-containers), so its helpers are the source of truth
  // for how to interact with it. Specs call through this page object rather
  // than importing the SDK helpers directly.

  /** Display label used in the SDK's info-tooltip aria-labels, per kind. */
  private kindLabel(kind: SandboxKind): string {
    switch (kind) {
      case 'computational-runtime':
        return 'Computing Runtime';
      case 'virtual-machine':
        return 'Virtual Machine Shell';
      case 'claw':
        return 'Claw';
    }
  }

  /** Locator for a kind row's switch, by kind. */
  kindSwitch(kind: SandboxKind): Locator {
    switch (kind) {
      case 'computational-runtime':
        return this.computationalRuntimeSwitch;
      case 'virtual-machine':
        return this.virtualMachineSwitch;
      case 'claw':
        return this.clawSwitch;
    }
  }

  /**
   * The row's info-icon tooltip trigger (accessible name "More info about
   * {kind}"). Hovering it reveals the kind's detail-tooltip copy (what the
   * kind does) — there is no "disabled by claw" style note any more, since
   * no kind ever gets a persistent disabled state.
   */
  kindInfoTrigger(kind: SandboxKind): Locator {
    return this.page.getByRole('button', {
      name: `More info about ${this.kindLabel(kind)}`,
    });
  }

  /** Verify all three sandbox-kind switches are visible. */
  async verifyKindsVisible(): Promise<void> {
    await verifySandboxKindsVisible(this.page);
  }

  /** Whether a sandbox-kind switch is currently on. */
  async isKindEnabled(kind: SandboxKind): Promise<boolean> {
    return isSandboxKindEnabled(this.page, kind);
  }

  /**
   * Toggles a sandbox-kind switch. Only meaningful when `kind` is currently
   * OFF: selecting it atomically activates it and deactivates whichever kind
   * was previously active (mutual exclusivity). At least one kind is ALWAYS
   * active — there is no supported way to turn the currently-active kind
   * off without selecting a different one, so callers should never invoke
   * this on the kind that's already active (that's an unsupported "disable"
   * flow, not a toggle-to-off). Prefer `selectKind()`, which enforces this.
   *
   * Implemented locally rather than via the SDK's `toggleSandboxKind`: that
   * helper waits for the switch's aria-checked flip FIRST and only then for
   * the "Sandbox type updated" toast — but sonner toasts auto-dismiss after
   * ~4s, so whenever the state assertion retries for longer than that the
   * toast is already gone and the helper fails on an interaction that
   * actually succeeded. Deterministic completion signals used instead: the
   * mentor-settings PATCH response resolving OK, then the switch holding the
   * target aria-checked state (a rejected PATCH rolls the optimistic flip
   * back, so the state assertion would catch a real failure).
   */
  async toggleKind(kind: SandboxKind): Promise<void> {
    const kindSwitch = this.kindSwitch(kind);
    await expect(kindSwitch).toBeVisible({ timeout: 10_000 });
    await expect(kindSwitch).toBeEnabled({ timeout: 10_000 });
    const target = (await kindSwitch.getAttribute('aria-checked')) !== 'true';

    // Register the response wait BEFORE clicking so the save can't win the
    // race. The mentor-settings update is a PUT to .../mentors/{id}/settings/
    // (aiMentorOrgsUsersMentorsSettingsUpdate); accept PATCH too in case the
    // API client ever switches to a partial update.
    const saveDone = this.page.waitForResponse(
      (resp) => {
        const method = resp.request().method();
        return (
          (method === 'PUT' || method === 'PATCH') &&
          resp.url().includes('/api/ai-mentor/') &&
          resp.url().includes('/settings/')
        );
      },
      { timeout: 20_000 },
    );
    await kindSwitch.click();
    const response = await saveDone;
    if (!response.ok()) {
      throw new Error(
        `Sandbox-kind save failed with ${response.status()} for ${kind}`,
      );
    }
    await expect(kindSwitch).toHaveAttribute('aria-checked', String(target), {
      timeout: 10_000,
    });
  }

  /**
   * Idempotently makes `kind` the active sandbox kind. No-ops if `kind` is
   * already active. At least one kind is always active on a mentor — kinds
   * change ONLY by selecting a different one (mutual exclusivity turns the
   * previously-active kind off atomically, in the same request); there is
   * no "disable" operation, so this can never leave all three off. This is
   * the primary API specs should use to change sandbox kind — prefer it
   * over calling `toggleKind` directly.
   */
  async selectKind(kind: SandboxKind): Promise<void> {
    const isOn = await this.isKindEnabled(kind);
    if (isOn) return;
    await this.toggleKind(kind);
  }

  /**
   * Returns whichever sandbox kind is currently active. At least one kind
   * is always active, so this never legitimately returns nothing — callers
   * that need to restore a mentor's original kind after a test-local
   * `selectKind()` should record this beforehand, then `selectKind()` back
   * to it afterwards, rather than assuming a fresh mentor starts with any
   * particular kind (or with none at all).
   */
  async getActiveKind(): Promise<SandboxKind> {
    const kinds: SandboxKind[] = [
      'computational-runtime',
      'virtual-machine',
      'claw',
    ];
    for (const kind of kinds) {
      if (await this.isKindEnabled(kind)) return kind;
    }
    // Defensive fallback — unreachable given the "always one active"
    // invariant, but avoids a hard crash if that invariant is ever
    // violated in a given env.
    return 'computational-runtime';
  }

  /**
   * Verify the Claw instance section (not-connected instance table or the
   * connected-instance card) renders below the kind selector. Only true
   * while the Claw kind is enabled.
   */
  async verifyClawInstanceSectionVisible(): Promise<void> {
    await verifyClawSectionVisible(this.page);
  }

  /**
   * Verify the Claw instance section is absent — the state while Claw is
   * not the selected kind.
   */
  async verifyClawInstanceSectionHidden(): Promise<void> {
    await verifyClawSectionHidden(this.page);
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
   * Opens the per-row three-dot "Actions" dropdown menu (Run checks / Edit /
   * Delete). Connect is no longer a menu item — it's a dedicated button next
   * to this trigger (see `getConnectButton` / `clickConnect`).
   */
  async openRowMenu(row: Locator): Promise<void> {
    await row.getByRole('button', { name: /actions/i }).click();
  }

  /**
   * Locator for the row's dedicated Connect button
   * (`data-testid="connect-instance-<id>"`). Resolved by testid PREFIX
   * (rather than role+name) so it also matches while the button reads
   * "Connecting…" mid-mutation. Disabled (not clickable) when the instance
   * is unhealthy — see `findConnectableOpenClawInstance`.
   */
  getConnectButton(row: Locator): Locator {
    return row.locator('[data-testid^="connect-instance-"]');
  }

  /**
   * Clicks the row's dedicated Connect button and waits for the
   * connected-state UI to render. We deliberately do NOT wait for the
   * "Instance connected" sonner toast: it auto-dismisses after ~4s and is
   * racy in slower CI runners (it can disappear before Playwright's first
   * retry poll). The "Connected Instance" heading is the durable post-state
   * — its appearance is the authoritative signal that `createConfig`
   * resolved and RTK cache invalidated.
   */
  async clickConnect(row: Locator): Promise<void> {
    await this.getConnectButton(row).click();
    await expect(this.connectedHeading.first()).toBeVisible({
      timeout: 15_000,
    });
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
   * Clicks the Delete item and confirms in the "Delete Instance" modal.
   * We deliberately do NOT wait for the "Instance deleted" sonner toast —
   * it auto-dismisses after ~4s and is racy in slower CI runs. The
   * confirm modal disappearing is the durable success signal.
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
    await expect(confirmDialog).toBeHidden({ timeout: 10_000 });
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
   * Clicks Create and waits for the durable post-state: dialog closes and
   * the new row appears in the instance table. We don't wait for the
   * "Instance created" sonner toast — it auto-dismisses after ~4s and is
   * racy in slower CI runs.
   */
  async submitNewInstance(name: string): Promise<void> {
    await expect(this.createInstanceButton).toBeEnabled();
    await this.createInstanceButton.click();
    await expect(this.newInstanceDialog).toBeHidden({ timeout: 10_000 });
    await expect(this.getInstanceRowByName(name)).toBeVisible({
      timeout: 10_000,
    });
  }

  // ── Edit Instance dialog ─────────────────────────────────────────────────

  /**
   * Clicks Save in the Edit Instance dialog and waits for the dialog to
   * close — the durable post-state once `updateInstance` resolves.
   * We don't wait for the "Instance updated" sonner toast (auto-dismisses
   * after ~4s, racy in slower CI).
   */
  async saveInstanceEdit(): Promise<void> {
    await expect(this.saveInstanceButton).toBeEnabled();
    await this.saveInstanceButton.click();
    await expect(this.editInstanceDialog).toBeHidden({ timeout: 10_000 });
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

    // Don't wait for the "Instance disconnected" sonner toast (auto-dismisses
    // after ~4s, racy in slower CI). The Add Instance button reappearing is
    // the durable signal that the not-connected UI has been restored.
    await expect(this.addInstanceButton).toBeVisible({ timeout: 15_000 });
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
   * instance whose STATUS is *not* "Error" — the dedicated Connect button
   * (`data-testid="connect-instance-<id>"`) is `disabled` and wrapped in a
   * tooltip explaining why when `isInstanceUnhealthy(status)` is true.
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
