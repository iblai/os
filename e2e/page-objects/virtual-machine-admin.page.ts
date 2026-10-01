import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the tenant-level **Virtual Machine** settings.
 *
 * They live in the SDK `Account` rail of the User Profile dialog (More
 * options → the platform name — the route journey 38 takes to the Advanced
 * tab), whose "Virtual Machine" entry is listed for admins only. Its body is
 * the SDK `VirtualMachineAdminTab` (`@iblai/web-containers`), which hosts two
 * sub-tabs, each hidden when its list call answers 403:
 *
 *   - **Network Policies** (`vm-network-policies-section`): a table of
 *     named `host:port` allowlists with create / edit / delete through the
 *     SDK `NetworkPolicyDialog`. Hosts are entered
 *     through the SDK `HostPortChipInput`: type one entry and press Enter
 *     (or `,` / space, or paste a list); the client-side check explains a
 *     rejected entry in an `aria-live="polite"` line under the input and
 *     leaves it in the box instead of adding a chip. Backspace on an empty
 *     box removes the last chip; every chip has a "Remove {host}" button.
 *   - **Secrets** (`vm-secrets-section`): a table of VM secrets with the
 *     SDK `VmSecretDialog`. A value is never returned by any endpoint, so
 *     the dialog never prefills it — on edit the value box stays blank
 *     ("Leave blank to keep the current value") and the `env_var` box is
 *     read-only.
 *
 * ── Dialog-first locators ────────────────────────────────────────────────
 *
 * Up to three layers are stacked here at once: the User Profile dialog, a
 * policy / secret dialog on top of it, and (for deletes) a confirmation.
 * They share field and button names ("Name", "Allowed Hosts", "Cancel",
 * "Save Changes"), so nothing is looked up from the page by test id or
 * label alone. Each layer is first resolved by its ARIA role AND its
 * accessible name — the SDK `DialogTitle` — and every inner element is then
 * queried from that dialog locator:
 *
 *   User Profile ─ `getByRole('dialog', { name: 'User Profile', exact: true })`
 *   New / Edit Network Policy, New / Edit VM Secret
 *   Delete Network Policy, Delete VM Secret
 *
 * All of them are plain Radix dialogs (role `dialog` — the confirmations are
 * NOT `alertdialog`) that portal to `document.body`, so they are rooted on
 * the page; the tables are rooted on the User Profile dialog.
 *
 * While a nested dialog is open, Radix hides the User Profile dialog from
 * the accessibility tree, so anything rooted on `dialog` (rows, sections)
 * resolves to nothing until the nested dialog has closed. Always wait for
 * the nested dialog to be hidden before asserting on the tables — a
 * `toHaveCount(0)` on a row would otherwise pass for the wrong reason.
 *
 * Copy is matched exactly as the SDK renders it: labels, titles and buttons
 * are Title Case ("Environment Variable", "Allowed Hosts", "Stored Value"),
 * toasts and sentences are sentence case ("VM secret created").
 */
export class VirtualMachineAdminPage {
  readonly page: Page;

  /** The User Profile dialog that hosts the SDK Account rail. */
  readonly dialog: Locator;
  /** The rail's "Virtual Machine" entry (admin-only). */
  readonly virtualMachineTab: Locator;
  readonly infoBox: Locator;
  readonly loadingSkeleton: Locator;
  readonly forbiddenNotice: Locator;
  readonly policiesSubTab: Locator;
  readonly secretsSubTab: Locator;

  // ── Network policies ─────────────────────────────────────────────────────
  readonly policiesSection: Locator;
  readonly newPolicyButton: Locator;
  /** The policy form dialog in either mode ("New …" or "Edit Network Policy"). */
  readonly policyDialog: Locator;
  /** The same dialog, resolved only while it is in create mode. */
  readonly newPolicyDialog: Locator;
  /** The same dialog, resolved only while it is in edit mode. */
  readonly editPolicyDialog: Locator;
  readonly policyNameInput: Locator;
  readonly policyHostsInput: Locator;
  readonly policyHostsList: Locator;
  /** The chip input's `aria-live` line: the first problem with a rejected entry. */
  readonly policyHostsError: Locator;
  readonly policyDescriptionInput: Locator;
  readonly policySaveButton: Locator;
  readonly policyCancelButton: Locator;
  readonly policyFormError: Locator;
  readonly policyRemovedHostsWarning: Locator;
  readonly policyDeleteDialog: Locator;
  readonly policyDeleteConfirmButton: Locator;
  readonly policyDeleteCancelButton: Locator;
  readonly policyDeleteError: Locator;

  // ── VM secrets ───────────────────────────────────────────────────────────
  readonly secretsSection: Locator;
  readonly newSecretButton: Locator;
  /** The secret form dialog in either mode ("New …" or "Edit VM Secret"). */
  readonly secretDialog: Locator;
  /** The same dialog, resolved only while it is in create mode. */
  readonly newSecretDialog: Locator;
  /** The same dialog, resolved only while it is in edit mode. */
  readonly editSecretDialog: Locator;
  readonly secretNameInput: Locator;
  readonly secretEnvVarInput: Locator;
  readonly secretHostsInput: Locator;
  readonly secretHostsList: Locator;
  readonly secretHostsError: Locator;
  readonly secretSourceValueRadio: Locator;
  readonly secretSourceCredentialRadio: Locator;
  readonly secretValueInput: Locator;
  readonly secretCredentialSelect: Locator;
  readonly secretFieldSelect: Locator;
  readonly secretNoCredentialsNotice: Locator;
  readonly secretSaveButton: Locator;
  readonly secretCancelButton: Locator;
  readonly secretFormError: Locator;
  readonly secretDeleteDialog: Locator;
  readonly secretDeleteConfirmButton: Locator;
  readonly secretDeleteError: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dialog = page.getByRole('dialog', {
      name: 'User Profile',
      exact: true,
    });
    this.virtualMachineTab = this.dialog.getByRole('button', {
      name: 'Virtual Machine',
      exact: true,
    });
    this.infoBox = this.dialog.getByTestId('vm-admin-info-box');
    this.loadingSkeleton = this.dialog.getByTestId('vm-admin-loading');
    this.forbiddenNotice = this.dialog.getByTestId('vm-admin-forbidden');
    this.policiesSubTab = this.dialog.getByTestId('vm-admin-sub-tab-policies');
    this.secretsSubTab = this.dialog.getByTestId('vm-admin-sub-tab-secrets');

    this.policiesSection = this.dialog.getByTestId(
      'vm-network-policies-section',
    );
    this.newPolicyButton = this.dialog.getByTestId('vm-network-policy-new');
    this.policyDialog = page.getByRole('dialog', {
      name: /^(New|Edit) Network Policy$/,
    });
    this.newPolicyDialog = page.getByRole('dialog', {
      name: 'New Network Policy',
      exact: true,
    });
    this.editPolicyDialog = page.getByRole('dialog', {
      name: 'Edit Network Policy',
      exact: true,
    });
    this.policyNameInput = this.policyDialog.getByLabel('Name', {
      exact: true,
    });
    const policyHosts = this.policyDialog.getByTestId('network-policy-hosts');
    this.policyHostsInput = policyHosts.getByRole('textbox');
    this.policyHostsList = policyHosts.getByRole('list', {
      name: 'Allowed Hosts',
      exact: true,
    });
    this.policyHostsError = policyHosts.locator('p[aria-live="polite"]');
    this.policyDescriptionInput = this.policyDialog.getByLabel(
      'Description (Optional)',
      { exact: true },
    );
    this.policySaveButton = this.policyDialog.getByTestId(
      'network-policy-save',
    );
    this.policyCancelButton = this.policyDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.policyFormError = this.policyDialog.getByTestId(
      'network-policy-form-error',
    );
    this.policyRemovedHostsWarning = this.policyDialog.getByTestId(
      'network-policy-removed-hosts-warning',
    );
    this.policyDeleteDialog = page.getByRole('dialog', {
      name: 'Delete Network Policy',
      exact: true,
    });
    this.policyDeleteConfirmButton = this.policyDeleteDialog.getByTestId(
      'vm-network-policy-delete-confirm',
    );
    this.policyDeleteCancelButton = this.policyDeleteDialog.getByRole(
      'button',
      { name: 'Cancel', exact: true },
    );
    this.policyDeleteError = this.policyDeleteDialog.getByTestId(
      'vm-network-policy-delete-error',
    );

    this.secretsSection = this.dialog.getByTestId('vm-secrets-section');
    this.newSecretButton = this.dialog.getByTestId('vm-secret-new');
    this.secretDialog = page.getByRole('dialog', {
      name: /^(New|Edit) VM Secret$/,
    });
    this.newSecretDialog = page.getByRole('dialog', {
      name: 'New VM Secret',
      exact: true,
    });
    this.editSecretDialog = page.getByRole('dialog', {
      name: 'Edit VM Secret',
      exact: true,
    });
    this.secretNameInput = this.secretDialog.getByLabel('Name', {
      exact: true,
    });
    this.secretEnvVarInput = this.secretDialog.getByLabel(
      'Environment Variable',
      { exact: true },
    );
    const secretHosts = this.secretDialog.getByTestId('vm-secret-hosts');
    this.secretHostsInput = secretHosts.getByRole('textbox');
    this.secretHostsList = secretHosts.getByRole('list', {
      name: 'Allowed Hosts',
      exact: true,
    });
    this.secretHostsError = secretHosts.locator('p[aria-live="polite"]');
    this.secretSourceValueRadio = this.secretDialog.getByTestId(
      'vm-secret-source-value',
    );
    this.secretSourceCredentialRadio = this.secretDialog.getByTestId(
      'vm-secret-source-credential',
    );
    this.secretValueInput = this.secretDialog.getByTestId('vm-secret-value');
    this.secretCredentialSelect = this.secretDialog.getByTestId(
      'vm-secret-credential-select',
    );
    this.secretFieldSelect = this.secretDialog.getByTestId(
      'vm-secret-field-select',
    );
    this.secretNoCredentialsNotice = this.secretDialog.getByTestId(
      'vm-secret-no-credentials',
    );
    this.secretSaveButton = this.secretDialog.getByTestId('vm-secret-save');
    this.secretCancelButton = this.secretDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.secretFormError = this.secretDialog.getByTestId(
      'vm-secret-form-error',
    );
    this.secretDeleteDialog = page.getByRole('dialog', {
      name: 'Delete VM Secret',
      exact: true,
    });
    this.secretDeleteConfirmButton = this.secretDeleteDialog.getByTestId(
      'vm-secret-delete-confirm',
    );
    this.secretDeleteError = this.secretDeleteDialog.getByTestId(
      'vm-secret-delete-error',
    );
  }

  // ── Dialog ───────────────────────────────────────────────────────────────

  /**
   * More options → the platform name → the User Profile dialog. Mirrors
   * journey 38's `openAdvancedTab`: the tenant entry is labelled with the
   * platform name, which is read from the `current_tenant` localStorage
   * entry rather than hard-coded.
   */
  async openTenantSettings(): Promise<void> {
    const moreOptions = this.page.getByRole('button', {
      name: 'More options',
    });
    await expect(moreOptions).toBeVisible({ timeout: 15_000 });
    await moreOptions.click();
    const menu = this.page.getByRole('menu', { name: 'More options' });
    await expect(menu).toBeVisible({ timeout: 5_000 });
    const tenantItem = menu.getByText(await readPlatformName(this.page), {
      exact: true,
    });
    await expect(tenantItem).toBeVisible({ timeout: 5_000 });
    await tenantItem.click();
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Opens the tenant settings, selects "Virtual Machine" and waits until
   * the SDK tab has resolved its two list calls (info box + sub-tabs, or the
   * single permission notice when both answered 403).
   */
  async open(): Promise<void> {
    await this.openTenantSettings();
    await expect(this.virtualMachineTab).toBeVisible({ timeout: 10_000 });
    await this.virtualMachineTab.click();
    await expect(this.infoBox.or(this.forbiddenNotice).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Same close path as journey 38: the dialog's Close button, else Escape. */
  async close(): Promise<void> {
    const closeButton = this.dialog
      .getByRole('button', { name: /close/i })
      .last();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(this.dialog).not.toBeVisible({ timeout: 10_000 });
  }

  async showPolicies(): Promise<void> {
    await expect(this.policiesSubTab).toBeVisible({ timeout: 10_000 });
    await this.policiesSubTab.click();
    await expect(this.policiesSection).toBeVisible({ timeout: 15_000 });
  }

  async showSecrets(): Promise<void> {
    await expect(this.secretsSubTab).toBeVisible({ timeout: 10_000 });
    await this.secretsSubTab.click();
    await expect(this.secretsSection).toBeVisible({ timeout: 15_000 });
  }

  /** Success toasts are the authoritative signal that a mutation landed. */
  async expectToast(text: string, timeout = 30_000): Promise<void> {
    await expect(
      this.page.getByText(text, { exact: true }).first(),
    ).toBeVisible({ timeout });
  }

  // ── Host chip input ──────────────────────────────────────────────────────

  /** Types one `host:port` entry and commits it with Enter. */
  async addHost(input: Locator, host: string): Promise<void> {
    await input.fill(host);
    await input.press('Enter');
  }

  /** The chip for `host` inside a chip input's list. */
  hostChip(list: Locator, host: string): Locator {
    return list.getByRole('listitem').filter({ hasText: host });
  }

  /** The chip's own remove button (keyboard reachable). */
  removeHostButton(list: Locator, host: string): Locator {
    return list.getByRole('button', { name: `Remove ${host}`, exact: true });
  }

  // ── Network policies ─────────────────────────────────────────────────────

  /** Table row for the policy called `name` (exact match on the Name cell). */
  policyRow(name: string): Locator {
    return this.policiesSection
      .locator('tr[data-testid^="vm-network-policy-row-"]')
      .filter({ has: this.page.getByRole('cell', { name, exact: true }) });
  }

  /** The row's host list (`aria-label="Hosts allowed by {name}"`). */
  policyRowHosts(name: string): Locator {
    return this.policyRow(name).getByRole('list', {
      name: `Hosts allowed by ${name}`,
      exact: true,
    });
  }

  async openNewPolicy(): Promise<void> {
    await expect(this.newPolicyButton).toBeVisible({ timeout: 10_000 });
    await this.newPolicyButton.click();
    await expect(this.newPolicyDialog).toBeVisible({ timeout: 10_000 });
  }

  async openEditPolicy(name: string): Promise<void> {
    const row = this.policyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row
      .getByRole('button', { name: `Edit policy ${name}`, exact: true })
      .click();
    await expect(this.editPolicyDialog).toBeVisible({ timeout: 10_000 });
  }

  async openDeletePolicy(name: string): Promise<void> {
    const row = this.policyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row
      .getByRole('button', { name: `Delete policy ${name}`, exact: true })
      .click();
    await expect(this.policyDeleteDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Fills and submits the create dialog. Resolves once the dialog closes
   * (a rejected save keeps it open, which the caller's next assertion
   * reports as a visible dialog / form error).
   */
  async createPolicy(input: {
    name: string;
    hosts: string[];
    description?: string;
  }): Promise<void> {
    await this.openNewPolicy();
    await this.policyNameInput.fill(input.name);
    for (const host of input.hosts) {
      await this.addHost(this.policyHostsInput, host);
      await expect(this.hostChip(this.policyHostsList, host)).toBeVisible({
        timeout: 5_000,
      });
    }
    if (input.description) {
      await this.policyDescriptionInput.fill(input.description);
    }
    await this.policySaveButton.click();
    await this.expectToast('Network policy created');
    await expect(this.policyDialog).not.toBeVisible({ timeout: 10_000 });
  }

  // ── VM secrets ───────────────────────────────────────────────────────────

  secretRow(envVar: string): Locator {
    return this.secretsSection.getByTestId(`vm-secret-row-${envVar}`);
  }

  async openNewSecret(): Promise<void> {
    await expect(this.newSecretButton).toBeVisible({ timeout: 10_000 });
    await this.newSecretButton.click();
    await expect(this.newSecretDialog).toBeVisible({ timeout: 10_000 });
  }

  async openEditSecret(envVar: string): Promise<void> {
    const row = this.secretRow(envVar);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByTestId(`vm-secret-edit-${envVar}`).click();
    await expect(this.editSecretDialog).toBeVisible({ timeout: 10_000 });
  }

  async openDeleteSecret(envVar: string): Promise<void> {
    const row = this.secretRow(envVar);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByTestId(`vm-secret-delete-${envVar}`).click();
    await expect(this.secretDeleteDialog).toBeVisible({ timeout: 10_000 });
  }

  /** Creates a stored-value secret through the dialog (source "Enter a Value"). */
  async createSecret(input: {
    name: string;
    envVar: string;
    hosts: string[];
    value: string;
  }): Promise<void> {
    await this.openNewSecret();
    await this.secretNameInput.fill(input.name);
    await this.secretEnvVarInput.fill(input.envVar);
    for (const host of input.hosts) {
      await this.addHost(this.secretHostsInput, host);
      await expect(this.hostChip(this.secretHostsList, host)).toBeVisible({
        timeout: 5_000,
      });
    }
    await this.secretSourceValueRadio.click();
    await this.secretValueInput.fill(input.value);
    await this.secretSaveButton.click();
    await this.expectToast('VM secret created');
    await expect(this.secretDialog).not.toBeVisible({ timeout: 10_000 });
  }
}

/**
 * The tenant's display name, which labels its entry in the More options
 * menu. Throws when it cannot be read — silently guessing would send the
 * test into the wrong dialog.
 */
export async function readPlatformName(page: Page): Promise<string> {
  const platformName = await page.evaluate(() => {
    const raw = localStorage.getItem('current_tenant');
    if (!raw) return null;
    try {
      return (JSON.parse(raw)?.platform_name as string | undefined) ?? null;
    } catch {
      return null;
    }
  });
  if (!platformName) {
    throw new Error(
      'Could not read platform_name from the current_tenant localStorage entry — cannot open the tenant settings dialog',
    );
  }
  return platformName;
}
