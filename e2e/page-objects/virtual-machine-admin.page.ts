import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the organization's **Network Policies** page.
 *
 * It lives in the SDK `Account` rail of the User Profile dialog (More
 * options → the platform name — the route journey 38 takes to the Advanced
 * tab), whose "Network" entry, in the Integrations group, is listed for
 * admins only. Its body is the SDK `VirtualMachineAdminTab`
 * (`@iblai/web-containers`), which holds the section
 * `vm-network-policies-section`: a table of named allowlists with add / edit /
 * delete through the SDK `NetworkPolicyDialog`. Hosts are entered through the SDK `HostPortChipInput`:
 * type one entry and press Enter (or `,` / space, or paste a list); a URL
 * becomes its host, and the client-side check explains a rejected entry in an
 * `aria-live="polite"` line under the input and leaves it in the box instead of
 * adding a chip. Chips and rows show an address without the standard `:443`.
 * Backspace on an empty box removes the last chip; every chip has a "Remove
 * {host}" button. Secrets have their own page, `secrets.page.ts`.
 *
 * ── Dialog-first locators ────────────────────────────────────────────────
 *
 * Up to three layers are stacked here at once: the User Profile dialog, a
 * policy dialog on top of it, and (for deletes) a confirmation. They share
 * field and button names ("Name", "Allowed Hosts", "Cancel", "Save Changes"),
 * so nothing is looked up from the page by test id or label alone. Each layer
 * is first resolved by its ARIA role AND its accessible name — the SDK
 * `DialogTitle` — and every inner element is then queried from that dialog
 * locator:
 *
 *   User Profile ─ `getByRole('dialog', { name: 'User Profile', exact: true })`
 *   Add Network / Edit Network
 *   Delete Network
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
 * are Title Case ("Allowed Hosts"), toasts and sentences are sentence case
 * ("Network added").
 */
export class VirtualMachineAdminPage {
  readonly page: Page;

  /** The User Profile dialog that hosts the SDK Account rail. */
  readonly dialog: Locator;
  /** The rail's "Network" entry in its Integrations group (admin-only). */
  readonly networkPoliciesTab: Locator;
  readonly infoBox: Locator;
  readonly loadingSkeleton: Locator;
  readonly forbiddenNotice: Locator;

  // ── Network policies ─────────────────────────────────────────────────────
  readonly policiesSection: Locator;
  readonly addPolicyButton: Locator;
  /** The policy form dialog in either mode ("Add Network" or "Edit Network"). */
  readonly policyDialog: Locator;
  /** The same dialog, resolved only while it is in add mode. */
  readonly addPolicyDialog: Locator;
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

  constructor(page: Page) {
    this.page = page;

    this.dialog = page.getByRole('dialog', {
      name: 'User Profile',
      exact: true,
    });
    this.networkPoliciesTab = this.dialog
      .getByRole('group', { name: 'Integrations', exact: true })
      .getByRole('button', { name: 'Network', exact: true });
    this.infoBox = this.dialog.getByTestId('vm-admin-info-box');
    this.loadingSkeleton = this.dialog.getByTestId('vm-admin-loading');
    this.forbiddenNotice = this.dialog.getByTestId('vm-admin-forbidden');

    this.policiesSection = this.dialog.getByTestId(
      'vm-network-policies-section',
    );
    this.addPolicyButton = this.dialog.getByTestId('vm-network-policy-new');
    this.policyDialog = page.getByRole('dialog', {
      name: /^(Add Network|Edit Network)$/,
    });
    this.addPolicyDialog = page.getByRole('dialog', {
      name: 'Add Network',
      exact: true,
    });
    this.editPolicyDialog = page.getByRole('dialog', {
      name: 'Edit Network',
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
      name: 'Delete Network',
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
   * Opens the tenant settings, selects "Network Policies" and waits until
   * the SDK tab has resolved its list call (info box + policies, or the
   * permission notice when it answered 403).
   */
  async open(): Promise<void> {
    await this.openTenantSettings();
    await expect(this.networkPoliciesTab).toBeVisible({ timeout: 10_000 });
    await this.networkPoliciesTab.click();
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

  // ── Paged tables ─────────────────────────────────────────────────────────

  /**
   * Brings `row` on screen when the table spans more than one page, and
   * returns it either way so the caller's assertion decides the outcome.
   *
   * The policy list is org-wide, ordered by name, and grows with
   * residue from other runs, so a freshly created, uniquely named row is not
   * guaranteed to sit on the page currently shown. The SDK tables render
   * every row today; this walk follows the shared SDK pagination control
   * ("Go to previous page" / "Go to next page", as the LTI tables use) so the
   * lookup keeps working the moment a table is paginated. With a single page
   * the control is absent and this returns after the first check.
   *
   * The list refetches after every write, so the row first gets `graceMs` to
   * appear on the current page. Only then does the walk rewind to the first
   * page and step forward until the row shows or the last page is reached. A
   * page turn is confirmed by the first row changing rather than by sleeping;
   * if it does not change the walk stops there.
   */
  private async revealRow(
    section: Locator,
    row: Locator,
    graceMs = 5_000,
  ): Promise<Locator> {
    const firstRow = section.locator('tbody tr').first();
    const next = section.locator('[aria-label="Go to next page"]');
    const previous = section.locator('[aria-label="Go to previous page"]');

    const onScreen = async (timeout: number): Promise<boolean> =>
      timeout > 0
        ? row
            .first()
            .waitFor({ state: 'visible', timeout })
            .then(
              () => true,
              () => false,
            )
        : row
            .first()
            .isVisible()
            .catch(() => false);
    const canUse = async (control: Locator): Promise<boolean> =>
      (await control.isVisible().catch(() => false)) &&
      (await control.getAttribute('aria-disabled').catch(() => 'true')) !==
        'true';
    const turn = async (control: Locator): Promise<boolean> => {
      const before = await firstRow.textContent().catch(() => null);
      await control.click();
      if (before === null) return true;
      return expect(firstRow)
        .not.toHaveText(before, { timeout: 15_000 })
        .then(
          () => true,
          () => false,
        );
    };

    if (await onScreen(graceMs)) return row;
    // Not on the current page: start over from the first one. The page cap
    // is a runaway guard far above any real list.
    for (let i = 0; i < 50 && (await canUse(previous)); i++) {
      if (!(await turn(previous))) break;
    }
    for (let i = 0; i < 50; i++) {
      if (await onScreen(0)) return row;
      if (!(await canUse(next))) return row;
      if (!(await turn(next))) return row;
    }
    return row;
  }

  // ── Network policies ─────────────────────────────────────────────────────

  /**
   * Table row for the policy called `name` (exact match on the Name cell).
   * Only sees the page currently shown — use `findPolicyRow` to act on it.
   */
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

  /** The policy's row, brought on screen first if the table is paged. */
  async findPolicyRow(name: string): Promise<Locator> {
    await expect(this.policiesSection).toBeVisible({ timeout: 15_000 });
    return this.revealRow(this.policiesSection, this.policyRow(name));
  }

  /**
   * Asserts no page of the table lists the policy any more. Rooted on the
   * section, which is only in the accessibility tree once every nested
   * dialog has closed, so it cannot pass just because nothing resolves.
   */
  async expectPolicyRowGone(name: string, timeout = 20_000): Promise<void> {
    await expect(this.policiesSection).toBeVisible({ timeout: 10_000 });
    await expect(async () => {
      const row = await this.revealRow(
        this.policiesSection,
        this.policyRow(name),
        0,
      );
      expect(await row.count()).toBe(0);
    }).toPass({ timeout });
  }

  async openAddPolicy(): Promise<void> {
    await expect(this.addPolicyButton).toBeVisible({ timeout: 10_000 });
    await this.addPolicyButton.click();
    await expect(this.addPolicyDialog).toBeVisible({ timeout: 10_000 });
  }

  async openEditPolicy(name: string): Promise<void> {
    const row = await this.findPolicyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row
      .getByRole('button', { name: `Edit network ${name}`, exact: true })
      .click();
    await expect(this.editPolicyDialog).toBeVisible({ timeout: 10_000 });
  }

  async openDeletePolicy(name: string): Promise<void> {
    const row = await this.findPolicyRow(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row
      .getByRole('button', { name: `Delete network ${name}`, exact: true })
      .click();
    await expect(this.policyDeleteDialog).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Fills and submits the Add Network dialog. Resolves once the dialog closes
   * (a rejected save keeps it open, which the caller's next assertion
   * reports as a visible dialog / form error).
   */
  async addPolicy(input: {
    name: string;
    hosts: string[];
    description?: string;
  }): Promise<void> {
    await this.openAddPolicy();
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
    await this.expectToast('Network added');
    await expect(this.policyDialog).not.toBeVisible({ timeout: 10_000 });
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
